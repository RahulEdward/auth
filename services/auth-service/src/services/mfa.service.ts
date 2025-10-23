import {
  db,
  redis,
  logger,
  generateRandomToken,
  hashToken,
  verifyPassword,
} from '@auth/shared';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

interface TOTPEnrollmentResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface MFAVerificationResult {
  success: boolean;
  message?: string;
}

export class MFAService {
  /**
   * Enroll user in TOTP MFA
   */
  async enrollTOTP(userId: string, userEmail: string): Promise<TOTPEnrollmentResponse> {
    // Check if user already has MFA enabled
    const userResult = await db.query(
      'SELECT mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    if (userResult.rows[0].mfa_enabled) {
      throw new Error('MFA is already enabled for this user');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Auth System (${userEmail})`,
      issuer: 'Enterprise Auth System',
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate 10 backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Store temporary secret and backup codes in Redis (15 minutes)
    const tempData = {
      secret: secret.base32,
      backupCodes: backupCodes.map((code) => hashToken(code)),
      timestamp: Date.now(),
    };

    await redis.set(
      `mfa_enrollment:${userId}`,
      JSON.stringify(tempData),
      15 * 60 // 15 minutes
    );

    // Store original backup codes separately for later retrieval
    await redis.set(
      `mfa_backup_codes:${userId}`,
      JSON.stringify(backupCodes),
      15 * 60 // 15 minutes
    );

    logger.info('TOTP enrollment initiated', { userId });

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify TOTP enrollment and activate MFA
   */
  async verifyTOTPEnrollment(
    userId: string,
    code: string
  ): Promise<{ success: boolean; backupCodes: string[] }> {
    // Get temporary enrollment data from Redis
    const tempDataStr = await redis.get(`mfa_enrollment:${userId}`);
    if (!tempDataStr) {
      throw new Error('No pending MFA enrollment found or enrollment expired');
    }

    const tempData = JSON.parse(tempDataStr);

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: tempData.secret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 time steps before and after
    });

    if (!verified) {
      throw new Error('Invalid verification code');
    }

    // Encrypt the secret before storing
    const encryptedSecret = this.encryptSecret(tempData.secret);

    // Update user record with MFA settings
    await db.query(
      `UPDATE users 
       SET mfa_enabled = $1, 
           mfa_method = $2, 
           mfa_secret = $3, 
           backup_codes = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [true, 'totp', encryptedSecret, tempData.backupCodes, userId]
    );

    // Delete temporary enrollment data
    await redis.del(`mfa_enrollment:${userId}`);

    // Decrypt backup codes for display (they were hashed)
    // We need to return the original codes from tempData
    const originalBackupCodes = await redis.get(`mfa_backup_codes:${userId}`);
    let backupCodes: string[] = [];
    
    if (originalBackupCodes) {
      backupCodes = JSON.parse(originalBackupCodes);
      await redis.del(`mfa_backup_codes:${userId}`);
    }

    logger.info('TOTP MFA activated', { userId });

    return {
      success: true,
      backupCodes,
    };
  }

