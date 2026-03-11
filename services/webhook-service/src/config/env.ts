import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3002').transform(Number),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().min(1, 'REDIS_PASSWORD is required'),

  INTERNAL_SERVICE_SECRET: z.string().min(32),

  // Hyperswitch webhook signature secret
  // Found in your Hyperswitch dashboard under Developers > Webhooks
  HYPERSWITCH_WEBHOOK_SECRET: z.string().min(1, 'HYPERSWITCH_WEBHOOK_SECRET is required'),

  // Downstream service URLs
  PAYMENT_SERVICE_URL: z.string().url(),
  MEDUSA_URL: z.string().url().default('http://localhost:9000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
