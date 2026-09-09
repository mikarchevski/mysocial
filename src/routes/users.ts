// src/routes/users.ts
import { FastifyPluginAsync } from 'fastify';
import AuthService from '../services/auth.service.js';

const authService = new AuthService();

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return reply.status(400).send({ error: 'Некорректный ID' });
    }

    try {
      const user = await authService.getUserById(userId);
      return { user };
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  // Обновление профиля (только свой)
  app.put('/:id', {
    preValidation: [(app as any).authenticate]
  }, async (request, reply) => {
    const currentUserId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const targetId = parseInt(id, 10);

    if (currentUserId !== targetId) {
      return reply.status(403).send({ error: 'Можно редактировать только свой профиль' });
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
  });
};