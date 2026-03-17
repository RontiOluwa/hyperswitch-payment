# Webhook Service

Receives inbound webhooks from Hyperswitch, verifies their authenticity, persists raw events as a safety net, and queues them for reliable async processing via BullMQ. The most critical reliability component in the platform.

---

## Responsibilities

```
Hyperswitch
     │
     │  POST /webhooks/hyperswitch
     ▼
Webhook Service
     │
     ├── 1. Verify HMAC-SHA512 signature
     ├── 2. Persist raw event to webhook_logs
     ├── 3. Deduplicate by event ID
     ├── 4. Queue job in BullMQ (Redis)
     └── 5. Return 200 immediately
          │
          ▼ (background worker)
     ├── Notify Payment Service → update payment intent status
     └── Notify Medusa → trigger order state transition
```

---

## Port

`3002`

---

## Why Async Processing

Hyperswitch expects a 200 response within a few seconds. If your server takes too long or returns an error, Hyperswitch retries the webhook — causing duplicate processing. By returning 200 immediately and processing in the background, we decouple the response time from processing time and handle retries ourselves via BullMQ.

---

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/webhooks/hyperswitch` | HMAC signature | Receive Hyperswitch events |
| GET | `/webhooks/stats` | None | BullMQ queue stats |
| GET | `/health` | None | Health check |

---

## Signature Verification

Every inbound webhook is verified against the `x-webhook-signature-512` header using HMAC-SHA512 with your `HYPERSWITCH_WEBHOOK_SECRET`. Requests with missing or invalid signatures are rejected with 401 before any database interaction.

`crypto.timingSafeEqual` is used for the comparison to prevent timing attacks.

---

## Deduplication

Two layers of deduplication prevent the same event from being processed twice:

**Layer 1 — Database:** Before queuing, the service checks if the event ID already exists in `webhook_logs`. If it does, returns 200 immediately without queuing.

**Layer 2 — BullMQ:** Jobs are added with `jobId: eventId`. BullMQ drops duplicate job IDs silently.

---

## Retry Strategy

Failed jobs are retried with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | 16s |
| 5 | 32s |

After 5 failures the job is marked permanently failed and kept in Redis for 7 days for manual inspection and replay.

---

## Testing Webhooks Locally

Generate a valid signature and fire a test event using Node.js:

```bash
node -e "
const crypto = require('crypto');
const { execSync } = require('child_process');

const secret = 'your_webhook_secret';
const payloadObj = {
  id: 'evt_test_001',
  type: 'payment_intent.succeeded',
  timestamp: '2025-03-10T14:30:00Z',
  data: {
    object: {
      payment_id: 'pay_test_123',
      id: 'pay_test_123',
      status: 'succeeded',
      amount: 5000,
      currency: 'USD'
    }
  },
  merchantId: 'merchant_001'
};

const payloadStr = JSON.stringify(payloadObj);
const signature = crypto.createHmac('sha512', secret).update(payloadStr).digest('hex');

const result = execSync(
  \`curl -s -X POST http://localhost:3002/webhooks/hyperswitch \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-signature-512: \${signature}' \
  -d '\${payloadStr}'\`
);
process.stdout.write(result);
"
```

---

## Environment Variables

```bash
NODE_ENV=development
PORT=3002

DATABASE_URL=postgresql://platform_user:password@localhost:5432/hyperswitch_platform

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

INTERNAL_SERVICE_SECRET=

HYPERSWITCH_WEBHOOK_SECRET=

PAYMENT_SERVICE_URL=http://localhost:3001
MEDUSA_URL=http://localhost:9000
```

---

## Folder Structure

```
src/
  config/
    env.ts                   ← Zod env validation
  plugins/
    redis.ts                 ← Redis connection (maxRetriesPerRequest: null for BullMQ)
    auth.ts                  ← Internal service token verification
  queues/
    webhook.queue.ts         ← BullMQ queue definition + job shape
  workers/
    webhook.worker.ts        ← BullMQ worker — actual processing logic
  routes/
    webhook.ts               ← POST /webhooks/hyperswitch
    health.ts                ← GET /health
  index.ts                   ← Fastify app + raw body parser + worker start
```

---

## Queue Stats

```bash
curl http://localhost:3002/webhooks/stats
```

```json
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 0,
    "completed": 14,
    "failed": 0,
    "delayed": 0
  }
}
```

---

## Running Locally

```bash
npm install
npm run dev
```

The BullMQ worker starts automatically alongside the HTTP server in the same process.
