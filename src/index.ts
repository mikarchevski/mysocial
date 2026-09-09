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
import { usersRoutes } from './routes/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: true,
});

// 1. Плагины
await app.register(cookie);
await app.register(jwt, { 
  secret: env.JWT_SECRET, 
  cookie: { cookieName: 'token', signed: false } 
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
app.get('/', async (request, reply) => {
  try {
    // ИСПРАВЛЕНИЕ TS: явное приведение типа, чтобы TS знал про userId
    const payload = await request.jwtVerify() as { userId: number };
    return reply.redirect(`/${payload.userId}`); 
  } catch (err) {
    return reply.redirect('/auth');
  }
});

app.get('/auth', async (request, reply) => {
  return reply.sendFile('auth.html');
});

app.get('/dialogs', async (request, reply) => {
  try {
    await request.jwtVerify();
    return reply.sendFile('dialogs.html');
  } catch (err) {
    return reply.redirect('/auth');
  }
});


// ОБНОВЛЕНИЕ: теперь возвращаем index.html вместо profile.html
app.get('/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  
  if (/^\d+$/.test(id)) {
    return reply.sendFile('index.html'); // Теперь используем index.html
  }
  
  return reply.status(404).send('Not found');
});

// 4. API Роуты (до staticFiles)
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(messageRoutes, { prefix: '/api/messages' });
await app.register(usersRoutes, { prefix: '/api/users' });

// 5. Статические файлы (ПОСЛЕ всех специфических маршрутов)
await app.register(staticFiles, {
  root: path.join(__dirname, '../public'),
  prefix: '/',
});

// 6. WebSocket
app.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, websocketHandler);
});

// 7. Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
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
  console.log('Shutting down...');
  await app.close();
  await redis.quit();
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();