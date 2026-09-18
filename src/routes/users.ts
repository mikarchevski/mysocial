// src/routes/users.ts
import { FastifyPluginAsync } from "fastify";
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
