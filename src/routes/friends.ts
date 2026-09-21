// src/routes/friends.ts
import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm"; // ✅ Добавлено для поиска заявки
import { db } from "../db/index.js"; // ✅ Добавлено для запроса к БД
import { friendRequests, friends } from "../db/schema.js"; // ✅ Исправлена опечатка (убран /)
import FriendsService from "../services/friends.service.js";
import {
  notifyUserOfFriendRequest,
  notifyUserOfFriendRequestAccepted,
  notifyUserOfFriendRequestDeclined,
} from "../plugins/websocket.js";

const friendsService = new FriendsService();

export const friendsRoutes: FastifyPluginAsync = async (app) => {
  // Получить список друзей
  app.get(
    "/list",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const searchQuery = (request.query as any).search || "";

      const friendsList = await friendsService.getFriends(userId);

      if (searchQuery) {
        const filteredFriends = friendsList.filter(
          (friend) =>
            friend.firstName
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            friend.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `${friend.firstName} ${friend.lastName}`
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
        );
        return { friends: filteredFriends };
      }

      return { friends: friendsList };
    },
  );

  // Получить список заявок в друзья
  app.get(
    "/requests",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const requests = await friendsService.getFriendRequests(userId);
      return { requests };
    },
  );

  // Получить количество заявок в друзья
  app.get(
    "/requests/count",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const count = await friendsService.getFriendRequestsCount(userId);
      return { count };
    },
  );

  // ✅ 1. ОТПРАВИТЬ ЗАЯВКУ В ДРУЗЬЯ
  app.post(
    "/:userId",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const currentUserId = (request.user as any).userId;
      const { userId } = request.params as { userId: string };
      const targetUserId = parseInt(userId, 10);

      if (isNaN(targetUserId)) {
        return reply.status(400).send({ error: "Некорректный ID" });
      }

      if (currentUserId === targetUserId) {
        return reply
          .status(400)
          .send({ error: "Нельзя отправить заявку самому себе" });
      }

      try {
        await friendsService.sendFriendRequest(currentUserId, targetUserId);

        // ✅ УВЕДОМЛЯЕМ ПОЛУЧАТЕЛЯ ЗАЯВКИ
        notifyUserOfFriendRequest(targetUserId, currentUserId);

        return { message: "Заявка в друзья отправлена!" };
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  );

  // ✅ 2. ПРИНЯТЬ ЗАЯВКУ В ДРУЗЬЯ
  app.post(
    "/accept/:requestId",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const currentUserId = (request.user as any).userId;
      const { requestId } = request.params as { requestId: string };
      const reqId = parseInt(requestId, 10);

      if (isNaN(reqId)) {
        return reply.status(400).send({ error: "Некорректный ID заявки" });
      }

      try {
        // 1. Находим заявку, чтобы узнать, кого уведомить (кто её отправил)
        const [reqData] = await db
          .select()
          .from(friendRequests)
          .where(eq(friendRequests.id, reqId));

        if (!reqData || reqData.toUserId !== currentUserId) {
          return reply
            .status(404)
            .send({ error: "Заявка не найдена или уже обработана" });
        }

        // 2. Принимаем заявку через сервис
        const result = await friendsService.acceptFriendRequest(
          reqId,
          currentUserId,
        );

        // 3. ✅ УВЕДОМЛЯЕМ ОТПРАВИТЕЛЯ ЗАЯВКИ
        notifyUserOfFriendRequestAccepted(reqData.fromUserId, currentUserId);

        return result;
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  );

  // ✅ 3. ОТКЛОНИТЬ ЗАЯВКУ В ДРУЗЬЯ
  app.post(
    "/decline/:requestId",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const currentUserId = (request.user as any).userId;
      const { requestId } = request.params as { requestId: string };
      const reqId = parseInt(requestId, 10);

      if (isNaN(reqId)) {
        return reply.status(400).send({ error: "Некорректный ID заявки" });
      }

      try {
        // 1. Находим заявку, чтобы узнать, кого уведомить
        const [reqData] = await db
          .select()
          .from(friendRequests)
          .where(eq(friendRequests.id, reqId));

        if (!reqData || reqData.toUserId !== currentUserId) {
          return reply
            .status(404)
            .send({ error: "Заявка не найдена или уже обработана" });
        }

        // 2. Отклоняем заявку через сервис
        const result = await friendsService.declineFriendRequest(
          reqId,
          currentUserId,
        );

        // 3. ✅ УВЕДОМЛЯЕМ ОТПРАВИТЕЛЯ ЗАЯВКИ
        notifyUserOfFriendRequestDeclined(reqData.fromUserId, currentUserId);

        return result;
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    },
  );

  // Получить статус дружбы с пользователем
  app.get(
    "/status/:userId",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const currentUserId = (request.user as any).userId;
      const { userId } = request.params as { userId: string };
      const targetUserId = parseInt(userId, 10);

      if (isNaN(targetUserId)) {
        return reply.status(400).send({ error: "Некорректный ID" });
      }

      if (currentUserId === targetUserId) {
        return reply
          .status(400)
          .send({ error: "Нельзя проверить статус с самим собой" });
      }

      try {
        const status = await friendsService.getFriendshipStatus(
          currentUserId,
          targetUserId,
        );
        return { status };
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  );

  // Удалить из друзей
  app.delete(
    "/:userId",
    { preValidation: [(app as any).authenticate] },
    async (request, reply) => {
      const currentUserId = (request.user as any).userId;
      const { userId } = request.params as { userId: string };
      const targetUserId = parseInt(userId, 10);

      if (isNaN(targetUserId)) {
        return reply
          .status(400)
          .send({ error: "Некорректный ID пользователя" });
      }

      if (currentUserId === targetUserId) {
        return reply
          .status(400)
          .send({ error: "Нельзя выполнить это действие с самим собой" });
      }

      try {
        const result = await friendsService.removeFriend(
          currentUserId,
          targetUserId,
        );

        // (Опционально) Можно добавить уведомление об удалении из друзей:
        // notifyUserOfFriendRemoved(targetUserId, currentUserId);

        return result;
      } catch (error: any) {
        console.error("Ошибка при удалении из друзей:", error);
        return reply
          .status(400)
          .send({ error: error.message || "Ошибка при удалении из друзей" });
      }
    },
  );
};
