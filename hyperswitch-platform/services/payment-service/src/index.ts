import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { env } from './config/env';
import { authPlugin } from './plugins/auth';
import { healthRoutes } from './routes/health';
import { paymentIntentRoutes } from './routes/payment-intents';
import { createLogger, isAppError } from '@platform/shared-utils';
import { disconnectDatabase } from '@platform/database';

const logger = createLogger('payment-service');

const app = Fastify({ logger: false, trustProxy: true });

const start = async () => {
    try {
        await app.register(helmet, { contentSecurityPolicy: false });
        await app.register(authPlugin);

        await app.register(healthRoutes);
        await app.register(paymentIntentRoutes);

        app.setErrorHandler((error, request, reply) => {
            if (isAppError(error)) {
                logger.warn({ code: error.code, path: request.url }, error.message);
                return reply.status(error.statusCode).send({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                        details: error.details,
                    },
                });
            }

            logger.error({ error, path: request.url }, 'Unhandled error');
            return reply.status(500).send({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
            });
        });

        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        logger.info(`Payment service running on port ${env.PORT}`);

    } catch (err) {
        logger.error({ err }, 'Failed to start payment service');
        process.exit(1);
    }
};

const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    await disconnectDatabase();
    await app.close();
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();