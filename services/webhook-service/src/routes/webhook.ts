import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@platform/database';
import { createLogger } from '@platform/shared-utils';
import { env } from '../config/env';
import { webhookQueue } from '../queues/webhook.queue';
import type { WebhookEvent } from '@platform/shared-types';

const logger = createLogger('webhook-service:routes');

// ─── Signature Verification ───────────────────────────────────────────────────

// Hyperswitch signs every webhook with HMAC-SHA512
// If signature does not match we reject immediately — could be a spoofed request
const verifyHyperswitchSignature = (
  rawBody: string,
  signature: string,
  secret: string
): boolean => {
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
};

// ─── Extract payment ID and status from Hyperswitch payload ──────────────────

const extractPaymentData = (payload: WebhookEvent): {
  hyperswitchPaymentId: string;
  status: string;
} | null => {
  const obj = payload.data?.object as Record<string, unknown>;

  if (!obj) return null;

  return {
    hyperswitchPaymentId: (obj.payment_id ?? obj.id) as string,
    status: obj.status as string,
  };
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export const webhookRoutes = async (app: FastifyInstance) => {

  // Hyperswitch sends webhook here
  // IMPORTANT: We need the raw body string for signature verification
  // Fastify parses JSON by default — we override content type handling for this route
  app.post(
    '/webhooks/hyperswitch',
    {
      config: { skipAuth: true, rawBody: true },
    },
    async (request, reply) => {
      const rawBody = (request as any).rawBody as string;
      const signature = request.headers['x-webhook-signature-512'] as string;

      // ── Step 1: Verify signature ──────────────────────────────────────────
      if (!signature) {
        logger.warn('Webhook received without signature header');
        return reply.status(401).send({ error: 'Missing signature' });
      }

      const isValid = verifyHyperswitchSignature(
        rawBody,
        signature,
        env.HYPERSWITCH_WEBHOOK_SECRET
      );

      if (!isValid) {
        logger.warn('Webhook signature verification failed');
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const payload = JSON.parse(rawBody) as WebhookEvent;
      const { type: eventType, id: eventId } = payload;

      logger.info({ eventId, eventType }, 'Webhook received');

      // ── Step 2: Deduplication check ───────────────────────────────────────
      // If we have already processed this event ID skip it
      const existing = await prisma.webhookLog.findUnique({
        where: { eventId },
      });

      if (existing) {
        logger.info({ eventId }, 'Duplicate webhook — skipping');
        // Still return 200 — Hyperswitch must not retry
        return reply.status(200).send({ received: true, duplicate: true });
      }

      // ── Step 3: Persist raw event BEFORE processing ───────────────────────
      // This is the safety net — even if the queue fails the raw event is stored
      const webhookLog = await prisma.webhookLog.create({
        data: {
          eventId,
          eventType,
          rawPayload: payload as any,
          source: 'hyperswitch',
        },
      });

      // ── Step 4: Extract payment data ──────────────────────────────────────
      const paymentData = extractPaymentData(payload);

      if (!paymentData) {
        logger.warn({ eventType, eventId }, 'Could not extract payment data — skipping queue');
        return reply.status(200).send({ received: true });
      }

      // ── Step 5: Queue for async processing ───────────────────────────────
      // We respond to Hyperswitch immediately and process in background
      // This prevents timeouts and duplicate retries from Hyperswitch
      await webhookQueue.add(
        eventType,
        {
          webhookLogId: webhookLog.id,
          eventId,
          eventType,
          hyperswitchPaymentId: paymentData.hyperswitchPaymentId,
          status: paymentData.status,
          rawPayload: payload as unknown as Record<string, unknown>,
        },
        {
          // Job ID = event ID — BullMQ deduplication layer
          // If somehow the same event gets queued twice BullMQ drops the duplicate
          jobId: eventId,
        }
      );

      logger.info({ eventId, eventType }, 'Webhook queued for processing');

      // ── Step 6: Respond fast ──────────────────────────────────────────────
      // Hyperswitch expects 200 within a few seconds
      // If we do not respond fast enough it will retry — causing duplicates
      return reply.status(200).send({ received: true });
    }
  );

  // Queue stats endpoint — useful for monitoring
  app.get(
    '/webhooks/stats',
    { config: { skipAuth: true } },
    async (request, reply) => {
      const { getQueueStats } = await import('../queues/webhook.queue');
      const stats = await getQueueStats();
      return reply.send({ success: true, data: stats });
    }
  );
};
