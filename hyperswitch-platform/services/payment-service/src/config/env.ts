import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
    PORT: z.string().default('3001').transform(Number),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379').transform(Number),
    REDIS_PASSWORD: z.string().min(1, 'REDIS_PASSWORD is required'),

    INTERNAL_SERVICE_SECRET: z.string().min(32),

    // Hyperswitch
    HYPERSWITCH_API_KEY: z.string().min(1, 'HYPERSWITCH_API_KEY is required'),
    HYPERSWITCH_BASE_URL: z.string().url().default('https://sandbox.hyperswitch.io'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;