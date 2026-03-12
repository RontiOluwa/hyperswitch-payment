# Medusa Service

MedusaJS v2 commerce backend. Handles orders, customers, products, inventory, cart, and notifications. Integrates with the custom Payment Service via a Hyperswitch payment provider plugin. Exposes an admin dashboard for managing the full commerce operation.

---

## Ports

| Port | Purpose |
|---|---|
| `9000` | Medusa API |
| `9001` | Medusa Admin Dashboard |

---

## What Medusa Owns

| Domain | Details |
|---|---|
| Orders | Full lifecycle — creation, fulfillment, cancellation, returns |
| Customers | Accounts, addresses, authentication |
| Products | Catalog, variants, collections, categories |
| Inventory | Stock levels, reservations, location management |
| Cart | Sessions, line items, discounts, shipping |
| Notifications | Email via SendGrid (configurable) |

---

## What Medusa Does NOT Own

Payment processing is intentionally delegated to the custom Payment Service. Medusa's Hyperswitch provider plugin calls the Payment Service rather than Hyperswitch directly. This keeps all payment logic, idempotency, and audit logging in one place.

---

## Modules

```
@medusajs/order              ← Order state machine + fulfillment workflows
@medusajs/customer           ← Customer accounts + sessions
@medusajs/product            ← Product catalog
@medusajs/inventory          ← Stock management
@medusajs/cart               ← Shopping cart
@medusajs/payment            ← Payment module (with Hyperswitch provider)
@medusajs/cache-redis        ← Redis-backed cache
@medusajs/event-bus-redis    ← Redis-backed event bus
@medusajs/workflow-engine-redis ← Redis-backed workflow engine
```

---

## Custom Hyperswitch Payment Provider

Located at `src/modules/hyperswitch/index.ts`. Extends `AbstractPaymentProvider` from MedusaJS.

The provider delegates all calls to the custom Payment Service instead of calling Hyperswitch directly:

```
Medusa checkout flow
      │
      ▼
HyperswitchPaymentProvider
      │
      ▼
Payment Service :3001  ← all Hyperswitch logic lives here
      │
      ▼
Hyperswitch API
```

Methods implemented:

| Method | Called When |
|---|---|
| `initiatePayment` | Customer reaches payment step |
| `authorizePayment` | Customer submits payment |
| `cancelPayment` | Order is cancelled |
| `refundPayment` | Admin initiates refund |
| `getPaymentStatus` | Medusa polls payment status |
| `getWebhookActionAndData` | Webhook forwarded from Webhook Service |

---

## Webhook Integration

The Webhook Service calls `POST /hooks/payment` after processing a Hyperswitch event. This endpoint verifies the internal service token and emits the event onto Medusa's event bus, which triggers order state transitions automatically.

```
Webhook Service
      │
      │  POST /hooks/payment
      │  Authorization: Bearer <internal_service_token>
      ▼
Medusa event bus
      │
      ▼
Order workflow  →  status: pending → paid → processing
```

---

## Admin Dashboard

Accessible at `http://localhost:9001` after startup.

Create your first admin user on first visit. From the dashboard you can:

- View and manage orders
- Manage customers
- Create and edit products
- Configure shipping options and regions
- Process refunds
- View payment status per order

---

## Database

Medusa uses its own PostgreSQL database completely separate from the custom services database. It manages its own schema via internal migrations that run automatically on startup.

```
Custom services DB: localhost:5432 / hyperswitch_platform
Medusa DB:          localhost:5433 / medusa_db
```

Both databases are accessible in pgAdmin — add `medusa-postgres` as a second server connection.

---

## Environment Variables

```bash
NODE_ENV=development

MEDUSA_DATABASE_URL=postgresql://medusa_user:medusa_password_dev@medusa-postgres:5432/medusa_db
MEDUSA_REDIS_URL=redis://:password@redis:6379

JWT_SECRET=
COOKIE_SECRET=

ADMIN_CORS=http://localhost:9001
AUTH_CORS=http://localhost:9001
STORE_CORS=http://localhost:8000

HYPERSWITCH_API_KEY=
HYPERSWITCH_BASE_URL=https://sandbox.hyperswitch.io
HYPERSWITCH_WEBHOOK_SECRET=

PAYMENT_SERVICE_URL=http://payment-service:3001
INTERNAL_SERVICE_SECRET=

SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@platform.com
```

---

## Folder Structure

```
src/
  modules/
    hyperswitch/
      index.ts           ← Custom Hyperswitch payment provider
  api/
    hooks/
      payment/
        route.ts         ← POST /hooks/payment (receives from Webhook Service)
  scripts/
    seed.ts              ← Optional seed script for initial data
medusa-config.js         ← Medusa configuration (modules, CORS, DB)
Dockerfile.dev           ← Docker build for development
package.json
tsconfig.json
```

---

## Running via Docker

Medusa runs exclusively via Docker to keep it alongside the other services on the same network.

```bash
# Start Medusa database first
docker-compose up medusa-postgres -d

# Start Medusa
docker-compose up medusa -d

# Watch logs (migrations run on first startup — takes ~60 seconds)
docker-compose logs -f medusa
```

## Rebuild after config changes

```bash
docker-compose down medusa
docker-compose build --no-cache medusa
docker-compose up medusa -d
```
