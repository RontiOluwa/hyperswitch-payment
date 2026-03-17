import pino from 'pino';

export const createLogger = (serviceName: string) => {
    return pino({
        name: serviceName,
        level: process.env.LOG_LEVEL ?? 'info',
        // Pretty print in development, JSON in production
        transport: process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        // Every log line includes these fields automatically
        base: {
            service: serviceName,
            env: process.env.NODE_ENV,
        },
        // ISO timestamp on every log line
        timestamp: pino.stdTimeFunctions.isoTime,
    });
};

export type Logger = ReturnType<typeof createLogger>;