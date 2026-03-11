import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { env } from '../config/env';
import { createLogger } from '@platform/shared-utils';

const logger = createLogger('api-gateway:redis');

declare module 'fastify' {
    interface FastifyInstance {
        redis: Redis;
    }
}

export const redisPlugin = fp(async (app) => {
    const redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        retryStrategy: (times) => {
            const delay = Math.min(times * 500, 30_000);
            logger.warn({ attempt: times, delay }, 'Redis reconnecting...');
            return delay;
        },
        maxRetriesPerRequest: 3,
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error({ err }, 'Redis error'));

    await redis.ping();

    app.decorate('redis', redis);

    app.addHook('onClose', async () => {
        await redis.quit();
        logger.info('Redis disconnected');
    });
});