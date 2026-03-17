# @platform/database

Prisma schema, generated client, and database utilities for the custom services. Defines every table owned by the payment, webhook, order, and notification layers. Shared across all services that need database access.

> **Note:** This package manages the custom services database only. MedusaJS manages its own separate database internally.

---

## Installation

Linked automatically via npm workspaces. Run `npm install` from the root.

```typescript
import { prisma, checkDatabaseHealth, disconnectDatabase } from '@platform/database';
```

---

## Database

```
Host:     localhost:5432
Database: hyperswitch_platform
User:     platform_user
```

---

## Schema Overview

### `payment_intents`

The core payment record. Created when a customer initiates checkout, updated as the payment moves through states.

| Column | Type | Notes |
|---|---|---|
| id | String | CUID primary key |
| hyperswitchPaymentId | String | Unique — Hyperswitch's ID for this payment |
| orderId | String | Links to Medusa order |
| customerId | String | Auth0 customer ID |
| amount | Int | Smallest currency unit (cents) |
| currency | String | ISO currency code |
| status | PaymentStatus | Current state |
| clientSecret | String | Returned to frontend for payment UI |
| idempotencyKey | String | Unique — prevents duplicate payments |
| metadata | Json | Arbitrary key-value pairs |

### `payment_events`

Append-only audit log. Every state change appends a new record — nothing is ever updated or deleted. Provides a complete timeline of every payment.

| Column | Type | Notes |
|---|---|---|
| id | String | CUID primary key |
| paymentIntentId | String | FK to payment_intents |
| eventType | PaymentEventType | intent_created, payment_succeeded, etc. |
| pspReference | String | PSP connector reference |
| rawData | Json | Full PSP response snapshot |
| createdAt | DateTime | Immutable timestamp |

### `refunds`

One refund record per refund request. Linked to the original payment intent.

### `webhook_logs`

Every inbound Hyperswitch webhook is persisted here before processing. Acts as a safety net — events can always be replayed from this table. Tracks processing status and retry count.

### `orders`

Order records for services not using Medusa. If using Medusa this table exists but is unused — Medusa manages its own orders in its own database.

### `order_events`

Append-only order state transition log.

### `notification_logs`

Record of every notification sent — email, Slack, SMS. Tracks delivery status and errors.

### `api_keys`

Merchant API keys. The raw key is never stored — only a SHA-256 hash and the first 8 characters as a prefix for identification.

---

## Enums

```typescript
PaymentStatus       // requires_payment_method | processing | succeeded | failed | ...
PaymentEventType    // intent_created | payment_succeeded | refund_initiated | ...
RefundStatus        // pending | succeeded | failed
OrderStatus         // pending | paid | processing | shipped | delivered | ...
NotificationType    // payment_success | payment_failed | refund_success | ...
NotificationChannel // email | slack | sms
NotificationStatus  // pending | sent | failed | suppressed
```

---

## Exported Utilities

### `prisma`

Singleton Prisma client. Uses a global variable in development to prevent multiple instances from being created during hot module reloading.

```typescript
import { prisma } from '@platform/database';

const intent = await prisma.paymentIntent.findUnique({
  where: { id: 'clxxx' }
});
```

### `checkDatabaseHealth`

Runs `SELECT 1` and returns a boolean. Used by health check endpoints.

```typescript
import { checkDatabaseHealth } from '@platform/database';

const healthy = await checkDatabaseHealth(); // true | false
```

### `disconnectDatabase`

Gracefully closes the Prisma connection. Called during service shutdown.

```typescript
import { disconnectDatabase } from '@platform/database';

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});
```

---

## Commands

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Create and apply a new migration (development)
npm run db:migrate

# Apply pending migrations (production — no prompts)
npm run db:migrate:prod

# Open Prisma Studio — visual database browser
npm run db:studio

# Reset database — drops all data and reruns migrations
npm run db:reset

# Build TypeScript
npm run build
```

---

## Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:generate` to update the Prisma client
3. Run `npm run db:migrate` to create and apply the migration
4. Rebuild the package — `npm run build`
5. Restart any running services

---

## Folder Structure

```
prisma/
  schema.prisma          ← Single schema file — all tables and enums
  migrations/            ← Auto-generated migration files (commit these)
src/
  index.ts               ← Prisma client export + health + disconnect helpers
dist/
  index.js
  index.d.ts
```

---

## Environment Variables

```bash
DATABASE_URL=postgresql://platform_user:password@localhost:5432/hyperswitch_platform
```
