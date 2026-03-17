import type { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '@platform/database';
import { successResponse } from '@platform/shared-utils';
import { getQueueStats } from '../queues/webhook.queue';

export const healthRoutes = async (app: FastifyInstance) => {
  app.get('/health', { config: { skipAuth: true } }, async (request, reply) => {
    const [dbHealthy, redisHealthy, queueStats] = await Promise.all([
      checkDatabaseHealth(),
      app.redis.ping().then(() => true).catch(() => false),
      getQueueStats().catch(() => null),
    ]);

    const healthy = dbHealthy && redisHealthy;

    return reply.status(healthy ? 200 : 503).send(
      successResponse({
        status: healthy ? 'healthy' : 'degraded',
        service: 'webhook-service',
        timestamp: new Date().toISOString(),
        dependencies: {
          database: dbHealthy ? 'healthy' : 'unhealthy',
          redis: redisHealthy ? 'healthy' : 'unhealthy',
        },
        queue: queueStats,
      })
    );
  });
};
