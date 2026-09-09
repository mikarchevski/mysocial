// src/types/fastify.d.ts
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: number;
      iat?: number;
      exp?: number;
    };
    user: {
      userId: number;
    };
  }
}