// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import staticFiles from "@fastify/static";
import * as path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.js";
import { messageRoutes } from "./routes/messages.js";
import { websocketHandler } from "./plugins/websocket.js";
import { redis } from "./redis/index.js";
import { pool } from "./db/index.js";
import { usersRoutes } from "./routes/users.js";
import { postsRoutes } from "./routes/posts.js";
import AuthService from "./services/auth.service.js";
import { friendsRoutes } from "./routes/friends.js";
import fastifyRateLimit from "@fastify/rate-limit";
import { securityPlugin } from "./plugins/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: true,
  ignoreTrailingSlash: true, // Критически важно для SPA
});

// 1. Плагины
await app.register(cookie);
await app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: "token", signed: false },
});
await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await app.register(websocket);

// === CSP ЗАГОЛОВКИ ===
app.addHook("onRequest", async (request, reply) => {
  // Строгая CSP политика
  reply.header(
    "Content-Security-Policy",
    [
      "default-src 'self'", // Запрет загрузки ресурсов с внешних доменов
      "script-src 'self'", // Запрет инлайн-скриптов и внешних скриптов
      "style-src 'self' 'unsafe-inline'", // Разрешаем инлайн-стили (нужно для SCSS)
      "img-src 'self' data: blob:", // Разрешаем изображения из тех же источников и base64
      "font-src 'self'", // Шрифты только с вашего домена
      "connect-src 'self' ws: wss:", // WebSocket соединения
      "frame-ancestors 'none'", // Запрет встраивания сайта в iframe (защита от clickjacking)
      "base-uri 'self'", // Запрет изменения base URL
      "form-action 'self'", // Формы могут отправляться только на ваш домен
    ].join("; "),
  );

  // Дополнительные заголовки безопасности
  reply.header("X-Content-Type-Options", "nosniff"); // Запрет MIME-type sniffing
  reply.header("X-Frame-Options", "DENY"); // Запрет iframe (дублирует frame-ancestors)
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin"); // Контроль referrer
  reply.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  ); // Запрет доступа к API
});
// === КОНЕЦ CSP ===
await app.register(securityPlugin);
// 1.5. Rate Limiting (ГЛОБАЛЬНЫЕ НАСТРОЙКИ)
await app.register(fastifyRateLimit, {
  max: 100, // Максимум 100 запросов в минуту с одного IP по умолчанию
  timeWindow: "1 minute",
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: `Слишком много запросов. Подождите ${Math.ceil(context.ttl / 1000)} сек.`,
  }),
});
// 2. Декораторы
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// 3. Глобальный обработчик 404 (МАКСИМАЛЬНО ПРОСТОЙ И НАДЕЖНЫЙ)
app.setNotFoundHandler((request, reply) => {
  // Для API отдаем JSON
  if (request.url.startsWith("/api/")) {
    return reply.status(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: "Not Found",
      statusCode: 404,
    });
  }
  // Для всех остальных случаев отдаем готовую HTML-страницу 404
  // Убедитесь, что public/fragments/404.html это ПОЛНАЯ HTML-страница (с <html>, <head>, <body>)
  return reply.status(404).sendFile("fragments/404.html");
});

// 4. Явные маршруты для SPA разделов (ИСПРАВЛЕНИЕ ГЛАВНОЙ ПРОБЛЕМЫ)
app.get("/", async (request, reply) => {
  try {
    await request.jwtVerify();
    return reply.sendFile("index.html");
  } catch (err) {
    return reply.redirect("/auth");
  }
});

app.get("/auth", async (request, reply) => {
  return reply.sendFile("auth.html");
});

// Явный маршрут для друзей
app.get("/friends", async (request, reply) => {
  try {
    await request.jwtVerify();
    // При прямом доступе к /friends всегда возвращаем index.html
    return reply.sendFile("index.html");
  } catch (err) {
    return reply.redirect("/auth");
  }
});

// Явный маршрут для диалогов
app.get("/dialogs", async (request, reply) => {
  try {
    await request.jwtVerify();
    // При прямом доступе к /dialogs всегда возвращаем index.html
    return reply.sendFile("index.html");
  } catch (err) {
    return reply.redirect("/auth");
  }
});

// 5. Динамические маршруты (профили по ID)
app.get("/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  // Если в пути есть точка (например, /style.css), это не ID пользователя.
  // Передаем управление дальше к staticFiles или к 404
  if (id.includes(".")) {
    return reply.callNotFound();
  }

  try {
    if (/^\d+$/.test(id)) {
      const authService = new AuthService();
      const user = await authService.getUserById(parseInt(id, 10));

      if (!user) {
        console.log(`⚠️ Пользователь с ID ${id} не найден в БД`);
        return reply.status(404).sendFile("fragments/404.html");
      }
    }

    // Если ID валиден или это строковое имя раздела, отдаем SPA-оболочку
    return reply.sendFile("index.html");
  } catch (error) {
    console.error(`❌ Ошибка при проверке ID ${id}:`, error);
    return reply.status(404).sendFile("fragments/404.html");
  }
});

// 6. API Роуты
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(messageRoutes, { prefix: "/api/messages" });
await app.register(usersRoutes, { prefix: "/api/users" });
await app.register(postsRoutes, { prefix: "/api/posts" });
await app.register(friendsRoutes, { prefix: "/api/friends" });

// 7. Статические файлы (СТРОГО ПОСЛЕ всех специфических маршрутов)
await app.register(staticFiles, {
  root: path.join(__dirname, "../public"),
  prefix: "/",
});

// 8. WebSocket
app.register(async function (fastify) {
  fastify.get(
    "/ws",
    { websocket: true, preValidation: [(fastify as any).authenticate] },
    websocketHandler,
  );
});

// 9. Health check
app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// 10. Запуск
const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 Server running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  console.log("Shutting down...");
  await app.close();
  await redis.quit();
  await pool.end();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
