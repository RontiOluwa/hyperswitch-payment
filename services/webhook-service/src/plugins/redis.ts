import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { env } from '../config/env';
import { createLogger } from '@platform/shared-utils';

const logger = createLogger('webhook-service:redis');

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
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => Math.min(times * 500, 30_000),
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error({ err }, 'Redis error'));

  await redis.ping();
  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
});
