import { PrismaClient } from '@prisma/client';
import { createLogger } from '@platform/shared-utils';

const logger = createLogger('database');

// Prevent multiple Prisma instances in development
// due to hot module reloading
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Graceful shutdown
export const disconnectDatabase = async () => {
    await prisma.$disconnect();
    logger.info('Database disconnected');
};

// Health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
};

export { PrismaClient };
export * from '@prisma/client';