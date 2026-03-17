import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '@platform/shared-utils';

declare module 'fastify' {
    interface FastifyRequest {
        callerId: string;
        callerType: string;
        customerId: string;
        merchantId: string;
    }
}

export const authPlugin = fp(async (app) => {
    app.addHook('preHandler', async (request) => {
        const skipAuth = (request.routeOptions?.config as any)?.skipAuth;
        if (skipAuth) return;

        const authHeader = request.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('Internal service token required');
        }

        const token = authHeader.slice(7);

        try {
            const payload = jwt.verify(
                token,
                env.INTERNAL_SERVICE_SECRET
            ) as jwt.JwtPayload;

            if (payload.type !== 'service') {
                throw new UnauthorizedError('Invalid service token');
            }
        } catch {
            throw new UnauthorizedError('Invalid or expired service token');
        }

        // Attach identity forwarded by gateway via headers
        request.callerType = request.headers['x-identity-type'] as string ?? 'service';
        request.customerId = request.headers['x-customer-id'] as string ?? '';
        request.merchantId = request.headers['x-merchant-id'] as string ?? '';
        request.callerId = request.customerId || request.merchantId;
    });
});