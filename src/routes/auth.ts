// src/routes/auth.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import AuthService from '../services/auth.service.js';

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

const authService = new AuthService();

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Регистрация
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    
    try {
      const user = await authService.register(body);
      return reply.status(201).send({ user });
    } catch (error: any) {
      if (error.message === 'Пользователь с таким email уже существует') {
        return reply.status(409).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Внутренняя ошибка сервера' });
    }
  });

  // Вход
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    
    try {
      const user = await authService.login(body.email, body.password);
      
      const expiresIn = body.rememberMe ? '30d' : '1d';
      const token = app.jwt.sign({ userId: user.id }, { expiresIn });
      
      // Исправленная установка куки
      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: false, // временно отключено для разработки
        sameSite: 'lax', // изменено на lax для разработки
        maxAge: body.rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
      });
      
      return { user, success: true };
    } catch (error: any) {
      return reply.status(401).send({ error: error.message });
    }
  });

  // Получение текущего пользователя
  app.get('/me', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    
    try {
      const user = await authService.getUserById(userId);
      return { user };
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  // Выход
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });
};