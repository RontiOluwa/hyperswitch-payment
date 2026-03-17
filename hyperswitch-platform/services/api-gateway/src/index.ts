import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env } from './config/env';
import { redisPlugin } from './plugins/redis';
import { authPlugin } from './plugins/auth';
import { rateLimitPlugin } from './plugins/rate-limit';
import { healthRoutes } from './routes/health';
import { paymentRoutes } from './routes/payments';
import { orderRoutes } from './routes/orders';
import { createLogger, isAppError } from '@platform/shared-utils';

const logger = createLogger('api-gateway');

const app = Fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
});

const start = async () => {

    console.log('Server STARTED')
    try {

        // ── Security headers
        await app.register(helmet, {
            contentSecurityPolicy: false, // Gateway only — no HTML served
        });

        // ── CORS
        await app.register(cors, {
            origin: env.NODE_ENV === 'production'
                ? ['https://yourfrontend.com']
                : true,
            credentials: true,
        });

        // ── Infrastructure plugins (order matters)
        await app.register(redisPlugin);
        await app.register(authPlugin);
        await app.register(rateLimitPlugin);

        // ── Routes
        await app.register(healthRoutes);
        await app.register(paymentRoutes, { prefix: '/api/v1' });
        await app.register(orderRoutes, { prefix: '/api/v1' });

        // ── Global error handler
        app.setErrorHandler((error, request, reply) => {
            if (isAppError(error)) {
                logger.warn({
                    code: error.code,
                    statusCode: error.statusCode,
                    path: request.url,
                    method: request.method,
                }, error.message);

                return reply.status(error.statusCode).send({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                        details: error.details,
                    },
                });
            }

            // Unexpected error — do not leak internals
            logger.error({ error, path: request.url }, 'Unhandled error');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Something went wrong',
                },
            });
        });

        // ── Start server
        await app.listen({ port: env.PORT, host: '0.0.0.0' });

        logger.info(`API Gateway running on port ${env.PORT}`);

    } catch (err) {
        logger.error({ err }, 'Failed to start API Gateway');
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    await app.close();
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();