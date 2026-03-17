import crypto from 'crypto';

// Generates a deterministic idempotency key from inputs
// Same inputs within the same hour = same key
// Prevents duplicate payments on network retries
export const generateIdempotencyKey = (
    ...parts: string[]
): string => {
    const hourBucket = Math.floor(Date.now() / 3_600_000).toString();
    const payload = [...parts, hourBucket].join(':');
    return crypto.createHash('sha256').update(payload).digest('hex');
};

// Generates a random idempotency key for one-off operations
export const generateRandomKey = (): string => {
    return crypto.randomBytes(32).toString('hex');
};