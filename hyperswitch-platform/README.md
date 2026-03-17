# Hyperswitch Payment Platform

A production-grade microservices payment platform built with Fastify, MedusaJS v2, Prisma, BullMQ, and Auth0. Designed for multi-tenant commerce with Hyperswitch as the payment orchestration layer.

---

## Architecture

```
                         Client
                           │
                           ▼
                  ┌─────────────────┐
                  │   API Gateway   │  :3000
                  │  Auth0 + Rate   │
                  │  Limit + Proxy  │
                  └────────┬────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
   ┌──────────────┐ ┌────────────┐ ┌──────────────┐
   │   Payment    │ │  Webhook   │ │   MedusaJS   │
   │   Service    │ │  Service   │ │     v2       │
   │    :3001     │ │   :3002    │ │    :9000     │
   └──────┬───────┘ └─────┬──────┘ └──────────────┘
          │               │
          ▼               ▼
   ┌─────────────────────────────┐
   │        Hyperswitch          │
   │   (Payment Orchestration)   │
   └─────────────────────────────┘

Infrastructure
  PostgreSQL  :5432  (custom services)
  PostgreSQL  :5433  (Medusa)
  Redis       :6379  (shared)
  pgAdmin     :5050
```

---

## Services

| Service | Port | Description |
|---|---|---|
| `api-gateway` | 3000 | Single entry point — auth, rate limiting, routing |
| `payment-service` | 3001 | Hyperswitch integration, payment intents, refunds |
| `webhook-service` | 3002 | Inbound webhooks, signature verification, BullMQ |
| `medusa` | 9000 / 9001 | Orders, customers, products, admin dashboard |

## Packages

| Package | Description |
|---|---|
| `shared-types` | TypeScript interfaces shared across all services |
| `shared-utils` | Logger, errors, response helpers, idempotency |
| `database` | Prisma schema, client, migrations |

---

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm 9+

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd hyperswitch-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required values — see [Environment Variables](#environment-variables) below.

### 3. Build shared packages

```bash
cd packages/shared-types && npm run build && cd ../..
cd packages/shared-utils && npm run build && cd ../..
cd packages/database && npm run db:generate && npm run build && cd ../..
```

### 4. Start infrastructure

```bash
docker-compose up postgres redis pgadmin redis-commander medusa-postgres -d
```

### 5. Run database migrations

```bash
DATABASE_URL="postgresql://platform_user:platform_password_dev@localhost:5432/hyperswitch_platform" \
  cd packages/database && npm run db:migrate
```

### 6. Start services

```bash
# Terminal 1
cd services/api-gateway && npm run dev

# Terminal 2
cd services/payment-service && npm run dev

# Terminal 3
cd services/webhook-service && npm run dev
```

### 7. Start Medusa (Docker)

```bash
docker-compose up medusa -d
docker-compose logs -f medusa
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Auth0
AUTH0_DOMAIN=
AUTH0_AUDIENCE=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# PostgreSQL (custom services)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=platform_user
POSTGRES_PASSWORD=
POSTGRES_DB=hyperswitch_platform

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Internal service auth (min 32 chars)
INTERNAL_SERVICE_SECRET=

# Hyperswitch
HYPERSWITCH_API_KEY=
HYPERSWITCH_BASE_URL=https://sandbox.hyperswitch.io
HYPERSWITCH_WEBHOOK_SECRET=

# Medusa
MEDUSA_DATABASE_URL=postgresql://medusa_user:medusa_password_dev@localhost:5433/medusa_db
MEDUSA_REDIS_URL=redis://:password@localhost:6379

# pgAdmin
PGADMIN_EMAIL=admin@platform.com
PGADMIN_PASSWORD=
```

---

## Project Structure

```
hyperswitch-platform/
  services/
    api-gateway/          ← Fastify gateway
    payment-service/      ← Payment intents + refunds
    webhook-service/      ← Inbound webhooks + BullMQ
    medusa/               ← MedusaJS v2 commerce backend
  packages/
    shared-types/         ← TypeScript interfaces
    shared-utils/         ← Logger, errors, helpers
    database/             ← Prisma schema + client
  infrastructure/
    postgres/
      init.sql            ← Schema initialization
  docker-compose.yml      ← Infrastructure containers
  docker-compose.override.yml ← Service containers (dev)
  turbo.json              ← Turborepo pipeline config
  tsconfig.base.json      ← Shared TypeScript config
```

---

## Development Tools

| Tool | URL | Purpose |
|---|---|---|
| pgAdmin | http://localhost:5050 | PostgreSQL GUI |
| Redis Commander | http://localhost:8081 | Redis GUI |
| Medusa Admin | http://localhost:9001 | Commerce admin |
| Prisma Studio | `npm run db:studio` | Database GUI |

---

## Tech Stack

- **Runtime** — Node.js 20, TypeScript strict mode
- **HTTP Framework** — Fastify
- **Database** — PostgreSQL 16 + Prisma ORM
- **Cache / Queue** — Redis 7 + BullMQ
- **Auth** — Auth0 (customers) + Custom API Keys (merchants)
- **Commerce** — MedusaJS v2
- **Payment Orchestration** — Hyperswitch
- **Monorepo** — Turborepo + npm workspaces
- **Containers** — Docker + Docker Compose
