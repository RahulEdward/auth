import winston from 'winston';

import { config } from '../config';

const logFormat = config.logging.format === 'json'
  ? winston.format.json()
  : winston.format.simple();

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  defaultMeta: { service: 'auth-system' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Create child logger with additional context
export const createLogger = (context: Record<string, unknown>): winston.Logger => {
  return logger.child(context);
};
