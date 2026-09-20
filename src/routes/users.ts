// src/routes/users.ts
import { FastifyPluginAsync } from "fastify";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { z } from "zod"; // <-- 1. Импортируем Zod
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import AuthService from "../services/auth.service.js";

const authService = new AuthService();

// 2. Создаем строгую схему валидации для обновления профиля
const updateProfileSchema = z.object({
  city: z
    .string()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  phone: z
    .string()
    .max(20)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  website: z
    .string()
    .max(255)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  familyStatus: z
    .string()
    .max(50)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  about: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  gender: z
    .string()
    .max(10)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
});

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // 1. ПОЛУЧИТЬ ДАННЫЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ (Строгий маршрут)
  app.get(
    "/me",
    {
      preValidation: [(app as any).authenticate],
    },
    async (request, reply) => {
      try {
        const userId = (request.user as any).userId;
        const user = await authService.getUserById(userId);
        return { user };
      } catch (error: any) {
        console.error("Ошибка получения профиля:", error);
        return reply.status(404).send({ error: error.message });
      }
    },
  );

  // 2. ПОЛУЧИТЬ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ПО ID (Параметрический маршрут)
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return reply.status(400).send({ error: "Некорректный ID" });
    }

    try {
      const user = await authService.getUserById(userId);
      return { user };
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  // 3. ПОИСК ПОЛЬЗОВАТЕЛЕЙ
  app.get(
    "/search",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const { q } = request.query as { q?: string };
      const currentUserId = (request.user as any).userId;

      if (!q || q.trim().length < 2) {
        return reply.status(400).send({
          error: "Поисковый запрос должен содержать минимум 2 символа",
        });
      }

      const searchPattern = `%${q.trim()}%`;

      try {
        const results = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            city: users.city,
          })
          .from(users)
          .where(
            and(
              sql`${users.id} != ${currentUserId}`,
              or(
                ilike(users.firstName, searchPattern),
                ilike(users.lastName, searchPattern),
                ilike(users.city, searchPattern),
              ),
            ),
          )
          .limit(20);

        return { users: results, count: results.length };
      } catch (error) {
        console.error("Ошибка поиска пользователей:", error);
        return reply
          .status(500)
          .send({ error: "Внутренняя ошибка сервера при поиске" });
      }
    },
  );

  // 4. ОБНОВЛЕНИЕ ПРОФИЛЯ (Только свой)
  app.put(
    "/:id",
    {
      preValidation: [(app as any).authenticate],
    },
    async (request, reply) => {
      const currentUserId = (request.user as any).userId;
      const { id } = request.params as { id: string };
      const targetId = parseInt(id, 10);

      if (currentUserId !== targetId) {
        return reply
          .status(403)
          .send({ error: "Можно редактировать только свой профиль" });
      }

      try {
        // Валидируем и трансформируем данные
        const validatedData = updateProfileSchema.parse(request.body);

        const user = await authService.updateUser(targetId, {
          city: validatedData.city,
          phone: validatedData.phone,
          website: validatedData.website,
          familyStatus: validatedData.familyStatus,
          about: validatedData.about,
          gender: validatedData.gender,
        });

        return { user };
      } catch (error: any) {
        // Универсальная обработка ошибок Zod (работает и для v3, и для v4)
        const issues = error?.issues || error?.errors;
        if (issues && Array.isArray(issues)) {
          const messages = issues
            .map((e: any) => e.message || "Неверный формат данных")
            .join(", ");
          return reply.status(400).send({
            error: "Ошибка валидации данных",
            details: messages,
          });
        }

        console.error("Ошибка обновления профиля:", error);
        return reply.status(400).send({
          error: error.message || "Ошибка обновления профиля",
        });
      }
    },
  );
};
