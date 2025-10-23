import { Request, Response, NextFunction } from 'express';

import {
  validate,
  registrationSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from '@auth/shared';

import { authService } from '../services/auth.service';

export class AuthController {
  /**
   * POST /auth/register
   * Register a new user
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validate(registrationSchema, req.body) as any;
      const ipAddress = (req.ip || req.socket.remoteAddress) as string;

      const result = await authService.register(data, ipAddress);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/verify-email
   * Verify email address
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        throw new Error('Verification token is required');
      }

      const result = await authService.verifyEmail(token);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/login
   * Login with email and password
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validate(loginSchema, req.body) as any;
      const ipAddress = (req.ip || req.socket.remoteAddress) as string;
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const result = await authService.login(data, ipAddress, userAgent);

      if (result.requiresMfa) {
        res.status(403).json({
          requiresMfa: true,
          mfaToken: result.mfaToken,
          message: 'Multi-factor authentication required',
        });
      } else {
        res.status(200).json({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/password/reset-request
   * Request password reset
   */
  async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validate(passwordResetRequestSchema, req.body) as any;

      const result = await authService.requestPasswordReset(data);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/password/reset
   * Reset password with token
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validate(passwordResetSchema, req.body) as any;

      const result = await authService.resetPassword(data);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/refresh
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new Error('Refresh token is required');
      }

      const result = await authService.refreshToken(refreshToken);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
