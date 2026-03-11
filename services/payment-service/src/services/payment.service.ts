import * as hsClient from '../hyperswitch/client';
import * as repo from '../repositories/payment.repository';
import {
    createLogger,
    generateIdempotencyKey,
    generateRandomKey,
    NotFoundError,
    ForbiddenError,
    ConflictError,
    PaymentError,
} from '@platform/shared-utils';
import type {
    CreatePaymentIntentDto,
    CreateRefundDto,
    PaymentIntent,
    Refund,
    PaginatedResult,
} from '@platform/shared-types';

const logger = createLogger('payment-service:core');

// ─── Create Payment Intent ────────────────────────────────────────────────────

export const createPaymentIntent = async (
    dto: CreatePaymentIntentDto
): Promise<PaymentIntent> => {

    // Generate deterministic idempotency key
    // Same order + customer + amount + currency within same hour = same key
    const idempotencyKey = generateIdempotencyKey(
        dto.orderId,
        dto.customerId,
        dto.amount.toString(),
        dto.currency
    );

    // Check for existing intent — return it instead of creating a duplicate
    const existing = await repo.findPaymentIntentByIdempotencyKey(idempotencyKey);

    if (existing) {
        logger.info({ idempotencyKey, id: existing.id }, 'Returning existing payment intent');
        return existing as unknown as PaymentIntent;
    }

    // Call Hyperswitch to create the intent
    const hsResponse = await hsClient.createPaymentIntent({
        amount: dto.amount,
        currency: dto.currency,
        customerId: dto.customerId,
        orderId: dto.orderId,
        paymentMethod: dto.paymentMethod,
        returnUrl: dto.returnUrl,
        idempotencyKey,
        metadata: dto.metadata,
    });

    // Persist to database
    const intent = await repo.createPaymentIntent({
        hyperswitchPaymentId: hsResponse.payment_id,
        orderId: dto.orderId,
        customerId: dto.customerId,
        amount: dto.amount,
        currency: dto.currency,
        clientSecret: hsResponse.client_secret,
        idempotencyKey,
        paymentMethod: dto.paymentMethod,
        metadata: dto.metadata,
    });

    // Append to audit log
    await repo.appendPaymentEvent({
        paymentIntentId: intent.id,
        eventType: 'intent_created',
        amount: dto.amount,
        currency: dto.currency,
        status: 'requires_payment_method',
    });

    logger.info(
        { intentId: intent.id, orderId: dto.orderId, amount: dto.amount },
        'Payment intent created'
    );

    return intent as unknown as PaymentIntent;
};

// ─── Confirm Payment Intent ───────────────────────────────────────────────────

export const confirmPaymentIntent = async (
    intentId: string,
    customerId: string,
    paymentMethodData: {
        paymentMethod: string;
        data?: Record<string, unknown>;
        returnUrl?: string;
    }
): Promise<PaymentIntent> => {

    const intent = await repo.findPaymentIntentById(intentId);

    if (!intent) throw new NotFoundError('PaymentIntent');

    // Ensure the customer owns this intent
    if (intent.customerId !== customerId) {
        throw new ForbiddenError('You do not have access to this payment intent');
    }

    // Only allow confirmation from specific states
    if (!['requires_payment_method', 'requires_confirmation'].includes(intent.status)) {
        throw new ConflictError(`Cannot confirm intent in status: ${intent.status}`);
    }

    const hsResponse = await hsClient.confirmPaymentIntent({
        hyperswitchPaymentId: intent.hyperswitchPaymentId,
        paymentMethod: paymentMethodData.paymentMethod,
        paymentMethodData: paymentMethodData.data,
        returnUrl: paymentMethodData.returnUrl,
    });

    // Map Hyperswitch status to our status
    const newStatus = mapHSStatus(hsResponse.status);

    await repo.updatePaymentIntentStatus(intent.id, newStatus, {
        pspReference: hsResponse.connector,
    });

    // Append confirmation event to audit log
    await repo.appendPaymentEvent({
        paymentIntentId: intent.id,
        eventType: 'intent_confirmed',
        status: newStatus,
        pspReference: hsResponse.connector,
    });

    logger.info({ intentId, newStatus }, 'Payment intent confirmed');

    return { ...intent, status: newStatus } as unknown as PaymentIntent;
};

// ─── Cancel Payment Intent ────────────────────────────────────────────────────

export const cancelPaymentIntent = async (
    intentId: string,
    requesterId: string
): Promise<PaymentIntent> => {

    const intent = await repo.findPaymentIntentById(intentId);

    if (!intent) throw new NotFoundError('PaymentIntent');
    if (intent.customerId !== requesterId) {
        throw new ForbiddenError('You do not have access to this payment intent');
    }

    // Only cancellable before payment processing starts
    const cancellableStatuses = ['requires_payment_method', 'requires_confirmation'];
    if (!cancellableStatuses.includes(intent.status)) {
        throw new ConflictError(`Cannot cancel intent in status: ${intent.status}`);
    }

    await hsClient.cancelPaymentIntent(intent.hyperswitchPaymentId);
    await repo.updatePaymentIntentStatus(intent.id, 'cancelled');
    await repo.appendPaymentEvent({
        paymentIntentId: intent.id,
        eventType: 'payment_cancelled',
        status: 'cancelled',
    });

    logger.info({ intentId }, 'Payment intent cancelled');

    return { ...intent, status: 'cancelled' } as unknown as PaymentIntent;
};

