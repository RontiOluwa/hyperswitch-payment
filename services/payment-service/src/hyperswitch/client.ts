import { env } from '../config/env';
import { createLogger, PaymentError, ServiceUnavailableError } from '@platform/shared-utils';
import type { Currency, PaymentMethod } from '@platform/shared-types';

const logger = createLogger('payment-service:hyperswitch');

// ─── Hyperswitch response shapes ─────────────────────────────────────────────

export interface HSPaymentIntentResponse {
    payment_id: string;
    client_secret: string;
    status: string;
    amount: number;
    currency: string;
    connector?: string;
    error_code?: string;
    error_message?: string;
}

export interface HSRefundResponse {
    refund_id: string;
    payment_id: string;
    amount: number;
    currency: string;
    status: string;
    error_code?: string;
    error_message?: string;
}

// ─── Base request helper ──────────────────────────────────────────────────────

const hsRequest = async <T>(
    path: string,
    options: RequestInit = {}
): Promise<T> => {
    const url = `${env.HYPERSWITCH_BASE_URL}${path}`;

    let response: Response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'api-key': env.HYPERSWITCH_API_KEY,
                ...options.headers,
            },
        });
    } catch (err) {
        // Network level failure — Hyperswitch unreachable
        logger.error({ err, path }, 'Hyperswitch network error');
        throw new ServiceUnavailableError('Hyperswitch');
    }

    const data = await response.json() as T & {
        error?: { message: string; code: string };
    };

    if (!response.ok) {
        logger.error({ path, status: response.status, data }, 'Hyperswitch API error');
        throw new PaymentError(
            data.error?.message ?? 'Payment processing failed',
            { code: data.error?.code, status: response.status }
        );
    }

    return data;
};

// ─── Payment Intent ───────────────────────────────────────────────────────────

export interface CreatePaymentIntentParams {
    amount: number;
    currency: Currency;
    customerId: string;
    orderId: string;
    paymentMethod?: PaymentMethod;
    returnUrl?: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
}

export const createPaymentIntent = async (
    params: CreatePaymentIntentParams
): Promise<HSPaymentIntentResponse> => {
    logger.info({ orderId: params.orderId, amount: params.amount }, 'Creating payment intent');

    return hsRequest<HSPaymentIntentResponse>('/payments', {
        method: 'POST',
        headers: {
            // Hyperswitch supports idempotency keys natively
            'Idempotency-Key': params.idempotencyKey,
        },
        body: JSON.stringify({
            amount: params.amount,
            currency: params.currency.toUpperCase(),
            customer_id: params.customerId.replace(/[^a-zA-Z0-9_-]/g, '_'),
            metadata: {
                order_id: params.orderId,
                ...params.metadata,
            },
            return_url: params.returnUrl,
            confirm: false, // Two-step flow — create then confirm
            payment_method_type: params.paymentMethod,
        }),
    });
};

export interface ConfirmPaymentIntentParams {
    hyperswitchPaymentId: string;
    paymentMethod: string;
    paymentMethodData?: Record<string, unknown>;
    returnUrl?: string;
}

export const confirmPaymentIntent = async (
    params: ConfirmPaymentIntentParams
): Promise<HSPaymentIntentResponse> => {
    logger.info({ paymentId: params.hyperswitchPaymentId }, 'Confirming payment intent');

    return hsRequest<HSPaymentIntentResponse>(
        `/payments/${params.hyperswitchPaymentId}/confirm`,
        {
            method: 'POST',
            body: JSON.stringify({
                payment_method: params.paymentMethod,
                payment_method_data: params.paymentMethodData,
                return_url: params.returnUrl,
            }),
        }
    );
};

export const cancelPaymentIntent = async (
    hyperswitchPaymentId: string
): Promise<HSPaymentIntentResponse> => {
    logger.info({ paymentId: hyperswitchPaymentId }, 'Cancelling payment intent');

    return hsRequest<HSPaymentIntentResponse>(
        `/payments/${hyperswitchPaymentId}/cancel`,
        { method: 'POST' }
    );
};

export const getPaymentIntent = async (
    hyperswitchPaymentId: string
): Promise<HSPaymentIntentResponse> => {
    return hsRequest<HSPaymentIntentResponse>(
        `/payments/${hyperswitchPaymentId}`
    );
};

// ─── Refund ───────────────────────────────────────────────────────────────────

export interface CreateRefundParams {
    hyperswitchPaymentId: string;
    amount?: number;
    reason?: string;
    idempotencyKey: string;
}

export const createRefund = async (
    params: CreateRefundParams
): Promise<HSRefundResponse> => {
    logger.info(
        { paymentId: params.hyperswitchPaymentId, amount: params.amount },
        'Creating refund'
    );

    return hsRequest<HSRefundResponse>('/refunds', {
        method: 'POST',
        headers: {
            'Idempotency-Key': params.idempotencyKey,
        },
        body: JSON.stringify({
            payment_id: params.hyperswitchPaymentId,
            amount: params.amount,
            reason: params.reason ?? 'customer_request',
        }),
    });
};