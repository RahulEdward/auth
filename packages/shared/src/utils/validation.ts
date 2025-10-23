import Joi from 'joi';

/**
 * Common validation schemas
 */

export const emailSchema = Joi.string().email().lowercase().trim().required();

export const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/)
  .required()
  .messages({
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'string.min': 'Password must be at least 8 characters long',
  });

export const uuidSchema = Joi.string()
  .uuid({ version: ['uuidv4'] })
  .required();

export const nameSchema = Joi.string().min(1).max(255).trim().required();

export const phoneSchema = Joi.string()
  .pattern(/^\+?[1-9]\d{1,14}$/)
  .optional()
  .messages({
    'string.pattern.base': 'Phone number must be in E.164 format',
  });

/**
 * Registration validation schema
 */
export const registrationSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  captchaToken: Joi.string().required(),
});

/**
 * Login validation schema
 */
export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required(),
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = Joi.object({
  email: emailSchema,
});

/**
 * Password reset submission schema
 */
export const passwordResetSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordSchema,
});

/**
 * Profile update schema
 */
export const profileUpdateSchema = Joi.object({
  name: nameSchema.optional(),
  phoneNumber: phoneSchema,
  bio: Joi.string().max(500).optional().allow(''),
  preferences: Joi.object({
    language: Joi.string().valid('en', 'es', 'fr', 'de', 'ja', 'zh').optional(),
    timezone: Joi.string().optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      sms: Joi.boolean().optional(),
      push: Joi.boolean().optional(),
    }).optional(),
  }).optional(),
});

/**
 * MFA verification schema
 */
export const mfaVerificationSchema = Joi.object({
  mfaToken: Joi.string().required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
  method: Joi.string().valid('sms', 'email', 'totp').required(),
});

/**
 * Pagination schema
 */
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Validate data against a schema
 * @param schema - Joi schema
 * @param data - Data to validate
 * @returns Validated data
 * @throws Validation error if invalid
 */
export function validate<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    throw {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
    };
  }

  return value as T;
}

/**
 * Sanitize HTML to prevent XSS
 * Basic implementation - consider using DOMPurify for production
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const { error } = emailSchema.validate(email);
  return !error;
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const { error } = uuidSchema.validate(uuid);
  return !error;
}
