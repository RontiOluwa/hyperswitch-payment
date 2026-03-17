# Payment Service

Owns all payment logic. The only service that communicates directly with the Hyperswitch API. Manages payment intents, confirmations, cancellations, refunds, and maintains an append-only audit log of every payment event.

---

## Responsibilities

```
API Gateway
     │
     ▼
Payment Service
     │
     ├── Hyperswitch API   (create / confirm / cancel / refund)
     ├── PostgreSQL        (persist intents, events, refunds)
     └── Redis             (idempotency cache)
```

---

## Port

`3001`

---

## Authentication

Accepts requests from the API Gateway only. Every request must carry a short-lived internal service JWT:

```
Authorization: Bearer <internal_service_token>
```

Signed with `INTERNAL_SERVICE_SECRET`. Tokens expire after 60 seconds.

---

## Endpoints

All endpoints require the internal service token. Identity context is passed via headers set by the gateway.

| Method | Path | Description |
|---|---|---|
| POST | `/payment-intents` | Create a new payment intent |
| GET | `/payment-intents` | List payment intents for a customer |
| GET | `/payment-intents/:id` | Get a single payment intent |
| POST | `/payment-intents/:id/confirm` | Confirm and process a payment |
| POST | `/payment-intents/:id/cancel` | Cancel a payment intent |
| POST | `/payment-intents/:id/refund` | Initiate a refund |
| POST | `/payment-intents/webhook-update` | Internal — called by Webhook Service |
| GET | `/health` | Health check |

---

## Idempotency

Every `createPaymentIntent` call generates a deterministic idempotency key from:

```
SHA-256(orderId + customerId + amount + currency + hourBucket)
```

If the same combination is submitted within the same hour, the existing payment intent is returned instead of creating a duplicate. This prevents double charges on network retries or accidental double-clicks.

---

## Audit Log

Every state change appends a record to `payment_events`. This table is append-only — records are never updated or deleted. It provides a complete history of every payment:

```
intent_created → intent_confirmed → payment_processing → payment_succeeded
```

---

## Environment Variables

```bash
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://platform_user:password@localhost:5432/hyperswitch_platform

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

INTERNAL_SERVICE_SECRET=

HYPERSWITCH_API_KEY=
HYPERSWITCH_BASE_URL=https://sandbox.hyperswitch.io
```

---

## Folder Structure

```
src/
  config/
    env.ts                    ← Zod env validation
  hyperswitch/
    client.ts                 ← Hyperswitch API wrapper (all HS calls live here)
  repositories/
    payment.repository.ts     ← Database queries — no business logic
  services/
    payment.service.ts        ← Business logic — no HTTP concerns
  plugins/
    auth.ts                   ← Internal service token verification
  routes/
    payment-intents.ts        ← Route handlers
    health.ts                 ← GET /health
  index.ts                    ← Fastify app entry point
```

---

## Architecture Pattern

Three distinct layers with strict separation:

**Routes** — handle HTTP concerns only. Parse and validate request body with Zod, call the service layer, send the response. No database or business logic.

**Service** — all business logic lives here. Idempotency checks, state validation, status mapping, event logging. No direct database queries and no HTTP concerns.

**Repository** — all database queries live here. No business logic. Returns raw Prisma objects.

**Hyperswitch Client** — all Hyperswitch API calls isolated here. If the PSP ever changes, only this file changes.

---

## Running Locally

```bash
npm install
npm run dev
```

---

## Health Check

```bash
curl http://localhost:3001/health
```

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "payment-service",
    "dependencies": {
      "database": "healthy"
    }
  }
}
```
