import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@platform/database';
import { createLogger } from '@platform/shared-utils';
import { env } from '../config/env';
import type { WebhookJobData } from '../queues/webhook.queue';

const logger = createLogger('webhook-service:worker');

// ─── Downstream service callers ───────────────────────────────────────────────

import jwt from 'jsonwebtoken';

const generateServiceToken = () =>
  jwt.sign(
    { type: 'service', service: 'webhook-service' },
    env.INTERNAL_SERVICE_SECRET,
    { expiresIn: '60s' }
  );

// Notify Payment Service to update payment intent status
const notifyPaymentService = async (
  hyperswitchPaymentId: string,
  status: string,
  rawData: Record<string, unknown>
) => {
  const response = await fetch(
    `${env.PAYMENT_SERVICE_URL}/payment-intents/webhook-update`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${generateServiceToken()}`,
        'X-Identity-Type': 'service',
      },
      body: JSON.stringify({ hyperswitchPaymentId, status, rawData }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Payment service update failed: ${JSON.stringify(error)}`);
  }
};

// Notify Medusa to trigger order state transition
const notifyMedusa = async (
  eventType: string,
  hyperswitchPaymentId: string,
  rawPayload: Record<string, unknown>
) => {
  // Medusa listens on its event bus
  // We call its internal webhook endpoint which maps HS events to order transitions
  const response = await fetch(
    `${env.MEDUSA_URL}/hooks/payment/hyperswitch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Medusa uses its own internal secret for service calls
        'x-medusa-signature': generateServiceToken(),
      },
      body: JSON.stringify({
        event_type: eventType,
        payment_id: hyperswitchPaymentId,
        data: rawPayload,
      }),
    }
  );

  // Medusa not being available should not fail the webhook job
  // Orders can be reconciled manually — payment state is the source of truth
  if (!response.ok) {
    logger.warn(
      { eventType, hyperswitchPaymentId, status: response.status },
      'Medusa notification failed — will continue'
    );
  }
};

// ─── Job processor ────────────────────────────────────────────────────────────

const processWebhookJob = async (job: Job<WebhookJobData>) => {
  const { webhookLogId, eventId, eventType, hyperswitchPaymentId, status, rawPayload } = job.data;

  logger.info({ jobId: job.id, eventId, eventType }, 'Processing webhook job');

  try {
    // Step 1 — Update Payment Service
    await notifyPaymentService(hyperswitchPaymentId, status, rawPayload);
    logger.info({ eventId }, 'Payment service notified');

    // Step 2 — Notify Medusa (non-blocking — failure does not fail the job)
    await notifyMedusa(eventType, hyperswitchPaymentId, rawPayload);
    logger.info({ eventId }, 'Medusa notified');

    // Step 3 — Mark webhook log as processed
    await prisma.webhookLog.update({
      where: { id: webhookLogId },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    logger.info({ jobId: job.id, eventId }, 'Webhook job completed');

  } catch (err) {
    // Mark the error on the webhook log for inspection
    await prisma.webhookLog.update({
      where: { id: webhookLogId },
      data: {
        error: err instanceof Error ? err.message : 'Unknown error',
        retryCount: { increment: 1 },
      },
    }).catch(() => {}); // Do not throw here — let BullMQ handle the retry

    throw err; // Re-throw so BullMQ knows the job failed and should retry
  }
};

// ─── Start Worker ─────────────────────────────────────────────────────────────

const connection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const startWebhookWorker = () => {
  const worker = new Worker<WebhookJobData>(
    'webhook-processing',
    processWebhookJob,
    {
      connection,
      concurrency: 5, // Process up to 5 jobs simultaneously
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, eventId: job.data.eventId }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, eventId: job?.data.eventId, err: err.message },
      'Job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  logger.info('Webhook worker started');

  return worker;
};
