import { db, redis, logger, hashToken } from '@auth/shared';

interface CreateSessionInput {
  userId: string;
  refreshToken: string;
  deviceInfo: {
    userAgent: string;
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    device: string;
  };
  ipAddress: string;
}

// DeviceInfo interface for session creation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DeviceInfo {
  userAgent: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
}

export class SessionService {
  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<string> {
    const { userId, refreshToken, deviceInfo, ipAddress } = input;

    // Hash the refresh token for storage
    const tokenHash = hashToken(refreshToken);

    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create session in database
    const result = await db.query(
      `INSERT INTO sessions (user_id, token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, tokenHash, JSON.stringify(deviceInfo), ipAddress, expiresAt]
    );

    const sessionId = result.rows[0].id;

    // Store refresh token hash in Redis with 30-day TTL
    await redis.set(`refresh_token:${tokenHash}`, userId, 30 * 24 * 60 * 60);

    logger.info('Session created', { userId, sessionId });

    return sessionId;
  }

  /**
   * Validate refresh token and get user ID
   */
  async validateRefreshToken(refreshToken: string): Promise<string | null> {
    const tokenHash = hashToken(refreshToken);

    // Check if token exists in Redis
    const userId = await redis.get(`refresh_token:${tokenHash}`);
    if (!userId) {
      return null;
    }

    // Update last activity
    await db.query(
      'UPDATE sessions SET last_activity_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );

    return userId;
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    // Remove from Redis
    await redis.del(`refresh_token:${tokenHash}`);

    // Delete session from database
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);

    logger.info('Refresh token revoked', { tokenHash: tokenHash.substring(0, 8) });
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    // Get all session token hashes
    const result = await db.query('SELECT token_hash FROM sessions WHERE user_id = $1', [userId]);

    // Remove from Redis
    for (const row of result.rows) {
      await redis.del(`refresh_token:${row.token_hash}`);
    }

    // Delete all sessions
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    logger.info('All user sessions revoked', { userId });
  }
}

export const sessionService = new SessionService();
