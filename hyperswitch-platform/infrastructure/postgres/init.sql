-- Create separate schemas per service
-- Each service owns its schema — no cross-schema queries

CREATE SCHEMA IF NOT EXISTS payment;
CREATE SCHEMA IF NOT EXISTS webhook;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS notification;

-- Grant permissions to platform user
GRANT ALL PRIVILEGES ON SCHEMA payment TO platform_user;
GRANT ALL PRIVILEGES ON SCHEMA webhook TO platform_user;
GRANT ALL PRIVILEGES ON SCHEMA orders TO platform_user;
GRANT ALL PRIVILEGES ON SCHEMA notification TO platform_user;

-- Confirm setup
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('payment', 'webhook', 'orders', 'notification');