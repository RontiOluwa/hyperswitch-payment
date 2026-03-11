import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as paymentService from '../services/payment.service';
import { ValidationError, successResponse, paginatedResponse } from '@platform/shared-utils';

const createSchema = z.object({
    orderId: z.string().min(1),
    customerId: z.string().min(1),
    amount: z.number().int().positive(),
    currency: z.string().length(3),
    paymentMethod: z.enum(['card', 'wallet', 'bank_transfer', 'bnpl']).optional(),
    returnUrl: z.string().url().optional(),
    metadata: z.record(z.string()).optional(),
});

const confirmSchema = z.object({
    paymentMethod: z.string().min(1),
    paymentMethodData: z.record(z.unknown()).optional(),
    returnUrl: z.string().url().optional(),
});

const refundSchema = z.object({
    amount: z.number().int().positive().optional(),
    reason: z.string().optional(),
});

export const paymentIntentRoutes = async (app: FastifyInstance) => {

    // POST /payment-intents
    app.post('/payment-intents', async (request, reply) => {
        const result = createSchema.safeParse(request.body);
        if (!result.success) throw new ValidationError('Invalid payload', result.error.flatten());

        const intent = await paymentService.createPaymentIntent(result.data);
        return reply.status(201).send(successResponse(intent));
    });

    // GET /payment-intents/:id
    app.get<{ Params: { id: string } }>('/payment-intents/:id', async (request, reply) => {
        const intent = await paymentService.getPaymentIntent(
            request.params.id,
            request.callerId,
            request.callerType
        );
        return reply.send(successResponse(intent));
    });

    // GET /payment-intents
    app.get('/payment-intents', async (request, reply) => {
        const query = request.query as { page?: string; limit?: string };
        const result = await paymentService.listPaymentIntents(
            request.customerId,
            Number(query.page ?? 1),
            Number(query.limit ?? 20)
        );
        return reply.send(paginatedResponse(result));
    });

    // POST /payment-intents/:id/confirm
    app.post<{ Params: { id: string } }>('/payment-intents/:id/confirm', async (request, reply) => {
        const result = confirmSchema.safeParse(request.body);
        if (!result.success) throw new ValidationError('Invalid payload', result.error.flatten());

        const intent = await paymentService.confirmPaymentIntent(
            request.params.id,
            request.customerId,
            result.data
        );
        return reply.send(successResponse(intent));
    });

    // POST /payment-intents/:id/cancel
    app.post<{ Params: { id: string } }>('/payment-intents/:id/cancel', async (request, reply) => {
        const intent = await paymentService.cancelPaymentIntent(
            request.params.id,
            request.customerId
        );
        return reply.send(successResponse(intent));
    });

    // POST /payment-intents/:id/refund
    app.post<{ Params: { id: string } }>('/payment-intents/:id/refund', async (request, reply) => {
        const result = refundSchema.safeParse(request.body);
        if (!result.success) throw new ValidationError('Invalid payload', result.error.flatten());

        const refund = await paymentService.createRefund(
            request.params.id,
            result.data,
            request.callerId,
            request.callerType
        );
        return reply.status(201).send(successResponse(refund));
    });

    // POST /payment-intents/webhook-update
    // Called internally by Webhook Service only
    app.post('/payment-intents/webhook-update', async (request, reply) => {
        const { hyperswitchPaymentId, status, rawData } = request.body as {
            hyperswitchPaymentId: string;
            status: string;
            rawData: Record<string, unknown>;
        };

        await paymentService.handleStatusUpdate(hyperswitchPaymentId, status, rawData);
        return reply.send(successResponse({ received: true }));
    });
};