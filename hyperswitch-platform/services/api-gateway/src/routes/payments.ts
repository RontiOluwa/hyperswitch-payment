import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ValidationError, ForbiddenError, successResponse } from '@platform/shared-utils';
import { env } from '../config/env';

const createPaymentIntentSchema = z.object({
    orderId: z.string().min(1),
    amount: z.number().int().positive(),
    currency: z.string().length(3),
    paymentMethod: z.enum(['card', 'wallet', 'bank_transfer', 'bnpl']).optional(),
    returnUrl: z.string().url().optional(),
    metadata: z.record(z.string()).optional(),
});

export const paymentRoutes = async (app: FastifyInstance) => {

    // POST /payments — Create payment intent
    app.post('/payments', async (request, reply) => {
        const identity = request.identity!;

        // Only customers can create payment intents
        if (identity.type !== 'customer') {
            throw new ForbiddenError('Only customers can create payment intents');
        }

        // Validate request body
        const result = createPaymentIntentSchema.safeParse(request.body);
        if (!result.success) {
            throw new ValidationError('Invalid request body', result.error.flatten());
        }

        // Forward to payment service with identity injected into headers
        try {
            const response = await fetch(`${env.PAYMENT_SERVICE_URL}/payment-intents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Pass verified identity downstream — service trusts this header
                    'X-Customer-Id': identity.id,
                    'X-Identity-Type': identity.type,
                    // Internal service token — payment service verifies this
                    'Authorization': `Bearer ${generateServiceToken()}`,
                },
                body: JSON.stringify({
                    ...result.data,
                    customerId: identity.id,
                }),
            });

            const data = await response.json();
            return reply.status(response.status).send(data);
        } catch (error) {
            // Payment service is not reachable
            return reply.status(503).send({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Payment service is unavailable',
                },
            });
        }
    });

    // GET /payments/:id — Get payment intent
    app.get<{ Params: { id: string } }>('/payments/:id', async (request, reply) => {
        const identity = request.identity!;
        const { id } = request.params;

        try {
            const response = await fetch(`${env.PAYMENT_SERVICE_URL}/payment-intents/${id}`, {
                headers: {
                    'X-Customer-Id': identity.type === 'customer' ? identity.id : '',
                    'X-Identity-Type': identity.type,
                    'Authorization': `Bearer ${generateServiceToken()}`,
                },
            });

            const data = await response.json();
            return reply.status(response.status).send(data);
        } catch (error) {
            // Payment service is not reachable
            return reply.status(503).send({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Payment service is unavailable',
                },
            });
        }
    });

    // POST /payments/:id/confirm
    app.post<{ Params: { id: string } }>('/payments/:id/confirm', async (request, reply) => {
        const identity = request.identity!;

        if (identity.type !== 'customer') {
            throw new ForbiddenError('Only customers can confirm payments');
        }

        try {
            const response = await fetch(
                `${env.PAYMENT_SERVICE_URL}/payment-intents/${request.params.id}/confirm`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Customer-Id': identity.id,
                        'X-Identity-Type': identity.type,
                        'Authorization': `Bearer ${generateServiceToken()}`,
                    },
                    body: JSON.stringify(request.body),
                }
            );

            const data = await response.json();
            return reply.status(response.status).send(data);

        } catch (error) {
            // Payment service is not reachable
            return reply.status(503).send({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Payment service is unavailable',
                },
            });
        }
    });

    // POST /payments/:id/refund
    app.post<{ Params: { id: string } }>('/payments/:id/refund', async (request, reply) => {
        const identity = request.identity!;

        try {
            const response = await fetch(
                `${env.PAYMENT_SERVICE_URL}/payment-intents/${request.params.id}/refund`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Customer-Id': identity.type === 'customer' ? identity.id : '',
                        'X-Merchant-Id': identity.type === 'merchant' ? identity.merchantId : '',
                        'X-Identity-Type': identity.type,
                        'Authorization': `Bearer ${generateServiceToken()}`,
                    },
                    body: JSON.stringify(request.body),
                }
            );

            const data = await response.json();
            return reply.status(response.status).send(data);
        } catch (error) {
            // Payment service is not reachable
            return reply.status(503).send({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Payment service is unavailable',
                },
            });
        }
    });
};

// Generate short-lived internal service JWT
import jwt from 'jsonwebtoken';

const generateServiceToken = (): string => {
    return jwt.sign(
        { type: 'service', service: 'api-gateway' },
        env.INTERNAL_SERVICE_SECRET,
        { expiresIn: '60s' }
    );
};