import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@platform/database';
import { createLogger } from '@platform/shared-utils';
import { env } from '../config/env';
import { webhookQueue } from '../queues/webhook.queue';

const logger = createLogger('webhook-service:routes');

// ─── Signature Verification ───────────────────────────────────────────────────

const verifyHyperswitchSignature = (
  rawBody: string,
  signature: string,
  secret: string
): boolean => {
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export const webhookRoutes = async (app: FastifyInstance) => {

  app.post(
    '/webhooks/hyperswitch',
    { config: { skipAuth: true, rawBody: true } },
    async (request, reply) => {
      const rawBody = (request as any).rawBody as string;

      // ── Step 1: Signature check (production only) ─────────────────────────
      if (env.NODE_ENV === 'production' && env.HYPERSWITCH_WEBHOOK_SECRET) {
        const signature = request.headers['x-webhook-signature-512'] as string;

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
      }

      // ── Step 2: Parse payload ─────────────────────────────────────────────
      let payload: Record<string, any>;

      try {
        payload = JSON.parse(rawBody);
      } catch (err) {
        logger.error({ rawBody }, 'Failed to parse webhook body as JSON');
        return reply.status(400).send({ error: 'Invalid JSON' });
      }

      // Log the full payload so we can see exactly what Hyperswitch sends
      logger.info({ payload }, 'Parsed webhook payload');
      logger.info({ keys: Object.keys(payload) }, 'Top level payload keys');

      // ── Step 3: Extract event ID and type ─────────────────────────────────
      // Handle all possible Hyperswitch payload structures
      const eventId = String(
        payload.event_id ??
        payload.id ??
        payload.eventId ??
        `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
      );

      const eventType = String(
        payload.event_type ??
        payload.type ??
        payload.eventType ??
        'unknown'
      );

      logger.info({ eventId, eventType }, 'Extracted event ID and type');

      // ── Step 4: Extract payment data ──────────────────────────────────────
      // Hyperswitch may nest data differently — try all known structures
      const content =
        payload.content ??
        payload.data?.object ??
        payload.data ??
        payload;

      const hyperswitchPaymentId = String(
        content?.payment_id ??
        content?.id ??
        payload.payment_id ??
        ''
      );

      const status = String(
        content?.status ??
        payload.status ??
        ''
      );

      logger.info({ hyperswitchPaymentId, status }, 'Extracted payment data');

      // ── Step 5: Deduplication check ───────────────────────────────────────
      // Use findFirst instead of findUnique to avoid errors on undefined
      const existing = await prisma.webhookLog.findFirst({
        where: { eventId },
      }).catch(() => null);

      if (existing) {
        logger.info({ eventId }, 'Duplicate webhook — skipping');
        return reply.status(200).send({ received: true, duplicate: true });
      }

      // ── Step 6: Persist raw event BEFORE processing ───────────────────────
      const webhookLog = await prisma.webhookLog.create({
        data: {
          eventId,
          eventType,
          rawPayload: payload,
          source: 'hyperswitch',
        },
      });

      logger.info({ webhookLogId: webhookLog.id }, 'Webhook log created');

      // ── Step 7: Queue for async processing ───────────────────────────────
      if (hyperswitchPaymentId && status) {
        await webhookQueue.add(
          eventType,
          {
            webhookLogId: webhookLog.id,
            eventId: String(eventId),
            eventType: String(eventType),
            hyperswitchPaymentId: String(hyperswitchPaymentId),
            status: String(status),
            rawPayload: payload as Record<string, unknown>,
          },
          { jobId: String(eventId) }
        );

        logger.info({ eventId, eventType }, 'Webhook queued for processing');
      } else {
        logger.warn(
          { eventId, eventType, hyperswitchPaymentId, status },
          'Could not extract payment data — saved log but not queued'
        );
      }

      // ── Step 8: Respond fast ──────────────────────────────────────────────
      return reply.status(200).send({ received: true });
    }
  );

  // Queue stats endpoint
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