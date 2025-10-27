import { Request, Response, NextFunction } from 'express';
import { generateRandomToken, hashToken, ForbiddenError, logger } from '@auth/shared';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export const generateCsrfToken = (): { token: string; hashedToken: string } => {
  const token = generateRandomToken(CSRF_TOKEN_LENGTH);
  const hashedToken = hashToken(token);
  return { token, hashedToken };
};

export const csrfProtectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  try {
    // Get CSRF token from cookie
    const cookieToken = req.cookies[CSRF_COOKIE_NAME];
    
    if (!cookieToken) {
      throw new ForbiddenError('CSRF token missing from cookie');
    }

    // Get CSRF token from header
    const headerToken = req.get(CSRF_HEADER_NAME);
    
    if (!headerToken) {
      throw new ForbiddenError('CSRF token missing from header');
    }

    // Verify tokens match
    const hashedHeaderToken = hashToken(headerToken);
    
    if (hashedHeaderToken !== cookieToken) {
      throw new ForbiddenError('Invalid CSRF token');
    }

    next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      logger.warn('CSRF validation failed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(403).json({
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: error.message,
        },
      });
      return;
    }

    next(error);
  }
};

export const setCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // Generate new CSRF token if not present
  if (!req.cookies[CSRF_COOKIE_NAME]) {
    const { token, hashedToken } = generateCsrfToken();

    // Set hashed token in httpOnly cookie
    res.cookie(CSRF_COOKIE_NAME, hashedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Send plain token in response header for client to use
    res.setHeader('X-CSRF-Token', token);
  }

  next();
};

// Middleware to get CSRF token
export const getCsrfToken = (req: Request, res: Response): void => {
  const existingToken = req.cookies[CSRF_COOKIE_NAME];

  if (existingToken) {
    // Token already exists, generate a new plain token for the client
    const { token, hashedToken } = generateCsrfToken();
    
    res.cookie(CSRF_COOKIE_NAME, hashedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ csrfToken: token });
  } else {
    // Generate new token
    const { token, hashedToken } = generateCsrfToken();
    
    res.cookie(CSRF_COOKIE_NAME, hashedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ csrfToken: token });
  }
};
