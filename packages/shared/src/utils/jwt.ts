import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { config } from '../config';
import { JWTPayload, TokenPair } from '../types';
import { logger } from './logger';

/**
 * Generate access and refresh token pair
 * @param payload - Token payload data
 * @returns Token pair with expiration
 */
export function generateTokenPair(payload: {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
}): TokenPair {
  const now = Math.floor(Date.now() / 1000);

  // Access token payload
  const accessPayload: JWTPayload = {
    sub: payload.userId,
    email: payload.email,
    roles: payload.roles,
    permissions: payload.permissions,
    sessionId: payload.sessionId,
    iat: now,
    exp: now + parseExpiry(config.jwt.accessExpiry),
    iss: 'auth.system',
    aud: 'api.system',
  };

  // Refresh token payload (minimal data)
  const refreshPayload = {
    sub: payload.userId,
    sessionId: payload.sessionId,
    tokenFamily: crypto.randomUUID(),
    iat: now,
    exp: now + parseExpiry(config.jwt.refreshExpiry),
    iss: 'auth.system',
  };

  const accessToken = jwt.sign(accessPayload, config.jwt.accessSecret, {
    algorithm: 'HS256',
  });

  const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, {
    algorithm: 'HS256',
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: parseExpiry(config.jwt.accessExpiry),
  };
}

/**
 * Verify and decode access token
 * @param token - JWT access token
 * @returns Decoded payload
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      algorithms: ['HS256'],
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_TOKEN');
    }
    logger.error('Token verification failed', { error });
    throw new Error('INVALID_TOKEN');
  }
}

/**
 * Verify and decode refresh token
 * @param token - JWT refresh token
 * @returns Decoded payload
 */
export function verifyRefreshToken(token: string): {
  sub: string;
  sessionId?: string;
  tokenFamily: string;
  iat: number;
  exp: number;
} {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      algorithms: ['HS256'],
    }) as {
      sub: string;
      sessionId?: string;
      tokenFamily: string;
      iat: number;
      exp: number;
    };
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_TOKEN');
    }
    logger.error('Refresh token verification failed', { error });
    throw new Error('INVALID_TOKEN');
  }
}

/**
 * Decode token without verification (for debugging)
 * @param token - JWT token
 * @returns Decoded payload
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a random token for email verification, password reset, etc.
 * @param length - Token length in bytes (default: 32)
 * @returns Random token string
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage
 * @param token - Plain token
 * @returns Hashed token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse expiry string to seconds
 * Supports: 15m, 1h, 7d, 30d
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Invalid expiry unit: ${unit}`);
  }
}