// ─── Get Payment Intent ───────────────────────────────────────────────────────

export const getPaymentIntent = async (
    intentId: string,
    requesterId: string,
    requesterType: string
): Promise<PaymentIntent> => {

    const intent = await repo.findPaymentIntentById(intentId);

    if (!intent) throw new NotFoundError('PaymentIntent');

    // Customers can only see their own intents
    // Merchants and services can see all
    if (requesterType === 'customer' && intent.customerId !== requesterId) {
        throw new ForbiddenError('You do not have access to this payment intent');
    }

    return intent as unknown as PaymentIntent;
};

// ─── List Payment Intents ─────────────────────────────────────────────────────

export const listPaymentIntents = async (
    customerId: string,
    page = 1,
    limit = 20
): Promise<PaginatedResult<PaymentIntent>> => {

    const [items, total] = await repo.listPaymentIntentsByCustomer(
        customerId,
        page,
        limit
    );

    return {
        items: items as unknown as PaymentIntent[],
        total,
        page,
        limit,
        hasMore: page * limit < total,
    };
};

// ─── Create Refund ────────────────────────────────────────────────────────────

export const createRefund = async (
    intentId: string,
    dto: CreateRefundDto,
    requesterId: string,
    requesterType: string
): Promise<Refund> => {

    const intent = await repo.findPaymentIntentById(intentId);

    if (!intent) throw new NotFoundError('PaymentIntent');

    // Only succeeded payments can be refunded
    if (intent.status !== 'succeeded') {
        throw new ConflictError(`Cannot refund intent in status: ${intent.status}`);
    }

    // Customers can only refund their own intents
    if (requesterType === 'customer' && intent.customerId !== requesterId) {
        throw new ForbiddenError('You do not have access to this payment intent');
    }

    // Default refund amount is full amount
    const refundAmount = dto.amount ?? intent.amount;

    if (refundAmount > intent.amount) {
        throw new PaymentError('Refund amount exceeds original payment amount');
    }

    const idempotencyKey = generateRandomKey();

    const hsResponse = await hsClient.createRefund({
        hyperswitchPaymentId: intent.hyperswitchPaymentId,
        amount: refundAmount,
        reason: dto.reason,
        idempotencyKey,
    });

    const refund = await repo.createRefund({
        hyperswitchRefundId: hsResponse.refund_id,
        paymentIntentId: intent.id,
        amount: refundAmount,
        currency: intent.currency,
        reason: dto.reason,
    });

    await repo.appendPaymentEvent({
        paymentIntentId: intent.id,
        eventType: 'refund_initiated',
        amount: refundAmount,
        currency: intent.currency,
    });

    // Update intent status
    const newStatus = refundAmount === intent.amount ? 'cancelled' : 'succeeded';
    await repo.updatePaymentIntentStatus(intent.id, newStatus);

    logger.info({ intentId, refundId: refund.id, amount: refundAmount }, 'Refund initiated');

    return refund as unknown as Refund;
};

// ─── Handle Webhook Status Update ────────────────────────────────────────────
// Called by Webhook Service when Hyperswitch sends an event

export const handleStatusUpdate = async (
    hyperswitchPaymentId: string,
    newStatus: string,
    rawData: Record<string, unknown>
): Promise<void> => {

    const intent = await repo.findPaymentIntentByHSId(hyperswitchPaymentId);

    if (!intent) {
        logger.warn({ hyperswitchPaymentId }, 'Received webhook for unknown payment intent');
        return;
    }

    const mappedStatus = mapHSStatus(newStatus);

    await repo.updatePaymentIntentStatus(intent.id, mappedStatus);
    await repo.appendPaymentEvent({
        paymentIntentId: intent.id,
        eventType: statusToEventType(mappedStatus),
        status: mappedStatus,
        rawData,
    });

    logger.info(
        { intentId: intent.id, hyperswitchPaymentId, newStatus: mappedStatus },
        'Payment status updated via webhook'
    );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { PaymentStatus, PaymentEventType } from '@platform/shared-types';

const mapHSStatus = (hsStatus: string): PaymentStatus => {
    const map: Record<string, PaymentStatus> = {
        'requires_payment_method': 'requires_payment_method',
        'requires_confirmation': 'requires_confirmation',
        'requires_action': 'requires_action',
        'processing': 'processing',
        'succeeded': 'succeeded',
        'failed': 'failed',
        'cancelled': 'cancelled',
        'partially_captured': 'succeeded',
        'requires_capture': 'processing',
    };

    return map[hsStatus] ?? 'processing';
};

const statusToEventType = (status: PaymentStatus): PaymentEventType => {
    const map: Record<PaymentStatus, PaymentEventType> = {
        'requires_payment_method': 'intent_created',
        'requires_confirmation': 'intent_confirmed',
        'requires_action': 'action_required',
        'processing': 'payment_processing',
        'succeeded': 'payment_succeeded',
        'failed': 'payment_failed',
        'cancelled': 'payment_cancelled',
    };

    return map[status] ?? 'payment_processing';
};