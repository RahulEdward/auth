import {
  db,
  redis,
  logger,
  hashPassword,
  verifyPassword,
  generateTokenPair,
  generateRandomToken,
  hashToken,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  AccountLockedError,
  AccountDeactivatedError,
  EmailNotVerifiedError,
  TokenPair,
} from '@auth/shared';

import { captchaService } from './captcha.service';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  captchaToken: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface PasswordResetRequestInput {
  email: string;
}

interface PasswordResetInput {
  token: string;
  newPassword: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput, ipAddress: string): Promise<{ userId: string; message: string }> {
    const { email, password, name, captchaToken } = input;

    // Verify CAPTCHA
    const captchaValid = await captchaService.verify(captchaToken, ipAddress);
    if (!captchaValid) {
      throw new Error('CAPTCHA verification failed');
    }

    // Check if email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new EmailAlreadyExistsError();
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, email_verified, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [email, passwordHash, name, false, 'active']
    );

    const userId = result.rows[0].id;

    // Assign default 'user' role
    const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', ['user']);
    if (roleResult.rows.length > 0) {
      await db.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [userId, roleResult.rows[0].id]
      );
    }

    // Generate email verification token
    const verificationToken = generateRandomToken();
    const tokenHash = hashToken(verificationToken);

    // Store token in Redis with 24-hour expiration
    await redis.set(`email_verify:${tokenHash}`, userId, 24 * 60 * 60);

    // Queue email verification message
    const { notificationService } = await import('./notification.service');
    await notificationService.queueEmailVerification(email, verificationToken);

    logger.info('User registered', { userId, email });
    logger.debug('Verification token (dev only)', { token: verificationToken });

    return {
      userId,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = hashToken(token);

    // Get user ID from Redis
    const userId = await redis.get(`email_verify:${tokenHash}`);
    if (!userId) {
      throw new Error('Invalid or expired verification token');
    }

    // Update user email_verified status
    await db.query('UPDATE users SET email_verified = $1 WHERE id = $2', [true, userId]);

    // Delete token from Redis
    await redis.del(`email_verify:${tokenHash}`);

    logger.info('Email verified', { userId });

    return { message: 'Email verified successfully' };
  }

  /**
   * Login with email and password
   */
  async login(
    input: LoginInput,
    ipAddress: string,
    userAgent: string
  ): Promise<TokenPair & { requiresMfa: boolean; mfaToken?: string }> {
    const { email, password } = input;

    // Check rate limiting for failed attempts
    const lockKey = `account_lock:${email}`;
    const isLocked = await redis.exists(lockKey);
    if (isLocked) {
      const ttl = await redis.ttl(lockKey);
      throw new AccountLockedError(ttl);
    }

    // Fetch user
    const result = await db.query(
      `SELECT id, email, password_hash, email_verified, status, mfa_enabled, mfa_method
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      await this.handleFailedLogin(email);
      throw new InvalidCredentialsError();
    }

    const user = result.rows[0];

    // Check account status
    if (user.status === 'deactivated') {
      throw new AccountDeactivatedError();
    }

    if (user.status === 'deleted') {
      throw new InvalidCredentialsError();
    }

    // Verify password
    const isValidPassword = await verifyPassword(user.password_hash, password);
    if (!isValidPassword) {
      await this.handleFailedLogin(email);
      throw new InvalidCredentialsError();
    }

    // Check email verification
    if (!user.email_verified) {
      throw new EmailNotVerifiedError();
    }

    // Reset failed login counter
    await redis.del(`failed_login:${email}`);

    // Check if MFA is enabled
    if (user.mfa_enabled) {
      // Generate temporary MFA token
      const mfaToken = generateRandomToken();
      const mfaTokenHash = hashToken(mfaToken);

      // Store MFA token in Redis with 5-minute expiration
      await redis.set(`mfa:${mfaTokenHash}`, user.id, 5 * 60);

      logger.info('MFA required for login', { userId: user.id, method: user.mfa_method });

      return {
        accessToken: '',
        refreshToken: '',
        expiresIn: 0,
        requiresMfa: true,
        mfaToken,
      };
    }

    // Fetch user roles and permissions
    const rolesResult = await db.query(
      `SELECT r.name, r.permissions
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
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

    // Parse device info
    const { parseUserAgent } = await import('../utils/device-parser');
    const deviceInfo = parseUserAgent(userAgent);

    // Create session record
    const { sessionService } = await import('./session.service');
    await sessionService.createSession({
      userId: user.id,
      refreshToken: tokens.refreshToken,
      deviceInfo: {
        userAgent,
        ...deviceInfo,
      },
      ipAddress,
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    return {
      ...tokens,
      requiresMfa: false,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const { sessionService } = await import('./session.service');
    const { verifyRefreshToken } = await import('@auth/shared');

    // Verify refresh token signature and get token family
    let tokenFamily: string;
    try {
      const decoded = verifyRefreshToken(refreshToken);
      tokenFamily = decoded.tokenFamily;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }

    // Check for token reuse (security breach detection)
    const tokenHash = hashToken(refreshToken);
    const reuseCheck = await redis.get(`token_family_revoked:${tokenFamily}`);
    if (reuseCheck) {
      // Token family has been revoked - possible replay attack
      logger.error('Token reuse detected - revoking all user sessions', { tokenFamily });
      
      // Get user ID from the revoked token
      const userId = await redis.get(`refresh_token:${tokenHash}`);
      if (userId) {
        await sessionService.revokeAllUserSessions(userId);
      }
      
      throw new Error('Token reuse detected. All sessions have been revoked for security.');
    }

    // Validate refresh token exists and get user ID
    const userId = await sessionService.validateRefreshToken(refreshToken);
    if (!userId) {
      throw new Error('Invalid or expired refresh token');
    }

    // Fetch user and roles
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

    // Mark old token family as revoked (for reuse detection)
    await redis.set(`token_family_revoked:${tokenFamily}`, '1', 30 * 24 * 60 * 60); // 30 days

    // Revoke old refresh token
    await sessionService.revokeRefreshToken(refreshToken);

    // Generate new token pair
    const newTokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      roles,
      permissions,
    });

    // Create new session
    await sessionService.createSession({
      userId: user.id,
      refreshToken: newTokens.refreshToken,
      deviceInfo: {
        userAgent: '',
        browser: '',
        browserVersion: '',
        os: '',
        osVersion: '',
        device: '',
      },
      ipAddress: '',
    });

    logger.info('Token refreshed', { userId });

    return newTokens;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(input: PasswordResetRequestInput): Promise<{ message: string }> {
    const { email } = input;

    // Check if user exists with verified email
    const result = await db.query(
      'SELECT id, email_verified FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    // Always return success message for security (don't reveal if email exists)
    if (result.rows.length === 0 || !result.rows[0].email_verified) {
      logger.info('Password reset requested for non-existent or unverified email', { email });
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    const userId = result.rows[0].id;

    // Generate reset token
    const resetToken = generateRandomToken();
    const tokenHash = hashToken(resetToken);

    // Invalidate any existing reset tokens for this user
    const existingTokens = await redis.get(`reset_tokens:${userId}`);
    if (existingTokens) {
      const tokens = JSON.parse(existingTokens) as string[];
      for (const token of tokens) {
        await redis.del(`password_reset:${token}`);
      }
    }

    // Store new token in Redis with 1-hour expiration
    await redis.set(`password_reset:${tokenHash}`, userId, 60 * 60);
    await redis.set(`reset_tokens:${userId}`, JSON.stringify([tokenHash]), 60 * 60);

    // Queue password reset email
    const { notificationService } = await import('./notification.service');
    await notificationService.queuePasswordReset(email, resetToken);

    logger.info('Password reset requested', { userId, email });
    logger.debug('Reset token (dev only)', { token: resetToken });

    return { message: 'If the email exists, a password reset link has been sent.' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(input: PasswordResetInput): Promise<{ message: string }> {
    const { token, newPassword } = input;

    const tokenHash = hashToken(token);

    // Get user ID from Redis
    const userId = await redis.get(`password_reset:${tokenHash}`);
    if (!userId) {
      throw new Error('Invalid or expired reset token');
    }

    // Get user's password history
    const userResult = await db.query(
      'SELECT password_history FROM users WHERE id = $1',
      [userId]
    );

    const passwordHistory = userResult.rows[0]?.password_history || [];

    // Check if new password matches any of last 5 passwords
    for (const oldHash of passwordHistory.slice(0, 5)) {
      const matches = await verifyPassword(oldHash, newPassword);
      if (matches) {
        throw new Error('Password has been used recently. Please choose a different password.');
      }
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password and add old hash to history
    const currentHash = userResult.rows[0]?.password_hash;
    const updatedHistory = currentHash
      ? [currentHash, ...passwordHistory].slice(0, 5)
      : passwordHistory;

    await db.query(
      'UPDATE users SET password_hash = $1, password_history = $2 WHERE id = $3',
      [newPasswordHash, updatedHistory, userId]
    );

    // Delete reset token
    await redis.del(`password_reset:${tokenHash}`);
    await redis.del(`reset_tokens:${userId}`);

    // Revoke all active sessions for this user
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    // Queue password changed notification email
    const userEmail = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userEmail.rows.length > 0) {
      const { notificationService } = await import('./notification.service');
      await notificationService.queuePasswordChanged(userEmail.rows[0].email);
    }

    logger.info('Password reset successful', { userId });

    return { message: 'Password reset successful. Please log in with your new password.' };
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(email: string): Promise<void> {
    const key = `failed_login:${email}`;
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      // Set expiration on first attempt (15 minutes)
      await redis.expire(key, 15 * 60);
    }

    if (attempts >= 5) {
      // Lock account for 30 minutes
      const lockKey = `account_lock:${email}`;
      await redis.set(lockKey, '1', 30 * 60);
      await redis.del(key);

      logger.warn('Account locked due to failed login attempts', { email, attempts });
    }
  }
}

export const authService = new AuthService();
