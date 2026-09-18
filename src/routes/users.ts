// src/routes/users.ts
import { FastifyPluginAsync } from "fastify";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import AuthService from "../services/auth.service.js";

const authService = new AuthService();

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // 1. ПОЛУЧИТЬ ДАННЫЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ (Строгий маршрут)
  // Должен быть ПЕРВЫМ, чтобы перехватить запрос /me до того, как он попадет в /:id
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
  
  app.get("/search",{preValidation: [(app as any).authenticate],},
    async (request, reply) => {
      const { q } = request.query as { q?: string };
      const currentUserId = (request.user as any).userId;

      // Валидация: минимум 2 символа для поиска
      if (!q || q.trim().length < 2) {
        return reply.status(400).send({ error: "Поисковый запрос должен содержать минимум 2 символа" });
      }

      const searchPattern = `%${q.trim()}%`;

      try {
        // Ищем по имени, фамилии или городу, исключая текущего пользователя
        const results = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            city: users.city,
            // Добавь avatarUrl или другие поля, если они есть в твоей схеме
          })
          .from(users)
          .where(
            and(
              sql`${users.id} != ${currentUserId}`, // Не показывать себя в результатах
              or(
                ilike(users.firstName, searchPattern),
                ilike(users.lastName, searchPattern),
                ilike(users.city, searchPattern)
              )
            )
          )
          .limit(20); // Ограничиваем выдачу 20 результатами

        return { users: results, count: results.length };
      } catch (error) {
        console.error("Ошибка поиска пользователей:", error);
        return reply.status(500).send({ error: "Внутренняя ошибка сервера при поиске" });
      }
    }
  );
  // 3. ОБНОВЛЕНИЕ ПРОФИЛЯ (Только свой)
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

      const { city, phone, website, familyStatus, about } = request.body as any;

      try {
        const user = await authService.updateUser(targetId, {
          city: city ?? undefined,
          phone: phone ?? undefined,
          website: website ?? undefined,
          familyStatus: familyStatus ?? undefined,
          about: about ?? undefined,
        });
        return { user };
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  );
};
