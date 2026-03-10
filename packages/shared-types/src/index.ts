// ─── Payment ──────────────────────────────────────────────────────────────────

export type PaymentStatus =
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'succeeded'
    | 'failed'
    | 'cancelled';

export type PaymentMethod = 'card' | 'wallet' | 'bank_transfer' | 'bnpl';
export type Currency = 'USD' | 'EUR' | 'GBP' | string;
export type PSPName = 'stripe' | 'adyen' | 'braintree' | 'paypal';

export interface PaymentIntent {
    id: string;
    hyperswitchPaymentId: string;
    orderId: string;
    customerId: string;
    amount: number;
    currency: Currency;
    status: PaymentStatus;
    clientSecret: string;
    paymentMethod?: PaymentMethod;
    pspReference?: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreatePaymentIntentDto {
    orderId: string;
    customerId: string;
    amount: number;
    currency: Currency;
    paymentMethod?: PaymentMethod;
    returnUrl?: string;
    metadata?: Record<string, string>;
}

// ─── Refund ───────────────────────────────────────────────────────────────────

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

export interface Refund {
    id: string;
    hyperswitchRefundId: string;
    paymentIntentId: string;
    amount: number;
    currency: Currency;
    status: RefundStatus;
    reason?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateRefundDto {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
}

// ─── Order ────────────────────────────────────────────────────────────────────

export type OrderStatus =
    | 'pending'
    | 'payment_pending'
    | 'payment_failed'
    | 'paid'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded'
    | 'partially_refunded';

export interface Order {
    id: string;
    customerId: string;
    status: OrderStatus;
    totalAmount: number;
    currency: Currency;
    lineItems: OrderLineItem[];
    shippingAddress: Address;
    paymentIntentId?: string;
    metadata?: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrderLineItem {
    id: string;
    productId: string;
    title: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface Address {
    firstName: string;
    lastName: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryCode: string;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export type WebhookEventType =
    | 'payment_intent.succeeded'
    | 'payment_intent.failed'
    | 'payment_intent.processing'
    | 'payment_intent.requires_action'
    | 'payment_intent.cancelled'
    | 'refund.succeeded'
    | 'refund.failed'
    | 'dispute.created';

export interface WebhookEvent {
    id: string;
    type: WebhookEventType;
    timestamp: string;
    data: {
        object: Record<string, unknown>;
    };
    merchantId: string;
}

// ─── Payment Events (Append-only audit log) ───────────────────────────────────

export type PaymentEventType =
    | 'intent_created'
    | 'intent_confirmed'
    | 'payment_processing'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'payment_cancelled'
    | 'action_required'
    | 'refund_initiated'
    | 'refund_succeeded'
    | 'refund_failed';

export interface PaymentEvent {
    id: string;
    paymentIntentId: string;
    eventType: PaymentEventType;
    pspReference?: string;
    pspName?: string;
    amount?: number;
    currency?: Currency;
    status?: PaymentStatus;
    rawData?: Record<string, unknown>;
    createdAt: Date;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
    | 'payment_success'
    | 'payment_failed'
    | 'refund_initiated'
    | 'refund_success'
    | 'action_required'
    | 'dispute_created';

export interface NotificationPayload {
    type: NotificationType;
    customerId: string;
    orderId: string;
    paymentIntentId: string;
    amount: number;
    currency: Currency;
    email?: string;
    metadata?: Record<string, unknown>;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// ─── Identity (attached by Gateway after auth) ────────────────────────────────

export type IdentityType = 'customer' | 'merchant' | 'service';

export interface CustomerIdentity {
    type: 'customer';
    id: string;
    email?: string;
    roles: string[];
}

export interface MerchantIdentity {
    type: 'merchant';
    id: string;
    merchantId: string;
    permissions: string[];
}

export interface ServiceIdentity {
    type: 'service';
    serviceName: string;
}

export type Identity =
    | CustomerIdentity
    | MerchantIdentity
    | ServiceIdentity;