  /**
   * Verify TOTP code during login
   */
  async verifyTOTP(userId: string, code: string): Promise<MFAVerificationResult> {
    // Get user's MFA secret
    const userResult = await db.query(
      'SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (!user.mfa_enabled || !user.mfa_secret) {
      throw new Error('MFA is not enabled for this user');
    }

    // Check if code was already used (replay protection)
    const usedCodeKey = `mfa_used_code:${userId}:${code}`;
    const wasUsed = await redis.exists(usedCodeKey);
    
    if (wasUsed) {
      logger.warn('Attempted to reuse MFA code', { userId });
      return {
        success: false,
        message: 'This code has already been used',
      };
    }

    // Decrypt secret
    const secret = this.decryptSecret(user.mfa_secret);

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1, // Allow 1 time step before and after (90 seconds total)
    });

    if (!verified) {
      return {
        success: false,
        message: 'Invalid verification code',
      };
    }

    // Mark code as used (valid for 90 seconds)
    await redis.set(usedCodeKey, '1', 90);

    logger.info('TOTP verification successful', { userId });

    return {
      success: true,
    };
  }

  /**
   * Generate and send SMS MFA code
   */
  async sendSMSCode(userId: string, phoneNumber: string): Promise<void> {
    // Check rate limiting (max 3 codes per 5 minutes)
    const rateLimitKey = `mfa_sms_rate:${userId}`;
    const attempts = await redis.incr(rateLimitKey);
    
    if (attempts === 1) {
      await redis.expire(rateLimitKey, 5 * 60); // 5 minutes
    }
    
    if (attempts > 3) {
      throw new Error('Too many MFA code requests. Please try again in 5 minutes.');
    }

    // Generate 6-digit code
    const code = this.generateNumericCode(6);
    const codeHash = hashToken(code);

    // Store hashed code in Redis (5 minutes)
    await redis.set(`mfa_sms_code:${userId}`, codeHash, 5 * 60);

    // Send SMS via notification service
    const { notificationService } = await import('./notification.service');
    await notificationService.queueMFACodeSMS(phoneNumber, code);

    logger.info('SMS MFA code sent', { userId });
  }

  /**
   * Generate and send Email MFA code
   */
  async sendEmailCode(userId: string, email: string): Promise<void> {
    // Check rate limiting (max 3 codes per 5 minutes)
    const rateLimitKey = `mfa_email_rate:${userId}`;
    const attempts = await redis.incr(rateLimitKey);
    
    if (attempts === 1) {
      await redis.expire(rateLimitKey, 5 * 60); // 5 minutes
    }
    
    if (attempts > 3) {
      throw new Error('Too many MFA code requests. Please try again in 5 minutes.');
    }

    // Generate 6-digit code
    const code = this.generateNumericCode(6);
    const codeHash = hashToken(code);

    // Store hashed code in Redis (5 minutes)
    await redis.set(`mfa_email_code:${userId}`, codeHash, 5 * 60);

    // Send email via notification service
    const { notificationService } = await import('./notification.service');
    await notificationService.queueMFACodeEmail(email, code);

    logger.info('Email MFA code sent', { userId });
  }

  /**
   * Verify SMS or Email MFA code
   */
  async verifySMSOrEmailCode(
    userId: string,
    code: string,
    method: 'sms' | 'email'
  ): Promise<MFAVerificationResult> {
    const codeKey = method === 'sms' 
      ? `mfa_sms_code:${userId}` 
      : `mfa_email_code:${userId}`;

    // Get stored code hash
    const storedHash = await redis.get(codeKey);
    
    if (!storedHash) {
      return {
        success: false,
        message: 'Code expired or not found',
      };
    }

    // Verify code
    const codeHash = hashToken(code);
    
    if (codeHash !== storedHash) {
      return {
        success: false,
        message: 'Invalid verification code',
      };
    }

    // Delete used code
    await redis.del(codeKey);

    logger.info(`${method.toUpperCase()} MFA verification successful`, { userId });

    return {
      success: true,
    };
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<MFAVerificationResult> {
    // Get user's backup codes
    const userResult = await db.query(
      'SELECT backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const backupCodes = userResult.rows[0].backup_codes || [];

    if (backupCodes.length === 0) {
      return {
        success: false,
        message: 'No backup codes available',
      };
    }

    // Hash the provided code and check if it matches any stored hash
    const codeHash = hashToken(code);
    const matchIndex = backupCodes.findIndex((hash: string) => hash === codeHash);

    if (matchIndex === -1) {
      return {
        success: false,
        message: 'Invalid backup code',
      };
    }

    // Remove used backup code
    const updatedCodes = backupCodes.filter((_: string, index: number) => index !== matchIndex);
    
    await db.query(
      'UPDATE users SET backup_codes = $1, updated_at = NOW() WHERE id = $2',
      [updatedCodes, userId]
    );

    // Warn if running low on backup codes
    const remainingCount = updatedCodes.length;
    let message = 'Backup code verified successfully';
    
    if (remainingCount <= 3) {
      message += `. Warning: Only ${remainingCount} backup codes remaining.`;
    }

    logger.info('Backup code used', { userId, remainingCodes: remainingCount });

    return {
      success: true,
      message,
    };
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId: string, password: string): Promise<void> {
    // Get user data
    const userResult = await db.query(
      'SELECT password_hash, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await verifyPassword(user.password_hash, password);
    
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Disable MFA
    await db.query(
      `UPDATE users 
       SET mfa_enabled = $1, 
           mfa_method = NULL, 
           mfa_secret = NULL, 
           backup_codes = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [false, userId]
    );

    // Send notification email
    const { notificationService } = await import('./notification.service');
    await notificationService.queueMFADisabled(user.email);

    logger.info('MFA disabled', { userId });
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Generate numeric code
   */
  private generateNumericCode(length: number): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Encrypt MFA secret
   */
  private encryptSecret(secret: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt MFA secret
   */
  private decryptSecret(encryptedSecret: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

    const parts = encryptedSecret.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export const mfaService = new MFAService();
