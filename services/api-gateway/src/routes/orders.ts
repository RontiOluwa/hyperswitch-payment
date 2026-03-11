import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@platform/shared-utils';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';

const generateServiceToken = (): string =>
    jwt.sign(
        { type: 'service', service: 'api-gateway' },
        env.INTERNAL_SERVICE_SECRET,
        { expiresIn: '60s' }
    );

const createOrderSchema = z.object({
    totalAmount: z.number().int().positive(),
    currency: z.string().length(3),
    lineItems: z.array(z.object({
        productId: z.string(),
        title: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().positive(),
        totalPrice: z.number().int().positive(),
    })).min(1),
    shippingAddress: z.object({
        firstName: z.string(),
        lastName: z.string(),
        line1: z.string(),
        line2: z.string().optional(),
        city: z.string(),
        state: z.string().optional(),
        postalCode: z.string(),
        countryCode: z.string().length(2),
    }),
    metadata: z.record(z.string()).optional(),
});

export const orderRoutes = async (app: FastifyInstance) => {

    // POST /orders
    app.post('/orders', async (request, reply) => {
        const identity = request.identity!;

        if (identity.type !== 'customer') {
            throw new ForbiddenError('Only customers can create orders');
        }

        const result = createOrderSchema.safeParse(request.body);
        if (!result.success) {
            throw new ValidationError('Invalid order data', result.error.flatten());
        }

        try {
            const response = await fetch(`${env.ORDER_SERVICE_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Customer-Id': identity.id,
                    'X-Identity-Type': 'customer',
                    'Authorization': `Bearer ${generateServiceToken()}`,
                },
                body: JSON.stringify({ ...result.data, customerId: identity.id }),
            });

            const data = await response.json();
            return reply.status(response.status).send(data);
        } catch (error) {
            // Payment service is not reachable
            return reply.status(503).send({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Orders service is unavailable',
                },
            });
        }
    });

    // GET /orders
    app.get('/orders', async (request, reply) => {
        const identity = request.identity!;

        const queryParams = new URLSearchParams(
            request.query as Record<string, string>
        ).toString();

        try {
            const response = await fetch(
                `${env.ORDER_SERVICE_URL}/orders?${queryParams}`,
                {
                    headers: {
                        'X-Customer-Id': identity.type === 'customer' ? identity.id : '',
                        'X-Merchant-Id': identity.type === 'merchant' ? identity.merchantId : '',
                        'X-Identity-Type': identity.type,
                        'Authorization': `Bearer ${generateServiceToken()}`,
                    },
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
                    message: 'Orders service is unavailable',
                },
            });
        }
    });

    // GET /orders/:id
    app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
        const identity = request.identity!;

        try {
            const response = await fetch(
                `${env.ORDER_SERVICE_URL}/orders/${request.params.id}`,
                {
                    headers: {
                        'X-Customer-Id': identity.type === 'customer' ? identity.id : '',
                        'X-Identity-Type': identity.type,
                        'Authorization': `Bearer ${generateServiceToken()}`,
                    },
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
                    message: 'Orders service is unavailable',
                },
            });
        }
    });
};