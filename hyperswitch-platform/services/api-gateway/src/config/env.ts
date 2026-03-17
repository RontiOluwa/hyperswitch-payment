import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000').transform(Number),

    AUTH0_DOMAIN: z.string().min(1, 'AUTH0_DOMAIN is required'),
    AUTH0_AUDIENCE: z.string().min(1, 'AUTH0_AUDIENCE is required'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379').transform(Number),
    REDIS_PASSWORD: z.string().min(1, 'REDIS_PASSWORD is required'),

    PAYMENT_SERVICE_URL: z.string().url(),
    WEBHOOK_SERVICE_URL: z.string().url(),
    MEDUSA_URL: z.string().url().default('http://localhost:9000'),
    MEDUSA_ADMIN_EMAIL: z.string().email(),
    MEDUSA_ADMIN_PASSWORD: z.string().min(1),
    MEDUSA_PUBLISHABLE_KEY: z.string().min(1, 'MEDUSA_PUBLISHABLE_KEY is required'),
    INTERNAL_SERVICE_SECRET: z.string().min(32, 'INTERNAL_SERVICE_SECRET must be at least 32 chars'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;