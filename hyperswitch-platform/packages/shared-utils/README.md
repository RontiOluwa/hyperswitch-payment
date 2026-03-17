# @platform/shared-utils

Runtime utilities shared across all services. Provides structured logging, typed error classes, consistent API response helpers, and idempotency key generation. Every service in the platform uses this package.

---

## Installation

Linked automatically via npm workspaces. Run `npm install` from the root.

```typescript
import { createLogger, NotFoundError, successResponse } from '@platform/shared-utils';
```

---

## Contents

---

### `createLogger(serviceName)` — Structured Logging

Built on [Pino](https://getpino.io) — the fastest structured logger for Node.js.

```typescript
import { createLogger } from '@platform/shared-utils';

const logger = createLogger('payment-service');

logger.info('Service started');
logger.info({ orderId: 'ord_123', amount: 5000 }, 'Payment intent created');
logger.error({ err: error.message }, 'Failed to process payment');
logger.warn({ attempt: 3 }, 'Retrying request');
```

**Development output** — human-readable with colors via `pino-pretty`:
```
[14:30:00] INFO  (payment-service): Service started
[14:30:01] INFO  (payment-service): Payment intent created
  orderId: "ord_123"
  amount: 5000
```

**Production output** — structured JSON for log aggregation:
```json
{"level":"info","time":"2025-03-10T14:30:01.000Z","service":"payment-service","env":"production","orderId":"ord_123","amount":5000,"msg":"Payment intent created"}
```

Every log line includes `service` and `env` fields automatically — essential for filtering logs from multiple services in a shared log aggregator.

---

### Error Classes — Typed HTTP Errors

A hierarchy of typed errors that carry HTTP status codes and machine-readable error codes. The API Gateway's error handler reads these to produce consistent error responses without any `if/else` logic.

```typescript
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  PaymentError,
  ServiceUnavailableError,
  isAppError,
} from '@platform/shared-utils';
```

| Class | Status | Code |
|---|---|---|
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `ConflictError` | 409 | `CONFLICT` |
| `PaymentError` | 422 | `PAYMENT_ERROR` |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` |

**Usage:**

```typescript
// Throw from anywhere in the service
throw new NotFoundError('PaymentIntent');
// → 404: "PaymentIntent not found"

throw new ValidationError('Invalid request body', zodError.flatten());
// → 400: "Invalid request body" + validation details

throw new PaymentError('Insufficient funds', { decline_code: 'insufficient_funds' });
// → 422: "Insufficient funds" + PSP details
```

**Catching in the Gateway error handler:**

```typescript
app.setErrorHandler((error, request, reply) => {
  if (isAppError(error)) {
    return reply.status(error.statusCode).send({
      success: false,
      error: { code: error.code, message: error.message }
    });
  }
  // Unknown error — do not leak internals
  return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } });
});
```

---

### Response Helpers — Consistent API Envelope

Enforces a single response shape across every endpoint in the platform.

```typescript
import { successResponse, errorResponse, paginatedResponse } from '@platform/shared-utils';

// Single resource
return reply.send(successResponse(paymentIntent));
// → { success: true, data: { id: '...', amount: 5000, ... } }

// Paginated list
return reply.send(paginatedResponse({ items, total, page, limit, hasMore }));
// → { success: true, data: { items: [...], total: 42, page: 1, limit: 20, hasMore: true } }

// Error (used internally by error handler)
return reply.status(400).send(errorResponse('VALIDATION_ERROR', 'Invalid input', details));
// → { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } }
```

---

### Idempotency Helpers — Safe Payment Operations

Prevents duplicate payments on network retries or accidental double-submissions.

```typescript
import { generateIdempotencyKey, generateRandomKey } from '@platform/shared-utils';

// Deterministic key — same inputs within same hour = same key
const key = generateIdempotencyKey(orderId, customerId, amount.toString(), currency);

// Random key — for one-off operations
const key = generateRandomKey();
```

`generateIdempotencyKey` uses SHA-256 and includes an hour-based time bucket. This means:
- Retries within the same hour return the existing payment intent
- A new attempt after one hour creates a fresh intent

---

## Building

```bash
npm run build   # compile once
npm run dev     # watch mode
```

---

## Folder Structure

```
src/
  logger.ts       ← createLogger, Logger type
  errors.ts       ← AppError base class + all subclasses + isAppError guard
  response.ts     ← successResponse, errorResponse, paginatedResponse
  idempotency.ts  ← generateIdempotencyKey, generateRandomKey
  index.ts        ← barrel export of everything above
dist/
  index.js
  index.d.ts
```
