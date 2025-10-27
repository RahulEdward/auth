import { db, logger } from '@auth/shared';

const pool = db;

export interface NotificationPreferences {
  userId: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
  security: boolean;
  updates: boolean;
}

export class PreferenceService {
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const result = await pool.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const prefs = result.rows[0].preferences?.notifications || {};

      return {
        userId,
        email: prefs.email !== false, // Default to true
        sms: prefs.sms !== false,
        push: prefs.push !== false,
        marketing: prefs.marketing !== false,
        security: true, // Always true for security notifications
        updates: prefs.updates !== false,
      };
    } catch (error) {
      logger.error('Failed to get notification preferences', { userId, error });
      throw error;
    }
  }

  async shouldSendEmail(userId: string, category: 'marketing' | 'security' | 'updates'): Promise<boolean> {
    try {
      const prefs = await this.getPreferences(userId);

      // Always send security notifications
      if (category === 'security') {
        return prefs.email;
      }

      // Check category-specific preference
      return prefs.email && prefs[category];
    } catch (error) {
      logger.error('Failed to check email preference', { userId, category, error });
      // Default to sending if we can't determine preference
      return true;
    }
  }

  async shouldSendSms(userId: string, category: 'marketing' | 'security' | 'updates'): Promise<boolean> {
    try {
      const prefs = await this.getPreferences(userId);

      // Always send security notifications
      if (category === 'security') {
        return prefs.sms;
      }

      // Check category-specific preference
      return prefs.sms && prefs[category];
    } catch (error) {
      logger.error('Failed to check SMS preference', { userId, category, error });
      // Default to not sending SMS if we can't determine preference
      return false;
    }
  }

  async unsubscribeFromMarketing(userId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE users 
         SET preferences = jsonb_set(
           COALESCE(preferences, '{}'::jsonb),
           '{notifications,marketing}',
           'false'::jsonb
         )
         WHERE id = $1`,
        [userId]
      );

      logger.info('User unsubscribed from marketing emails', { userId });
    } catch (error) {
      logger.error('Failed to unsubscribe from marketing', { userId, error });
      throw error;
    }
  }

  async unsubscribeFromAll(userId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE users 
         SET preferences = jsonb_set(
           jsonb_set(
             jsonb_set(
               COALESCE(preferences, '{}'::jsonb),
               '{notifications,email}',
               'false'::jsonb
             ),
             '{notifications,sms}',
             'false'::jsonb
           ),
           '{notifications,push}',
           'false'::jsonb
         )
         WHERE id = $1`,
        [userId]
      );

      logger.info('User unsubscribed from all notifications', { userId });
    } catch (error) {
      logger.error('Failed to unsubscribe from all notifications', { userId, error });
      throw error;
    }
  }
}
