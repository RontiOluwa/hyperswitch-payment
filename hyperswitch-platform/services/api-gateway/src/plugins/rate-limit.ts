import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env';

export const rateLimitPlugin = fp(async (app) => {
    await app.register(rateLimit, {
        redis: app.redis,
        // Sliding window — 100 requests per minute per IP by default
        max: 100,
        timeWindow: '1 minute',
        // Use caller identity as key when available — more accurate than IP
        keyGenerator: (request) => {
            const identity = request.identity;

            if (identity?.type === 'customer') return `customer:${identity.id}`;
            if (identity?.type === 'merchant') return `merchant:${identity.merchantId}`;

            return request.ip;
        },
        // Custom error response
        errorResponseBuilder: () => ({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests — please try again in a moment',
            },
        }),
    });
});