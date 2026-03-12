const { defineConfig } = require('@medusajs/utils');
const { Modules } = require('@medusajs/utils');

require('dotenv').config();

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.MEDUSA_DATABASE_URL,
    redisUrl: process.env.MEDUSA_REDIS_URL,
    http: {
      adminCors: process.env.ADMIN_CORS ?? 'http://localhost:9001',
      authCors: process.env.AUTH_CORS ?? 'http://localhost:9001',
      storeCors: process.env.STORE_CORS ?? 'http://localhost:8000',
      jwtSecret: process.env.JWT_SECRET ?? 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET ?? 'supersecret',
    },
  },

  modules: {
    // ── Feature modules ───────────────────────────────────────────────────────
    [Modules.ORDER]: true,
    [Modules.CUSTOMER]: true,
    [Modules.PRODUCT]: true,
    [Modules.INVENTORY]: true,
    [Modules.CART]: true,

    // ── Payment module with Hyperswitch provider ───────────────────────────────
    [Modules.PAYMENT]: {
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

    // ── Infrastructure modules ────────────────────────────────────────────────
    [Modules.CACHE]: {
      resolve: '@medusajs/cache-redis',
      options: {
        redisUrl: process.env.MEDUSA_REDIS_URL,
      },
    },

    [Modules.EVENT_BUS]: {
      resolve: '@medusajs/event-bus-redis',
      options: {
        redisUrl: process.env.MEDUSA_REDIS_URL,
      },
    },

    [Modules.WORKFLOW_ENGINE]: {
      resolve: '@medusajs/workflow-engine-redis',
      options: {
        redis: {
          url: process.env.MEDUSA_REDIS_URL,
        },
      },
    },
  },
});