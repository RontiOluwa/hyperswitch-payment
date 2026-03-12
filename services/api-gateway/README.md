# API Gateway

The single entry point for all client traffic. Every request passes through this service before reaching any downstream service. Handles authentication, rate limiting, request validation, and proxying.

---

## Responsibilities

```
Incoming Request
      │
      ▼
┌─────────────────────────────────────┐
│            API Gateway              │
│                                     │
│  1. Auth       → JWT / API Key      │
│  2. Rate Limit → Redis sliding win  │
│  3. Validate   → Zod schema check   │
│  4. Proxy      → Forward to service │
└─────────────────────────────────────┘
```

---

## Port

`3000`

---

## Authentication

Two authentication schemes are supported:

**Bearer Token (Auth0 JWT)** — used by end customers authenticating via Auth0.

```
Authorization: Bearer <auth0_jwt>
```

The gateway verifies the JWT locally using JWKS public keys fetched from Auth0 and cached in Redis. No Auth0 API call on the hot path — verification takes ~1ms.

**ApiKey** — used by merchants making server-to-server requests.

```
Authorization: ApiKey <raw_api_key>
```

Keys are hashed with SHA-256 and looked up in Redis first, then PostgreSQL on cache miss. The raw key is never stored.

---

## Rate Limiting

Sliding window rate limiting via Redis. Default: **100 requests per minute**.

Keys are based on identity when available — customer ID, merchant ID, or IP as fallback. Limits can be configured per route.

---

## Routes

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check — no auth required |

### Payments (proxied to Payment Service)

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/payments` | Customer JWT |
| GET | `/api/v1/payments/:id` | Customer JWT or Merchant API Key |
| POST | `/api/v1/payments/:id/confirm` | Customer JWT |
| POST | `/api/v1/payments/:id/refund` | Customer JWT or Merchant API Key |

### Orders (proxied to Medusa)

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/orders` | Customer JWT |
| GET | `/api/v1/orders` | Customer JWT or Merchant API Key |
| GET | `/api/v1/orders/:id` | Customer JWT or Merchant API Key |

---

## Environment Variables

```bash
NODE_ENV=development
PORT=3000

# Auth0
AUTH0_DOMAIN=your_tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.your-platform.com

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Downstream services
PAYMENT_SERVICE_URL=http://localhost:3001
WEBHOOK_SERVICE_URL=http://localhost:3002
ORDER_SERVICE_URL=http://localhost:9000
NOTIFICATION_SERVICE_URL=http://localhost:3004

# Internal service auth (min 32 chars)
INTERNAL_SERVICE_SECRET=
```

---

## Folder Structure

```
src/
  config/
    env.ts              ← Zod env validation — fails fast on missing vars
  plugins/
    redis.ts            ← Redis connection + Fastify decorator
    auth.ts             ← JWT verification + API key validation
    rate-limit.ts       ← BullMQ sliding window rate limiter
  routes/
    health.ts           ← GET /health
    payments.ts         ← Payment routes proxy
    orders.ts           ← Order routes proxy
  index.ts              ← Fastify app + plugin registration + error handler
```

---

## Running Locally

```bash
npm install
npm run dev
```

---

## Health Check

```bash
curl http://localhost:3000/health
```

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "api-gateway",
    "timestamp": "2025-03-10T14:30:00.000Z",
    "dependencies": {
      "redis": "healthy"
    }
  }
}
```

---

## Identity Forwarding

After verifying a request, the gateway injects the caller's identity into headers before proxying downstream:

```
X-Customer-Id: auth0|64a3f2b1c8d9e0f1
X-Merchant-Id: merchant_abc123
X-Identity-Type: customer | merchant | service
Authorization: Bearer <internal_service_token>
```

Downstream services trust these headers because every request also carries a short-lived internal service JWT signed with `INTERNAL_SERVICE_SECRET`. Services verify this token before reading the identity headers.
