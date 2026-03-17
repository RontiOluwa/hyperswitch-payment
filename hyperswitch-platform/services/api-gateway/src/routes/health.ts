import type { FastifyInstance } from 'fastify';
import { successResponse } from '@platform/shared-utils';

export const healthRoutes = async (app: FastifyInstance) => {
    // Public health check — no auth required
    app.get(
        '/health',
        { config: { skipAuth: true } },
        async (request, reply) => {
            const redisHealthy = await app.redis.ping().then(() => true).catch(() => false);

            const status = redisHealthy ? 'healthy' : 'degraded';

            return reply.status(redisHealthy ? 200 : 503).send(
                successResponse({
                    status,
                    service: 'api-gateway',
                    timestamp: new Date().toISOString(),
                    dependencies: {
                        redis: redisHealthy ? 'healthy' : 'unhealthy',
                    },
                })
            );
        }
    );
};