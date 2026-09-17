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
import AuthService from "./services/auth.service.js"; // Добавляем импорт
import { friendsRoutes } from "./routes/friends.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: true,
});

// 1. Плагины
await app.register(cookie);
await app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: "token", signed: false },
});
await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await app.register(websocket);

// 2. Декораторы (ОБЯЗАТЕЛЬНО до регистрации роутов, которые их используют!)
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// 3. Роуты страниц (ДО staticFiles)
// Изменяем главный маршрут - теперь он просто возвращает index.html
app.get("/", async (request, reply) => {
  try {
    // Проверяем, авторизован ли пользователь
    await request.jwtVerify();
    // Если пользователь авторизован, просто отдаем index.html
    // SPA-роутинг будет обрабатывать отображение нужной страницы
    return reply.sendFile("index.html");
  } catch (err) {
    // Если не авторизован, редиректим на страницу входа
    return reply.redirect("/auth");
  }
});

app.get("/auth", async (request, reply) => {
  return reply.sendFile("auth.html");
});

app.get("/dialogs", async (request, reply) => {
  try {
    await request.jwtVerify();
    return reply.sendFile("dialogs.html");
  } catch (err) {
    return reply.redirect("/auth");
  }
});

// Добавьте функцию для генерации полного HTML
function generateFullPage(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Страница не найдена</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <div class="container">
            <aside class="main-layout__sidebar">
                <nav class="side-menu">
                    <ul class="side-menu__list">
                        <li class="side-menu__item">
                            <a href="/" class="side-menu__link spa-link">Главная</a>
                        </li>
                    </ul>
                </nav>
            </aside>
            <main class="content" id="main-content">
                ${content}
            </main>
        </div>
        <script src="/js/spa-router.js"></script>
        <script src="/js/sidebar.js"></script>
    </body>
    </html>
  `;
}

// Обновите обработчик 404
// Обновленный обработчик 404 в index.ts
app.setNotFoundHandler((request, reply) => {
  // Проверяем, является ли запрос AJAX/XHR запросом (для SPA)
  const isAjax =
    request.headers["x-requested-with"] === "XMLHttpRequest" ||
    request.headers.accept?.includes("application/json");

  if (isAjax) {
    // Для SPA возвращаем только фрагмент
    reply.status(404).sendFile("fragments/404.html");
  } else {
    // Для прямого доступа возвращаем полную страницу
    // Используем fs.promises для лучшей обработки
    import("fs")
      .then((fsModule) => {
        const fs = fsModule.default || fsModule;
        fs.readFile(
          path.join(__dirname, "../public/fragments/404.html"),
          "utf8",
          (err, data) => {
            if (err) {
              console.error("Ошибка чтения 404.html:", err);
              reply.status(500).send("Internal Server Error");
            } else {
              reply
                .status(404)
                .header("Content-Type", "text/html")
                .send(generateFullPage(data));
            }
          },
        );
      })
      .catch((err) => {
        console.error("Ошибка импорта fs:", err);
        reply.status(500).send("Internal Server Error");
      });
  }
});

// Обновляем маршрут для обработки ID
app.get("/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  console.log("🔍 [DEBUG] Сработал маршрут /:id. Параметр id =", id);

  if (id === "auth") {
    return reply.sendFile("auth.html");
  }

  if (["friends", "dialogs"].includes(id) || /^\d+$/.test(id)) {
    try {
      if (/^\d+$/.test(id)) {
        const authService = new AuthService();
        const user = await authService.getUserById(parseInt(id, 10));

        // ВАЖНО: Если метод возвращает null вместо выброса ошибки, мы должны сделать это вручную
        if (!user) {
          console.log(
            "⚠️ [DEBUG] Пользователь с ID",
            id,
            "не найден в БД (вернул null/undefined)",
          );
          throw new Error("User not found");
        }
      }
      console.log("✅ [DEBUG] Отдаем index.html для ID:", id);
      return reply.sendFile("index.html");
    } catch (error) {
      console.log(
        "❌ [DEBUG] Ошибка или пользователь не найден. Пытаемся отдать 404.html",
      );

      // ВРЕМЕННАЯ ДИАГНОСТИКА: Если sendFile не работает, отдадим HTML строкой напрямую.
      // Если вы увидите этот текст в браузере, значит проблема ИСКЛЮЧИТЕЛЬНО в пути к файлу!
      /* 
      return reply.status(404).type('text/html').send(`
        <h1>404 - Страница не найдена</h1>
        <p>Это тестовый HTML. Роутинг работает, но файл fragments/404.html не найден сервером.</p>
        <a href="/">На главную</a>
      `);
      */

      // Основной вариант (раскомментируйте строку выше для теста, если этот не работает)
      return reply.status(404).sendFile("fragments/404.html");
    }
  }

  console.log("❌ [DEBUG] Неизвестный маршрут. Отдаем 404.html");
  return reply.status(404).sendFile("fragments/404.html");
});

// 4. API Роуты (до staticFiles)
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(messageRoutes, { prefix: "/api/messages" });
await app.register(usersRoutes, { prefix: "/api/users" }); // Здесь будет маршрут /api/users/me
await app.register(postsRoutes, { prefix: "/api/posts" });
await app.register(friendsRoutes, { prefix: "/api/friends" });

// 5. Статические файлы (ПОСЛЕ всех специфических маршрутов)
await app.register(staticFiles, {
  root: path.join(__dirname, "../public"),
  prefix: "/",
});

// 6. WebSocket
app.register(async function (fastify) {
  fastify.get(
    "/ws",
    {
      websocket: true,
      preValidation: [(fastify as any).authenticate], // Защищаем WebSocket соединение
    },
    websocketHandler,
  );
});

// 7. Health check
app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// 8. Запуск
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
