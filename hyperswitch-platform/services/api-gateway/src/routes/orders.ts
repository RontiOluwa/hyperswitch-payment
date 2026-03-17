import type { FastifyInstance } from 'fastify';
import { ForbiddenError, createLogger } from '@platform/shared-utils';
import { env } from '../config/env';

const logger = createLogger('api-gateway:orders');

// ─── Medusa Admin Token Cache ─────────────────────────────────────────────────

let medusaAdminToken: string | null = null;
let tokenExpiresAt: number = 0;

const getMedusaAdminToken = async (): Promise<string> => {
    if (medusaAdminToken && Date.now() < tokenExpiresAt) {
        return medusaAdminToken;
    }

    console.log('Fetching Medusa admin token...');
    console.log('URL:', `${env.MEDUSA_URL}/auth/user/emailpass`);
    console.log('Email:', env.MEDUSA_ADMIN_EMAIL);

    const response = await fetch(`${env.MEDUSA_URL}/auth/user/emailpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: env.MEDUSA_ADMIN_EMAIL,
            password: env.MEDUSA_ADMIN_PASSWORD,
        }),
    });

    const data = await response.json();
    console.log('Medusa auth response status:', response.status);
    console.log('Medusa auth response:', JSON.stringify(data));

    if (!response.ok) {
        throw new Error(`Failed to authenticate with Medusa: ${JSON.stringify(data)}`);
    }

    // Medusa v2 returns { token: "..." }
    medusaAdminToken = (data as any).token;
    tokenExpiresAt = Date.now() + 20 * 60 * 60 * 1000;

    return medusaAdminToken!;
};

// ─── Proxy Helper ─────────────────────────────────────────────────────────────

const proxyToMedusa = async (
    path: string,
    options: {
        method?: string;
        body?: unknown;
        useAdmin?: boolean;
    } = {}
): Promise<{ status: number; data: unknown }> => {
    const { method = 'GET', body, useAdmin = false } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-publishable-api-key': env.MEDUSA_PUBLISHABLE_KEY,
    };

    if (useAdmin) {
        const adminToken = await getMedusaAdminToken();
        headers['Authorization'] = `Bearer ${adminToken}`;
    }

    const response = await fetch(`${env.MEDUSA_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return { status: response.status, data };
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export const orderRoutes = async (app: FastifyInstance) => {

    // GET /api/v1/orders
    app.get('/orders', async (request, reply) => {
        const identity = request.identity!;

        if (identity.type !== 'customer' && identity.type !== 'merchant') {
            throw new ForbiddenError('Unauthorized');
        }

        logger.info({ callerId: identity.id }, 'Listing orders');

        const { status, data } = await proxyToMedusa('/admin/orders', {
            useAdmin: true,
        });

        return reply.status(status).send(data);
    });

    // GET /api/v1/orders/:id
    app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
        const { id } = request.params;

        logger.info({ orderId: id }, 'Fetching order');

        const { status, data } = await proxyToMedusa(`/admin/orders/${id}`, {
            useAdmin: true,
        });

        return reply.status(status).send(data);
    });

    // GET /api/v1/orders/:id/status
    app.get<{ Params: { id: string } }>('/orders/:id/status', async (request, reply) => {
        const { id } = request.params;

        const { status, data } = await proxyToMedusa(`/admin/orders/${id}`, {
            useAdmin: true,
        });

        const order = (data as any)?.order;

        if (!order) {
            return reply.status(status).send(data);
        }

        return reply.send({
            success: true,
            data: {
                id: order.id,
                status: order.status,
                paymentStatus: order.payment_status,
                fulfillmentStatus: order.fulfillment_status,
                total: order.total,
                currency: order.currency_code,
            },
        });
    });
};