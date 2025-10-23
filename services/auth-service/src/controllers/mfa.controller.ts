import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import { mfaService } from '../services/mfa.service';
import { authService } from '../services/auth.service';

export class MFAController {
  /**
   * POST /mfa/totp/enroll
   * Enroll in TOTP MFA
   */
  async enrollTOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get user from authenticated request
      const userId = (req as any).user?.userId;
      const userEmail = (req as any).user?.email;

      if (!userId || !userEmail) {
        throw new Error('Authentication required');
      }

      const result = await mfaService.enrollTOTP(userId, userEmail);

      res.status(200).json({
        message: 'TOTP enrollment initiated. Scan the QR code with your authenticator app.',
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /mfa/totp/verify-enrollment
   * Verify TOTP enrollment and activate MFA
   */
  async verifyTOTPEnrollment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        throw new Error('Verification code is required');
      }

      const result = await mfaService.verifyTOTPEnrollment(userId, code);

      res.status(200).json({
        message: 'MFA has been successfully enabled',
        success: result.success,
        backupCodes: result.backupCodes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /mfa/verify
   * Verify MFA code during login
   */
  async verifyMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mfaToken, code, method, backupCode } = req.body;

      if (!mfaToken || typeof mfaToken !== 'string') {
        throw new Error('MFA token is required');
      }

      // Get user ID from MFA token (stored in Redis during login)
      const { redis, hashToken } = await import('@auth/shared');
      const tokenHash = hashToken(mfaToken);
      const userId = await redis.get(`mfa:${tokenHash}`);

      if (!userId) {
        throw new Error('Invalid or expired MFA token');
      }

      let verificationResult;

      // Verify based on method
      if (backupCode) {
        // Backup code verification
        verificationResult = await mfaService.verifyBackupCode(userId, backupCode);
      } else if (method === 'totp') {
        // TOTP verification
        if (!code) {
          throw new Error('Verification code is required');
        }
        verificationResult = await mfaService.verifyTOTP(userId, code);
      } else if (method === 'sms' || method === 'email') {
        // SMS or Email verification
        if (!code) {
          throw new Error('Verification code is required');
        }
        verificationResult = await mfaService.verifySMSOrEmailCode(userId, code, method);
      } else {
        throw new Error('Invalid MFA method');
      }

      if (!verificationResult.success) {
        res.status(400).json({
          error: verificationResult.message || 'MFA verification failed',
        });
        return;
      }

      // Delete MFA token
      await redis.del(`mfa:${tokenHash}`);

      // Generate JWT tokens (complete the login)
      const { db, generateTokenPair } = await import('@auth/shared');
      
      // Fetch user data
      const userResult = await db.query(
        'SELECT id, email, status FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || userResult.rows[0].status !== 'active') {
        throw new Error('User not found or inactive');
      }

      const user = userResult.rows[0];

      // Fetch roles and permissions
      const rolesResult = await db.query(
        `SELECT r.name, r.permissions
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId]
      );

      const roles = rolesResult.rows.map((r) => r.name);
      const permissions = [...new Set(rolesResult.rows.flatMap((r) => r.permissions))];

      // Generate tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        roles,
        permissions,
      });

      // Create session
      const { sessionService } = await import('../services/session.service');
      const ipAddress = (req.ip || req.socket.remoteAddress) as string;
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const { parseUserAgent } = await import('../utils/device-parser');
      const deviceInfo = parseUserAgent(userAgent);

      await sessionService.createSession({
        userId: user.id,
        refreshToken: tokens.refreshToken,
        deviceInfo: {
          userAgent,
          ...deviceInfo,
        },
        ipAddress,
      });

      logger.info('MFA verification successful, login complete', { userId });

      res.status(200).json({
        message: verificationResult.message || 'MFA verification successful',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /mfa/sms/send
   * Send SMS MFA code
   */
  async sendSMSCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mfaToken } = req.body;

      if (!mfaToken || typeof mfaToken !== 'string') {
        throw new Error('MFA token is required');
      }

      // Get user ID from MFA token
      const { redis, hashToken, db } = await import('@auth/shared');
      const tokenHash = hashToken(mfaToken);
      const userId = await redis.get(`mfa:${tokenHash}`);

      if (!userId) {
        throw new Error('Invalid or expired MFA token');
      }

      // Get user's phone number
      const userResult = await db.query(
        'SELECT phone_number FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].phone_number) {
        throw new Error('Phone number not found');
      }

      await mfaService.sendSMSCode(userId, userResult.rows[0].phone_number);

      res.status(200).json({
        message: 'SMS code sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /mfa/email/send
   * Send Email MFA code
   */
  async sendEmailCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mfaToken } = req.body;

      if (!mfaToken || typeof mfaToken !== 'string') {
        throw new Error('MFA token is required');
      }

      // Get user ID from MFA token
      const { redis, hashToken, db } = await import('@auth/shared');
      const tokenHash = hashToken(mfaToken);
      const userId = await redis.get(`mfa:${tokenHash}`);

      if (!userId) {
        throw new Error('Invalid or expired MFA token');
      }

      // Get user's email
      const userResult = await db.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      await mfaService.sendEmailCode(userId, userResult.rows[0].email);

      res.status(200).json({
        message: 'Email code sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /mfa/disable
   * Disable MFA
   */
  async disableMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { password } = req.body;

      if (!password || typeof password !== 'string') {
        throw new Error('Password is required to disable MFA');
      }

      await mfaService.disableMFA(userId, password);

      res.status(200).json({
        message: 'MFA has been disabled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const mfaController = new MFAController();
