import axios from 'axios';

import { logger } from '@auth/shared';

/**
 * CAPTCHA verification service
 * Supports reCAPTCHA and hCaptcha
 */
export class CaptchaService {
  private readonly provider: string;
  private readonly secretKey: string;

  constructor() {
    this.provider = process.env.CAPTCHA_PROVIDER || 'recaptcha';
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY || '';
  }

  /**
   * Verify CAPTCHA token
   * @param token - CAPTCHA token from client
   * @param ipAddress - User's IP address
   * @returns True if verification successful
   */
  async verify(token: string, ipAddress?: string): Promise<boolean> {
    // Skip verification in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    if (!this.secretKey) {
      logger.warn('CAPTCHA secret key not configured, skipping verification');
      return true;
    }

    try {
      if (this.provider === 'recaptcha') {
        return await this.verifyRecaptcha(token, ipAddress);
      } else if (this.provider === 'hcaptcha') {
        return await this.verifyHCaptcha(token, ipAddress);
      }

      logger.error('Unknown CAPTCHA provider', { provider: this.provider });
      return false;
    } catch (error) {
      logger.error('CAPTCHA verification failed', { error });
      return false;
    }
  }

  /**
   * Verify Google reCAPTCHA token
   */
  private async verifyRecaptcha(token: string, ipAddress?: string): Promise<boolean> {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: this.secretKey,
          response: token,
          remoteip: ipAddress,
        },
      }
    );

    const { success, score } = response.data;

    // For reCAPTCHA v3, check score (0.0 - 1.0)
    if (score !== undefined) {
      return success && score >= 0.5;
    }

    // For reCAPTCHA v2, just check success
    return success;
  }

  /**
   * Verify hCaptcha token
   */
  private async verifyHCaptcha(token: string, ipAddress?: string): Promise<boolean> {
    const response = await axios.post(
      'https://hcaptcha.com/siteverify',
      null,
      {
        params: {
          secret: this.secretKey,
          response: token,
          remoteip: ipAddress,
        },
      }
    );

    return response.data.success;
  }
}

export const captchaService = new CaptchaService();
