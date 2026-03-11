import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '@platform/shared-utils';

export const authPlugin = fp(async (app) => {
  app.addHook('preHandler', async (request) => {
    const skipAuth = (request.routeOptions?.config as any)?.skipAuth;
    if (skipAuth) return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Internal service token required');
    }

    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, env.INTERNAL_SERVICE_SECRET) as jwt.JwtPayload;
      if (payload.type !== 'service') throw new Error();
    } catch {
      throw new UnauthorizedError('Invalid service token');
    }
  });
});
