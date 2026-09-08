import { FastifyPluginAsync } from 'fastify';

export const messageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    return { message: 'Messages endpoint - TODO' };
  });
};