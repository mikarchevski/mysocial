// src/routes/auth.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';

const registerSchema = z.object({
  firstName: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  lastName: z.string().min(2, 'Фамилия должна содержать минимум 2 символа'),
  email: z.string().email('Некорректный email'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата рождения'),
  city: z.string().optional(),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  confirmPassword: z.string(),
  publicKey: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
  rememberMe: z.boolean().default(false),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Регистрация
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    
    // Проверка на существующий email
    const existingUser = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existingUser.length > 0) {
      return reply.status(409).send({ error: 'Пользователь с таким email уже существует' });
    }
    
    const passwordHash = await hashPassword(body.password);
    
    const [newUser] = await db
      .insert(users)
      .values({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        passwordHash,
        dateOfBirth: body.dateOfBirth,
        city: body.city || null,
        publicKey: body.publicKey || null,
      })
      .returning({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email });
    
    return reply.status(201).send({ user: newUser });
  });

  // Вход
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    
    if (!user) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }
    
    const valid = await verifyPassword(user.passwordHash, body.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }
    
    // Если "Запомнить меня" - 30 дней, иначе - 1 день
    const expiresIn = body.rememberMe ? '30d' : '1d';
    const token = app.jwt.sign({ userId: user.id }, { expiresIn });
    
    reply.setCookie('token', token, {
      httpOnly: true,
      secure: true, // Работает только по HTTPS (у нас Caddy это обеспечивает)
      sameSite: 'strict',
      path: '/',
      maxAge: body.rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // в секундах
    });
    
    return { 
      user: { 
        id: user.id, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        email: user.email 
      } 
    };
  });

  // Получение текущего пользователя (для проверки авторизации)
  app.get('/me', {
    preValidation: [(app as any).authenticate] // Используем декоратор как функцию
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    
    const [user] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, city: users.city })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
    if (!user) return reply.status(404).send({ error: 'Пользователь не найден' });
    
    return { user };
  });

  // Выход из системы
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('token', {
      path: '/',
    });
    return { success: true };
  });

  // Получение пользователя по ID (публичный эндпоинт)
  // В src/routes/auth.ts обновите эндпоинт получения пользователя по ID:
  // app.get('/users/:id', async (request, reply) => {
  //     const { id } = request.params as { id: string };
  //     const userId = parseInt(id, 10);

  //     if (isNaN(userId)) {
  //         return reply.status(400).send({ error: 'Некорректный ID' });
  //     }

  //     // Используем select со всеми нужными полями
  //     const [user] = await db
  //         .select({
  //             id: users.id,
  //             firstName: users.firstName,
  //             lastName: users.lastName,
  //             email: users.email,  // Включаем email
  //             city: users.city,
  //             dateOfBirth: users.dateOfBirth,
  //         })
  //         .from(users)
  //         .where(eq(users.id, userId))
  //         .limit(1);

  //     if (!user) {
  //         return reply.status(404).send({ error: 'Пользователь не найден' });
  //     }

  //     return { user };
  // });
};