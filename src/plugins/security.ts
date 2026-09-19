// src/plugins/security.ts
import { FastifyPluginAsync } from "fastify";

export const securityPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (request.body && typeof request.body === "object") {
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /union\s+select/i,
        /;\s*drop\s+table/i,
      ];

      const bodyString = JSON.stringify(request.body);

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(bodyString)) {
          app.log.warn(
            {
              url: request.url,
              ip: request.ip,
              body: request.body,
            },
            "⚠️ Подозрительный запрос обнаружен",
          );
        }
      }
    }
  });
};
