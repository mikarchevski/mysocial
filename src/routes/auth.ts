// src/routes/auth.ts
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import AuthService from "../services/auth.service.js";
import { env } from "../config/env.js";

// Функция для проверки на потенциально опасные паттерны
const containsDangerousPatterns = (str: string): boolean => {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror= и т.д.
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(str));
};

const registerSchema = z
  .object({
    firstName: z.string().min(2, "Имя должно содержать минимум 2 символа"),
    lastName: z.string().min(2, "Фамилия должна содержать минимум 2 символа"),
    email: z.string().email("Некорректный email"),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата рождения"),
    city: z.string().optional(),
    password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),

    // 1. ДЕЛАЕМ ПОЛЕ ОПЦИОНАЛЬНЫМ
    confirmPassword: z.string().optional(),

    publicKey: z.string().optional(),
    encryptedPrivateKey: z.string().optional(),
    salt: z.array(z.number()).optional(),
  })
  .refine(
    (data) => {
      // 2. УСЛОВНАЯ ПРОВЕРКА:
      // Если поле пришло (например, запрос через Postman), проверяем совпадение.
      // Если поля нет (нормальный запрос с нашего фронтенда), считаем валидацию пройденной.
      if (data.confirmPassword !== undefined) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      message: "Пароли не совпадают",
      path: ["confirmPassword"],
    },
  );

const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
  rememberMe: z.boolean().default(false),
});

const authService = new AuthService();

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Регистрация
  // 1. РЕГИСТРАЦИЯ со строгим лимитом
  app.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: 5, // Только 5 попыток регистрации в минуту с одного IP
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);
      try {
        const user = await authService.register(body);
        const token = app.jwt.sign({ userId: user.id }, { expiresIn: "1d" });

        reply.setCookie("token", token, {
          path: "/",
          httpOnly: true,
          secure: env.NODE_ENV === "production", // Используйте env
          sameSite: "lax",
          maxAge: 24 * 60 * 60,
        });

        return reply.status(201).send({ user, success: true });
      } catch (error: any) {
        if (error.message === "Пользователь с таким email уже существует") {
          return reply.status(409).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Внутренняя ошибка сервера" });
      }
    },
  );

  // 2. ВХОД со строгим лимитом
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 10, // Только 10 попыток входа в минуту с одного IP
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      try {
        const userData = await authService.login(body.email, body.password);
        const expiresIn = body.rememberMe ? "30d" : "1d";
        const token = app.jwt.sign({ userId: userData.id }, { expiresIn });

        reply.setCookie("token", token, {
          path: "/",
          httpOnly: true,
          secure: env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: body.rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
        });

        return {
          user: {
            id: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
          },
          salt: userData.salt,
          encryptedPrivateKey: userData.encryptedPrivateKey,
          success: true,
        };
      } catch (error: any) {
        return reply.status(401).send({ error: error.message });
      }
    },
  );

  // Получение текущего пользователя
  app.get(
    "/me",
    {
      preValidation: [(app as any).authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as any).userId;

      try {
        const user = await authService.getUserById(userId);
        return { user };
      } catch (error: any) {
        return reply.status(404).send({ error: error.message });
      }
    },
  );

  // Выход
  app.post("/logout", async (request, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { success: true };
  });
};
