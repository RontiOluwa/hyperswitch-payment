import { prisma } from '@platform/database';
import type { PaymentStatus, PaymentEventType, RefundStatus } from '@platform/shared-types';

// ─── Payment Intent ───────────────────────────────────────────────────────────

export const findPaymentIntentById = (id: string) =>
    prisma.paymentIntent.findUnique({
        where: { id },
        include: { events: { orderBy: { createdAt: 'asc' } } },
    });

export const findPaymentIntentByHSId = (hyperswitchPaymentId: string) =>
    prisma.paymentIntent.findUnique({
        where: { hyperswitchPaymentId },
    });

export const findPaymentIntentByIdempotencyKey = (idempotencyKey: string) =>
    prisma.paymentIntent.findUnique({
        where: { idempotencyKey },
    });

export const createPaymentIntent = (data: {
    hyperswitchPaymentId: string;
    orderId: string;
    customerId: string;
    amount: number;
    currency: string;
    clientSecret: string;
    idempotencyKey: string;
    paymentMethod?: string;
    returnUrl?: string;
    metadata?: Record<string, string>;
}) => prisma.paymentIntent.create({ data });

export const updatePaymentIntentStatus = (
    id: string,
    status: PaymentStatus,
    extra?: { pspReference?: string; pspName?: string }
) =>
    prisma.paymentIntent.update({
        where: { id },
        data: { status, ...extra },
    });

export const listPaymentIntentsByCustomer = (
    customerId: string,
    page: number,
    limit: number
) =>
    Promise.all([
        prisma.paymentIntent.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.paymentIntent.count({ where: { customerId } }),
    ]);

// ─── Payment Events (Append-only audit log) ───────────────────────────────────

export const appendPaymentEvent = (data: {
    paymentIntentId: string;
    eventType: PaymentEventType;
    pspReference?: string;
    pspName?: string;
    amount?: number;
    currency?: string;
    status?: PaymentStatus;
    rawData?: Record<string, unknown>;
}) => prisma.paymentEvent.create({ data });

// ─── Refund ───────────────────────────────────────────────────────────────────

export const createRefund = (data: {
    hyperswitchRefundId: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    reason?: string;
}) => prisma.refund.create({ data });

export const updateRefundStatus = (id: string, status: RefundStatus) =>
    prisma.refund.update({ where: { id }, data: { status } });

export const findRefundsByPaymentIntent = (paymentIntentId: string) =>
    prisma.refund.findMany({
        where: { paymentIntentId },
        orderBy: { createdAt: 'desc' },
    })