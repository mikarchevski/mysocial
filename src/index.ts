// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import staticFiles from "@fastify/static";
import fastifyRateLimit from "@fastify/rate-limit";
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
import { friendsRoutes } from "./routes/friends.js";
import { securityPlugin } from "./plugins/security.js";
import AuthService from "./services/auth.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: true,
  ignoreTrailingSlash: true,
});

// ==========================================
// 1. Регистрация базовых плагинов
// ==========================================
await app.register(cookie);
await app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: "token", signed: false },
});
await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await app.register(websocket);
await app.register(securityPlugin);

// ==========================================
// 2. Глобальные заголовки безопасности (CSP и др.)
// ==========================================
app.addHook("onRequest", async (request, reply) => {
  reply.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
});

// ==========================================
// 3. Rate Limiting
// ==========================================
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: `Слишком много запросов. Подождите ${Math.ceil(context.ttl / 1000)} сек.`,
  }),
});

// ==========================================
// 4. Декораторы и Глобальные обработчики
// ==========================================
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) {
    return reply.status(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: "Not Found",
      statusCode: 404,
    });
  }
  return reply.status(404).sendFile("fragments/404.html");
});

// ==========================================
// 5. Маршруты для SPA (Frontend)
// ==========================================
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

app.get("/friends", async (request, reply) => {
  try {
    await request.jwtVerify();
    return reply.sendFile("index.html");
  } catch (err) {
    return reply.redirect("/auth");
  }
});

app.get("/dialogs", async (request, reply) => {
  try {
    await request.jwtVerify();
    return reply.sendFile("index.html");
  } catch (err) {
    return reply.redirect("/auth");
  }
});

app.get("/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  if (id.includes(".")) {
    return reply.callNotFound();
  }

  try {
    if (/^\d+$/.test(id)) {
      const authService = new AuthService();
      const user = await authService.getUserById(parseInt(id, 10));

      if (!user) {
        console.log(`Пользователь с ID ${id} не найден в БД`);
        return reply.status(404).sendFile("fragments/404.html");
      }
    }
    return reply.sendFile("index.html");
  } catch (error) {
    console.error(`Ошибка при проверке ID ${id}:`, error);
    return reply.status(404).sendFile("fragments/404.html");
  }
});

// ==========================================
// 6. API Маршруты (Backend)
// ==========================================
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(messageRoutes, { prefix: "/api/messages" });
await app.register(usersRoutes, { prefix: "/api/users" });
await app.register(postsRoutes, { prefix: "/api/posts" });
await app.register(friendsRoutes, { prefix: "/api/friends" });

// ==========================================
// 7. Статические файлы (СТРОГО ПОСЛЕ всех роутов)
// ==========================================
await app.register(staticFiles, {
  root: path.join(__dirname, "../public"),
  prefix: "/",
});

// ==========================================
// 8. WebSocket и Health Check
// ==========================================
app.register(async function (fastify) {
  fastify.get(
    "/ws",
    { websocket: true, preValidation: [(fastify as any).authenticate] },
    websocketHandler,
  );
});

app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// ==========================================
// 9. Запуск и завершение работы (БЫЛО ПРОПУЩЕНО РАНЕЕ)
// ==========================================
const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`Server running on http://${env.HOST}:${env.PORT}`);
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
