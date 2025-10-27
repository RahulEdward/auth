import { Request, Response, NextFunction } from 'express';
import { redis, logger } from '@auth/shared';
import { AuthenticatedRequest } from './auth.middleware';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix?: string; // Redis key prefix
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export const rateLimitMiddleware = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'ratelimit',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Determine rate limit key (user ID or IP address)
      const user = (req as AuthenticatedRequest).user;
      const identifier = user?.id || req.ip || 'unknown';
      const key = `${keyPrefix}:${identifier}`;

      // Get current count
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(windowMs / 1000);

        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', (Date.now() + retryAfter * 1000).toString());
        res.setHeader('Retry-After', retryAfter.toString());

        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
          },
        });
        return;
      }

      // Increment counter
      const newCount = count + 1;
      
      if (count === 0) {
        // First request in window, set with expiry
        await redis.set(key, newCount.toString(), Math.ceil(windowMs / 1000));
      } else {
        // Increment existing counter
        const currentVal = await redis.get(key);
        await redis.set(key, (parseInt(currentVal || '0', 10) + 1).toString());
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - newCount).toString());
      
      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Reset', (Date.now() + ttl * 1000).toString());

      // Handle response to potentially skip counting
      if (skipSuccessfulRequests || skipFailedRequests) {
        res.on('finish', async () => {
          const shouldSkip =
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            const currentVal = await redis.get(key);
            if (currentVal) {
              await redis.set(key, (parseInt(currentVal, 10) - 1).toString());
            }
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', { error });
      next(error);
    }
  };
};

// Preset rate limiters
export const authRateLimiter = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyPrefix: 'ratelimit:auth',
  skipSuccessfulRequests: true,
});

export const apiRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 1000,
  keyPrefix: 'ratelimit:api',
});

export const strictRateLimiter = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyPrefix: 'ratelimit:strict',
});
