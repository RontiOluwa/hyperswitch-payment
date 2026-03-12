# @platform/shared-types

TypeScript interfaces and type definitions shared across all services. The single source of truth for every domain object in the platform. No runtime code — types only.

---

## Purpose

Without a shared types package, every service defines its own interfaces. Over time they drift — the Payment Service calls `amount` what the Order Service calls `totalAmount`, and the Gateway has no idea which is correct. This package ensures every service speaks the same language.

---

## Installation

This package is automatically linked via npm workspaces. No manual installation needed — just run `npm install` from the root.

To use in a service:

```typescript
import type { PaymentIntent, Order, WebhookEvent } from '@platform/shared-types';
```

---

## Contents

### Payment Types

```typescript
PaymentStatus         // requires_payment_method | processing | succeeded | failed | ...
PaymentMethod         // card | wallet | bank_transfer | bnpl
PaymentIntent         // Full payment intent object
CreatePaymentIntentDto // Input shape for creating an intent
```

### Refund Types

```typescript
RefundStatus   // pending | succeeded | failed
Refund         // Full refund object
CreateRefundDto // Input shape for creating a refund
```

### Order Types

```typescript
OrderStatus    // pending | paid | processing | shipped | delivered | ...
Order          // Full order object
OrderLineItem  // Single line item within an order
Address        // Shipping / billing address
```

### Webhook Types

```typescript
WebhookEventType   // payment_intent.succeeded | refund.succeeded | dispute.created | ...
WebhookEvent       // Full inbound webhook payload shape
```

### Payment Event Types (Audit Log)

```typescript
PaymentEventType   // intent_created | payment_succeeded | refund_initiated | ...
PaymentEvent       // Single audit log entry
```

### Notification Types

```typescript
NotificationType    // payment_success | payment_failed | refund_success | ...
NotificationPayload // Data passed to notification handlers
```

### API Response Types

```typescript
ApiResponse<T>      // { success: boolean, data?: T, error?: { code, message } }
PaginatedResult<T>  // { items: T[], total, page, limit, hasMore }
```

### Identity Types

These are attached by the API Gateway after authentication and forwarded to downstream services.

```typescript
CustomerIdentity   // { type: 'customer', id, email, roles }
MerchantIdentity   // { type: 'merchant', id, merchantId, permissions }
ServiceIdentity    // { type: 'service', serviceName }
Identity           // Union of all three
```

---

## Building

```bash
npm run build    # compile once
npm run dev      # watch mode — recompiles on every change
```

Output goes to `dist/`. Services import from this compiled output in production, but TypeScript path aliases (`@platform/shared-types` → `src/`) point directly to source during development for faster iteration.

---

## Folder Structure

```
src/
  index.ts    ← All types exported from a single barrel file
dist/
  index.js    ← Compiled output
  index.d.ts  ← Type declarations
```
