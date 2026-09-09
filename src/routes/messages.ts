// src/routes/messages.ts
import { FastifyPluginAsync } from 'fastify';
import MessagesService from '../services/messages.service.js';

const messagesService = new MessagesService();

export const messageRoutes: FastifyPluginAsync = async (app) => {
  // Количество непрочитанных диалогов
  app.get('/unread-count', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const count = await messagesService.getUnreadDialogsCount(userId);
    return { unreadDialogs: count };
  });

  // Список диалогов
  app.get('/dialogs', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const filter = (request.query as any).filter || 'all';
    const dialogs = await messagesService.getDialogs(userId, filter);
    return { dialogs };
  });

  // Сообщения конкретного диалога
  app.get('/dialog/:userId', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const currentUserId = (request.user as any).userId;
    const partnerId = parseInt((request.params as any).userId, 10);

    if (isNaN(partnerId)) {
      return reply.status(400).send({ error: 'Некорректный ID' });
    }

    const messages = await messagesService.getDialogMessages(currentUserId, partnerId);
    return { messages };
  });

  // Отправка сообщения
  app.post('/send', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const senderId = (request.user as any).userId;
    const { recipientId, encryptedContent, encryptedKey } = request.body as any;

    if (!recipientId || !encryptedContent) {
      return reply.status(400).send({ error: 'Не указаны получатель или сообщение' });
    }

    const message = await messagesService.sendMessage(
      senderId,
      parseInt(recipientId, 10),
      encryptedContent,
      encryptedKey || ''
    );

    return { message };
  });

  // Поиск пользователей
  app.get('/search', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const query = (request.query as any).q || '';
    const currentUserId = (request.user as any).userId;

    if (query.length < 2) {
      return { users: [] };
    }

    const users = await messagesService.searchUsers(query, currentUserId);
    return { users };
  });
};