// src/routes/friends.ts
import { FastifyPluginAsync } from 'fastify';
import FriendsService from '../services/friends.service.js';

const friendsService = new FriendsService();

export const friendsRoutes: FastifyPluginAsync = async (app) => {
  // Получить список друзей
  app.get('/list', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const friends = await friendsService.getFriends(userId);
    return { friends };
  });

  // Получить список заявок в друзья
  app.get('/requests', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const requests = await friendsService.getFriendRequests(userId);
    return { requests };
  });

  // Получить количество заявок в друзья
  app.get('/requests/count', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const count = await friendsService.getFriendRequestsCount(userId);
    return { count };
  });

  // Отправить заявку в друзья
  app.post('/:userId', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const currentUserId = (request.user as any).userId;
    const { userId } = request.params as { userId: string };
    const targetUserId = parseInt(userId, 10);

    if (isNaN(targetUserId)) {
      return reply.status(400).send({ error: 'Некорректный ID' });
    }

    if (currentUserId === targetUserId) {
      return reply.status(400).send({ error: 'Нельзя отправить заявку самому себе' });
    }

    try {
      const request = await friendsService.sendFriendRequest(currentUserId, targetUserId);
      return { message: 'Заявка в друзья отправлена!', request };
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Принять заявку в друзья
  app.post('/accept/:requestId', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const currentUserId = (request.user as any).userId;
    const { requestId } = request.params as { requestId: string };
    const reqId = parseInt(requestId, 10);

    if (isNaN(reqId)) {
      return reply.status(400).send({ error: 'Некорректный ID заявки' });
    }

    try {
      const result = await friendsService.acceptFriendRequest(reqId, currentUserId);
      return result;
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Отклонить заявку в друзья
  app.post('/decline/:requestId', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const currentUserId = (request.user as any).userId;
    const { requestId } = request.params as { requestId: string };
    const reqId = parseInt(requestId, 10);

    if (isNaN(reqId)) {
      return reply.status(400).send({ error: 'Некорректный ID заявки' });
    }

    try {
      const result = await friendsService.declineFriendRequest(reqId, currentUserId);
      return result;
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });
};