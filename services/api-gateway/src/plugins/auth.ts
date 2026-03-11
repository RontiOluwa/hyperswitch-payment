import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { env } from '../config/env';
import { createLogger, UnauthorizedError } from '@platform/shared-utils';
import type { Identity } from '@platform/shared-types';

const logger = createLogger('api-gateway:auth');

// JWKS client — fetches and caches Auth0 public keys
const jwksClient = jwksRsa({
    jwksUri: `https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 60 * 1000, // 10 hours
    rateLimit: true,
    jwksRequestsPerMinute: 10,
});

// Extract signing key from JWKS for a given key ID
const getSigningKey = (kid: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        jwksClient.getSigningKey(kid, (err, key) => {
            if (err) return reject(err);
            const signingKey = key?.getPublicKey();
            if (!signingKey) return reject(new Error('No signing key found'));
            resolve(signingKey);
        });
    });
};

// Verify an Auth0 JWT and return decoded payload
export const verifyJwt = async (token: string): Promise<jwt.JwtPayload> => {
    // Decode header to get key ID without verifying signature yet
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        throw new UnauthorizedError('Invalid token format');
    }

    const signingKey = await getSigningKey(decoded.header.kid);

    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            signingKey,
            {
                algorithms: ['RS256'],
                audience: env.AUTH0_AUDIENCE,
                issuer: `https://${env.AUTH0_DOMAIN}/`,
            },
            (err, payload) => {
                if (err) {
                    logger.warn({ err: err.message }, 'JWT verification failed');
                    return reject(new UnauthorizedError('Invalid or expired token'));
                }
                resolve(payload as jwt.JwtPayload);
            }
        );
    });
};

// Verify internal service-to-service requests
export const verifyServiceToken = (token: string): boolean => {
    try {
        const payload = jwt.verify(token, env.INTERNAL_SERVICE_SECRET) as jwt.JwtPayload;
        return payload.type === 'service';
    } catch {
        return false;
    }
};

// Extend Fastify request with identity
declare module 'fastify' {
    interface FastifyRequest {
        identity?: Identity;
    }
}

export const authPlugin = fp(async (app) => {
    // Prehandler — runs on every request before route handlers
    // Routes can opt out with { config: { skipAuth: true } }
    app.addHook('preHandler', async (request, reply) => {
        const skipAuth = (request.routeOptions?.config as any)?.skipAuth;

        if (skipAuth) return;

        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedError('Authorization header required');
        }

        // Handle Bearer tokens (Auth0 JWTs for customers)
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);

            // Check if this is an internal service token first
            if (verifyServiceToken(token)) {
                request.identity = { type: 'service', serviceName: 'internal' };
                return;
            }

            // Otherwise verify as Auth0 customer JWT
            const payload = await verifyJwt(token);

            request.identity = {
                type: 'customer',
                id: payload.sub!,
                email: payload.email,
                roles: payload['https://platform.com/roles'] ?? [],
            };

            return;
        }

        // Handle API keys (merchants)
        if (authHeader.startsWith('ApiKey ')) {
            const apiKey = authHeader.slice(7);
            const merchantIdentity = await validateApiKey(app.redis, apiKey);

            if (!merchantIdentity) {
                throw new UnauthorizedError('Invalid API key');
            }

            request.identity = merchantIdentity;
            return;
        }

        throw new UnauthorizedError('Unsupported authorization scheme');
    });
});

// Validate merchant API key against Redis cache + database
// Redis acts as the fast lookup layer — avoids DB hit on every request
import crypto from 'crypto';
import type { Redis } from 'ioredis';
import type { MerchantIdentity } from '@platform/shared-types';

const validateApiKey = async (
    redis: Redis,
    rawKey: string
): Promise<MerchantIdentity | null> => {
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
    const cacheKey = `api_key:${hashedKey}`;

    // Check Redis cache first
    const cached = await redis.get(cacheKey);

    if (cached) {
        return JSON.parse(cached) as MerchantIdentity;
    }

    // Cache miss — check database
    // We import prisma lazily here to avoid circular deps
    const { prisma } = await import('@platform/database');

    const apiKey = await prisma.apiKey.findUnique({
        where: { hashedKey, isActive: true },
    });

    if (!apiKey) return null;

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    const identity: MerchantIdentity = {
        type: 'merchant',
        id: apiKey.id,
        merchantId: apiKey.merchantId,
        permissions: apiKey.permissions,
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(identity));

    // Update last used timestamp in background — do not await
    prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
    }).catch(() => { });

    return identity;
};