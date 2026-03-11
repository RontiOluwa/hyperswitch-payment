import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';

// The shape of every job we put on the queue
export interface WebhookJobData {
  webhookLogId: string;           // DB record ID — worker fetches full data from here
  eventId: string;                // Hyperswitch event ID
  eventType: string;              // e.g. payment_intent.succeeded
  hyperswitchPaymentId: string;
  status: string;                 // new payment status from Hyperswitch
  rawPayload: Record<string, unknown>;
}

// Separate Redis connection for BullMQ
// BullMQ requires maxRetriesPerRequest: null on its connection
const connection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const webhookQueue = new Queue<WebhookJobData>('webhook-processing', {
  connection,
  defaultJobOptions: {
    attempts: 5,                  // Retry up to 5 times before marking failed
    backoff: {
      type: 'exponential',
      delay: 2000,                // Start at 2s, then 4s, 8s, 16s, 32s
    },
    removeOnComplete: {
      age: 24 * 3600,            // Keep completed jobs for 24 hours
      count: 1000,               // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600,       // Keep failed jobs for 7 days for inspection
    },
  },
});

export const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
    webhookQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};
