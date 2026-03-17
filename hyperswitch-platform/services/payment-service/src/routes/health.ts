import type { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '@platform/database';
import { successResponse } from '@platform/shared-utils';

export const healthRoutes = async (app: FastifyInstance) => {
    app.get('/health', { config: { skipAuth: true } }, async (request, reply) => {
        const dbHealthy = await checkDatabaseHealth();
        const status = dbHealthy ? 'healthy' : 'degraded';

        return reply.status(dbHealthy ? 200 : 503).send(
            successResponse({
                status,
                service: 'payment-service',
                timestamp: new Date().toISOString(),
                dependencies: {
                    database: dbHealthy ? 'healthy' : 'unhealthy',
                },
            })
        );
    });
};