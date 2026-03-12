import { defineConfig, loadEnv } from '@medusajs/utils';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

export default defineConfig({
  projectConfig: {
    // Medusa's own database — separate from our custom services
    databaseUrl: process.env.MEDUSA_DATABASE_URL,
    redisUrl: process.env.MEDUSA_REDIS_URL,
    http: {
      adminCors: process.env.ADMIN_CORS ?? 'http://localhost:7001',
      authCors: process.env.AUTH_CORS ?? 'http://localhost:7001',
      storeCors: process.env.STORE_CORS ?? 'http://localhost:8000',
      jwtSecret: process.env.JWT_SECRET ?? 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET ?? 'supersecret',
    },
  },

  modules: [
    // ── Order Module ──────────────────────────────────────────────────────────
    {
      resolve: '@medusajs/order',
      options: {},
    },

    // ── Customer Module ───────────────────────────────────────────────────────
    {
      resolve: '@medusajs/customer',
      options: {},
    },

    // ── Product Module ────────────────────────────────────────────────────────
    {
      resolve: '@medusajs/product',
      options: {},
    },

    // ── Inventory Module ──────────────────────────────────────────────────────
    {
      resolve: '@medusajs/inventory',
      options: {},
    },

    // ── Cart Module ───────────────────────────────────────────────────────────
    {
      resolve: '@medusajs/cart',
      options: {},
    },

    // ── Payment Module ────────────────────────────────────────────────────────
    // This is where our custom Hyperswitch provider plugs in
    {
      resolve: '@medusajs/payment',
      options: {
        providers: [
          {
            resolve: './src/modules/hyperswitch',
            id: 'hyperswitch',
            options: {
              apiKey: process.env.HYPERSWITCH_API_KEY,
              baseUrl: process.env.HYPERSWITCH_BASE_URL,
              webhookSecret: process.env.HYPERSWITCH_WEBHOOK_SECRET,
            },
          },
        ],
      },
    },

    // ── Notification Module ───────────────────────────────────────────────────
    {
      resolve: '@medusajs/notification',
      options: {
        providers: [
          {
            resolve: '@medusajs/notification-sendgrid',
            id: 'sendgrid',
            options: {
              channels: ['email'],
              api_key: process.env.SENDGRID_API_KEY,
              from: process.env.SENDGRID_FROM_EMAIL,
            },
          },
        ],
      },
    },

    // ── Cache Module (Redis) ──────────────────────────────────────────────────
    {
      resolve: '@medusajs/cache-redis',
      options: {
        redisUrl: process.env.MEDUSA_REDIS_URL,
      },
    },

    // ── Event Bus (Redis) ─────────────────────────────────────────────────────
    {
      resolve: '@medusajs/event-bus-redis',
      options: {
        redisUrl: process.env.MEDUSA_REDIS_URL,
      },
    },

    // ── Workflow Engine (Redis) ───────────────────────────────────────────────
    {
      resolve: '@medusajs/workflow-engine-redis',
      options: {
        redis: {
          url: process.env.MEDUSA_REDIS_URL,
        },
      },
    },
  ],
});
