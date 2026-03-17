import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { env } from './config/env';
import { redisPlugin } from './plugins/redis';
import { authPlugin } from './plugins/auth';
import { healthRoutes } from './routes/health';
import { webhookRoutes } from './routes/webhook';
import { startWebhookWorker } from './workers/webhook.worker';
import { createLogger, isAppError } from '@platform/shared-utils';
import { disconnectDatabase } from '@platform/database';

const logger = createLogger('webhook-service');

const app = Fastify({
  logger: false,
  trustProxy: true,
  // We need the raw body for signature verification
  // Fastify does not expose this by default
  bodyLimit: 1048576, // 1MB max body
});

// Preserve raw body for signature verification
app.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body, done) => {
    try {
      (req as any).rawBody = body;
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  }
);

const start = async () => {
  try {
    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(redisPlugin);
    await app.register(authPlugin);

    await app.register(healthRoutes);
    await app.register(webhookRoutes);

    app.setErrorHandler((error, request, reply) => {
      if (isAppError(error)) {
        logger.warn({ code: error.code, path: request.url }, error.message);
        return reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }

      logger.error({ error, path: request.url }, 'Unhandled error');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
      });
    });

    // Start BullMQ worker alongside the HTTP server
    const worker = startWebhookWorker();

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`Webhook service running on port ${env.PORT}`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down...');
      await worker.close();
      await disconnectDatabase();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error({ err }, 'Failed to start webhook service');
    process.exit(1);
  }
};

start();
