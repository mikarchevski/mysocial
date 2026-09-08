import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.js';
import { messageRoutes } from './routes/messages.js';
import { websocketHandler } from './plugins/websocket.js';
import { redis } from './redis/index.js';
import { pool } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: true,
});

// Статические файлы (фронтенд)
await app.register(staticFiles, {
  root: path.join(__dirname, '../public'),
  prefix: '/',
});

// Плагины
await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
});

await app.register(jwt, {
  secret: env.JWT_SECRET,
});

// Добавляем декоратор для аутентификации
app.decorate("authenticate", async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

await app.register(cookie);
await app.register(websocket);

// Роуты
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(messageRoutes, { prefix: '/api/messages' });
// Роуты для красивых URL без .html
app.get('/auth', async (request, reply) => {
  return reply.sendFile('auth.html');
});
// WebSocket
app.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, websocketHandler);
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Запуск
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
  console.log('Shutting down...');
  await app.close();
  await redis.quit();
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();