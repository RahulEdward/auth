// Configuration
export { config } from './config';

// Database
export { db } from './database/connection';
export { runMigrations } from './database/migrate';
export { seedDatabase } from './database/seed';

// Cache
export { redis } from './cache/redis';

// Types
export * from './types';

// Utilities
export { logger, createLogger } from './utils/logger';
export {
  hashPassword,
  verifyPassword,
  validatePasswordComplexity,
  generateRandomPassword,
} from './utils/password';
export {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  generateRandomToken,
  hashToken,
} from './utils/jwt';
export {
  validate,
  sanitizeHtml,
  isValidEmail,
  isValidUUID,
  emailSchema,
  passwordSchema,
  uuidSchema,
  nameSchema,
  phoneSchema,
  registrationSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  profileUpdateSchema,
  mfaVerificationSchema,
  paginationSchema,
} from './utils/validation';
export {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  InvalidCredentialsError,
  EmailAlreadyExistsError,
  RateLimitError,
  MFARequiredError,
  InvalidMFACodeError,
  TokenExpiredError,
  InvalidTokenError,
  AccountLockedError,
  AccountDeactivatedError,
  EmailNotVerifiedError,
  SubscriptionRequiredError,
  QuotaExceededError,
  PaymentFailedError,
  errorToResponse,
  isOperationalError,
  getStatusCode,
} from './utils/errors';
