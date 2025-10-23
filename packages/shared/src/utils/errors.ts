import { ErrorCode, ErrorResponse } from '../types';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Predefined error factories
 */

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, 'Validation failed', 400, details);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401);
  }
}

export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super(ErrorCode.EMAIL_ALREADY_EXISTS, 'Email address already registered', 409);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests, please try again later',
      429,
      retryAfter ? { retryAfter } : undefined
    );
  }
}

export class MFARequiredError extends AppError {
  constructor(mfaToken: string) {
    super(ErrorCode.MFA_REQUIRED, 'Multi-factor authentication required', 403, { mfaToken });
  }
}

export class InvalidMFACodeError extends AppError {
  constructor() {
    super(ErrorCode.INVALID_MFA_CODE, 'Invalid or expired MFA code', 400);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super(ErrorCode.TOKEN_EXPIRED, 'Token has expired', 401);
  }
}

export class InvalidTokenError extends AppError {
  constructor() {
    super(ErrorCode.INVALID_TOKEN, 'Invalid token', 401);
  }
}

export class AccountLockedError extends AppError {
  constructor(retryAfter?: number) {
    super(
      ErrorCode.ACCOUNT_LOCKED,
      'Account temporarily locked due to too many failed login attempts',
      403,
      retryAfter ? { retryAfter } : undefined
    );
  }
}

export class AccountDeactivatedError extends AppError {
  constructor() {
    super(ErrorCode.ACCOUNT_DEACTIVATED, 'Account has been deactivated', 403);
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor() {
    super(ErrorCode.EMAIL_NOT_VERIFIED, 'Email verification required', 403);
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor() {
    super(ErrorCode.SUBSCRIPTION_REQUIRED, 'Active subscription required', 402);
  }
}

export class QuotaExceededError extends AppError {
  constructor(metric: string) {
    super(ErrorCode.QUOTA_EXCEEDED, `${metric} quota exceeded`, 429, { metric });
  }
}

export class PaymentFailedError extends AppError {
  constructor(reason?: string) {
    super(ErrorCode.PAYMENT_FAILED, 'Payment processing failed', 402, reason ? { reason } : undefined);
  }
}

/**
 * Convert error to API response format
 */
export function errorToResponse(error: Error, requestId?: string): ErrorResponse {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Unknown error - don't expose details
  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An internal error occurred',
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}
