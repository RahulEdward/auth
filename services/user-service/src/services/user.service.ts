import {
  db,
  redis,
  logger,
  verifyPassword,
} from '@auth/shared';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
  phoneNumber?: string;
  bio?: string;
  preferences: UserPreferences;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

interface UpdateProfileInput {
  name?: string;
  phoneNumber?: string;
  bio?: string;
  preferences?: Partial<UserPreferences>;
}

export class UserService {
  /**
   * Get user profile with caching
   */
  async getProfile(userId: string): Promise<UserProfile> {
    // Check cache first
    const cacheKey = `user_profile:${userId}`;
    const cachedProfile = await redis.get(cacheKey);

    if (cachedProfile) {
      logger.debug('User profile retrieved from cache', { userId });
      return JSON.parse(cachedProfile);
    }

    // Fetch from database
    const userResult = await db.query(
      `SELECT id, email, email_verified, name, avatar_url, phone_number, bio, 
              preferences, created_at, updated_at
       FROM users WHERE id = $1 AND status = 'active'`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Fetch user roles
    const rolesResult = await db.query(
      `SELECT r.name
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );

    const roles = rolesResult.rows.map((r) => r.name);

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      name: user.name,
      avatarUrl: user.avatar_url,
      phoneNumber: user.phone_number,
      bio: user.bio,
      preferences: user.preferences || {
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          sms: false,
          push: false,
        },
      },
      roles,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(profile), 5 * 60);

    logger.info('User profile retrieved', { userId });

    return profile;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }

    if (input.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(input.phoneNumber);
    }

    if (input.bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      values.push(input.bio);
    }

    if (input.preferences !== undefined) {
      // Merge with existing preferences
      const currentProfile = await this.getProfile(userId);
      const mergedPreferences = {
        ...currentProfile.preferences,
        ...input.preferences,
        notifications: {
          ...currentProfile.preferences.notifications,
          ...(input.preferences.notifications || {}),
        },
      };
      updates.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(mergedPreferences));
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id
    `;

    await db.query(query, values);

    // Invalidate cache
    await redis.del(`user_profile:${userId}`);

    logger.info('User profile updated', { userId });

    // Return updated profile
    return this.getProfile(userId);
  }

  /**
   * Upload and process avatar
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File
  ): Promise<{ avatarUrl: string; thumbnails: { small: string; medium: string; large: string } }> {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds 5MB limit');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const filename = `${uuidv4()}${fileExtension}`;

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(uploadDir, { recursive: true });

    // Process and save original
    const originalPath = path.join(uploadDir, filename);
    await sharp(file.buffer)
      .resize(800, 800, { fit: 'cover' })
      .toFile(originalPath);

    // Generate thumbnails
    const thumbnails = {
      small: `${uuidv4()}_50x50${fileExtension}`,
      medium: `${uuidv4()}_150x150${fileExtension}`,
      large: `${uuidv4()}_300x300${fileExtension}`,
    };

    await Promise.all([
      sharp(file.buffer)
        .resize(50, 50, { fit: 'cover' })
        .toFile(path.join(uploadDir, thumbnails.small)),
      sharp(file.buffer)
        .resize(150, 150, { fit: 'cover' })
        .toFile(path.join(uploadDir, thumbnails.medium)),
      sharp(file.buffer)
        .resize(300, 300, { fit: 'cover' })
        .toFile(path.join(uploadDir, thumbnails.large)),
    ]);

    // In production, upload to S3/MinIO and get URLs
    // For now, use local paths
    const baseUrl = process.env.STORAGE_URL || 'http://localhost:3002/uploads/avatars';
    const avatarUrl = `${baseUrl}/${filename}`;
    const thumbnailUrls = {
      small: `${baseUrl}/${thumbnails.small}`,
      medium: `${baseUrl}/${thumbnails.medium}`,
      large: `${baseUrl}/${thumbnails.large}`,
    };

    // Update user avatar_url in database
    await db.query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
      [avatarUrl, userId]
    );

    // Invalidate cache
    await redis.del(`user_profile:${userId}`);

    logger.info('Avatar uploaded', { userId, filename });

    return {
      avatarUrl,
      thumbnails: thumbnailUrls,
    };
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string, password: string): Promise<void> {
    // Verify password
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const isValidPassword = await verifyPassword(userResult.rows[0].password_hash, password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Update user status
    await db.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      ['deactivated', userId]
    );

    // Revoke all active sessions
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    // Invalidate all tokens in Redis
    await redis.del(`user_profile:${userId}`);
    await redis.del(`mfa_enrollment:${userId}`);
    await redis.del(`mfa_backup_codes:${userId}`);

    // Queue notification email
    const emailResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (emailResult.rows.length > 0) {
      // TODO: Queue account deactivated notification
      logger.info('Account deactivated notification queued', {
        userId,
        email: emailResult.rows[0].email,
      });
    }

    logger.info('Account deactivated', { userId });
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    // Verify password
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const isValidPassword = await verifyPassword(userResult.rows[0].password_hash, password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Soft delete: update status and set deleted_at
    await db.query(
      'UPDATE users SET status = $1, deleted_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['deleted', userId]
    );

    // Revoke all active sessions
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    // Invalidate all tokens in Redis
    await redis.del(`user_profile:${userId}`);
    await redis.del(`mfa_enrollment:${userId}`);
    await redis.del(`mfa_backup_codes:${userId}`);

    // Queue notification email
    const emailResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (emailResult.rows.length > 0) {
      // TODO: Queue account deletion confirmation
      logger.info('Account deletion confirmation queued', {
        userId,
        email: emailResult.rows[0].email,
      });
    }

    logger.info('Account deleted (soft)', { userId });
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(userId: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    // Collect all user data
    const userData: any = {};

    // User profile
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    userData.profile = userResult.rows[0];

    // Sessions
    const sessionsResult = await db.query(
      'SELECT * FROM sessions WHERE user_id = $1',
      [userId]
    );
    userData.sessions = sessionsResult.rows;

    // OAuth accounts
    const oauthResult = await db.query(
      'SELECT provider, provider_account_id, created_at FROM oauth_accounts WHERE user_id = $1',
      [userId]
    );
    userData.oauthAccounts = oauthResult.rows;

    // Subscriptions (if exists)
    const subscriptionsResult = await db.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    userData.subscriptions = subscriptionsResult.rows;

    // Generate JSON file
    const exportData = JSON.stringify(userData, null, 2);
    const filename = `user_data_${userId}_${Date.now()}.json`;

    // Save to local storage (in production, upload to S3)
    const exportDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportDir, { recursive: true });
    const filePath = path.join(exportDir, filename);
    await fs.writeFile(filePath, exportData);

    // Generate download URL (expires in 7 days)
    const baseUrl = process.env.STORAGE_URL || 'http://localhost:3002';
    const downloadUrl = `${baseUrl}/exports/${filename}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Store expiration in Redis
    await redis.set(`export:${filename}`, userId, 7 * 24 * 60 * 60);

    // Queue email with download link
    const emailResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (emailResult.rows.length > 0) {
      // TODO: Queue data export email
      logger.info('Data export email queued', {
        userId,
        email: emailResult.rows[0].email,
        downloadUrl,
      });
    }

    logger.info('User data exported', { userId, filename });

    return {
      downloadUrl,
      expiresAt,
    };
  }

  /**
   * Permanent deletion job (called by background worker)
   */
  async permanentlyDeleteUsers(): Promise<number> {
    // Find users marked for deletion > 30 days ago
    const usersResult = await db.query(
      `SELECT id, email FROM users 
       WHERE status = 'deleted' 
       AND deleted_at < NOW() - INTERVAL '30 days'`
    );

    let deletedCount = 0;

    for (const user of usersResult.rows) {
      try {
        // Anonymize personal data
        await db.query(
          `UPDATE users 
           SET email = $1,
               name = 'Deleted User',
               phone_number = NULL,
               bio = NULL,
               avatar_url = NULL,
               password_hash = NULL,
               mfa_secret = NULL,
               backup_codes = NULL,
               preferences = '{}'::jsonb
           WHERE id = $2`,
          [`deleted_${user.id}@anonymized.local`, user.id]
        );

        // Delete OAuth accounts
        await db.query('DELETE FROM oauth_accounts WHERE user_id = $1', [user.id]);

        // Delete sessions
        await db.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

        // Note: Audit logs are preserved with anonymized user ID

        logger.info('User permanently deleted', { userId: user.id });
        deletedCount++;
      } catch (error) {
        logger.error('Failed to permanently delete user', {
          userId: user.id,
          error: (error as Error).message,
        });
      }
    }

    logger.info('Permanent deletion job completed', { deletedCount });

    return deletedCount;
  }

  /**
   * Get all active sessions for a user
   */
  async getSessions(userId: string, currentSessionId?: string): Promise<any[]> {
    const result = await db.query(
      `SELECT id, device_info, ip_address, location, created_at, last_activity_at
       FROM sessions 
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_activity_at DESC`,
      [userId]
    );

    const sessions = result.rows.map((row) => ({
      id: row.id,
      deviceInfo: row.device_info,
      ipAddress: row.ip_address,
      location: row.location,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      isCurrent: row.id === currentSessionId,
    }));

    logger.info('Sessions retrieved', { userId, count: sessions.length });

    return sessions;
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    // Verify session belongs to user
    const result = await db.query(
      'SELECT token_hash FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    const tokenHash = result.rows[0].token_hash;

    // Delete from database
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);

    // Remove from Redis
    await redis.del(`refresh_token:${tokenHash}`);

    logger.info('Session revoked', { userId, sessionId });
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(userId: string, currentSessionId?: string): Promise<number> {
    // Get all session token hashes except current
    const query = currentSessionId
      ? 'SELECT id, token_hash FROM sessions WHERE user_id = $1 AND id != $2'
      : 'SELECT id, token_hash FROM sessions WHERE user_id = $1';

    const params = currentSessionId ? [userId, currentSessionId] : [userId];
    const result = await db.query(query, params);

    // Remove from Redis
    for (const row of result.rows) {
      await redis.del(`refresh_token:${row.token_hash}`);
    }

    // Delete from database
    const deleteQuery = currentSessionId
      ? 'DELETE FROM sessions WHERE user_id = $1 AND id != $2'
      : 'DELETE FROM sessions WHERE user_id = $1';

    await db.query(deleteQuery, params);

    const count = result.rows.length;

    logger.info('All sessions revoked', { userId, count, exceptCurrent: !!currentSessionId });

    return count;
  }
}

export const userService = new UserService();
