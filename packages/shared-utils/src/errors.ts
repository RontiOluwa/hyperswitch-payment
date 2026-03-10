// Base class all platform errors extend from
export class AppError extends Error {
    constructor(
        public readonly message: string,
        public readonly statusCode: number,
        public readonly code: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: unknown) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
    }
}

export class PaymentError extends AppError {
    constructor(message: string, details?: unknown) {
        super(message, 422, 'PAYMENT_ERROR', details);
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(service: string) {
        super(`${service} is unavailable`, 503, 'SERVICE_UNAVAILABLE');
    }
}

// Type guard — check if an unknown error is an AppError
export const isAppError = (error: unknown): error is AppError => {
    return error instanceof AppError;
}