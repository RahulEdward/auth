import dotenv from 'dotenv';
import Joi from 'joi';

// Load .env from current working directory (project root)
dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_MIN: Joi.number().default(2),
  DATABASE_POOL_MAX: Joi.number().default(10),
  
  // Redis
  REDIS_URL: Joi.string().required(),
  
  // JWT
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('30d'),
  
  // CORS
  ALLOWED_ORIGINS: Joi.string().required(),
  
  // Email
  EMAIL_PROVIDER: Joi.string().default('mailhog'),
  EMAIL_HOST: Joi.string().required(),
  EMAIL_PORT: Joi.number().required(),
  EMAIL_FROM: Joi.string().email().required(),
  
  // Security
  ENCRYPTION_KEY: Joi.string().min(32).required(),
  CSRF_SECRET: Joi.string().required(),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV as string,
  port: envVars.PORT as number,
  
  database: {
    url: envVars.DATABASE_URL as string,
    poolMin: envVars.DATABASE_POOL_MIN as number,
    poolMax: envVars.DATABASE_POOL_MAX as number,
  },
  
  redis: {
    url: envVars.REDIS_URL as string,
  },
  
  jwt: {
    accessSecret: envVars.JWT_ACCESS_SECRET as string,
    refreshSecret: envVars.JWT_REFRESH_SECRET as string,
    accessExpiry: envVars.JWT_ACCESS_EXPIRY as string,
    refreshExpiry: envVars.JWT_REFRESH_EXPIRY as string,
  },
  
  cors: {
    allowedOrigins: (envVars.ALLOWED_ORIGINS as string).split(','),
  },
  
  email: {
    provider: envVars.EMAIL_PROVIDER as string,
    host: envVars.EMAIL_HOST as string,
    port: envVars.EMAIL_PORT as number,
    from: envVars.EMAIL_FROM as string,
  },
  
  security: {
    encryptionKey: envVars.ENCRYPTION_KEY as string,
    csrfSecret: envVars.CSRF_SECRET as string,
  },
  
  logging: {
    level: envVars.LOG_LEVEL as string,
    format: envVars.LOG_FORMAT as string,
  },
};
