import { Request, Response, NextFunction } from 'express';
import { db, redis, logger } from '@auth/shared';

/**
 * Middleware to track session activity
 * Updates last_activity_at timestamp on each authenticated request
 */
export async function sessionTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;

    // Only track if user is authenticated and has a session ID
    if (user && user.sessionId) {
      const sessionId = user.sessionId;

      // Update last activity in database (async, don't wait)
      db.query(
        'UPDATE sessions SET last_activity_at = NOW() WHERE id = $1',
        [sessionId]
      ).catch((error) => {
        logger.error('Failed to update session activity', {
          sessionId,
          error: error.message,
        });
      });

      // Update activity timestamp in Redis cache
      const cacheKey = `session_activity:${sessionId}`;
      redis.set(cacheKey, Date.now().toString(), 30 * 24 * 60 * 60).catch((error) => {
        logger.error('Failed to cache session activity', {
          sessionId,
          error: error.message,
        });
      });

      // Check for session timeout (inactive > 30 days)
      const lastActivityResult = await db.query(
        'SELECT last_activity_at FROM sessions WHERE id = $1',
        [sessionId]
      );

      if (lastActivityResult.rows.length > 0) {
        const lastActivity = new Date(lastActivityResult.rows[0].last_activity_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (lastActivity < thirtyDaysAgo) {
          // Session has timed out
          await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
          logger.info('Session timed out due to inactivity', { sessionId });

          res.status(401).json({
            error: {
              code: 'SESSION_TIMEOUT',
              message: 'Session has expired due to inactivity',
            },
          });
        }
      }
    }

    next();
  } catch (error) {
    // Don't fail the request if session tracking fails
    logger.error('Session tracking middleware error', {
      error: (error as Error).message,
    });
    next();
  }
}

/**
 * Background job to clean up expired sessions
 * Should be run periodically (e.g., daily)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    // Delete sessions that have expired
    const result = await db.query(
      'DELETE FROM sessions WHERE expires_at < NOW() RETURNING id'
    );

    const deletedCount = result.rows.length;

    // Remove corresponding refresh tokens from Redis
    for (const row of result.rows) {
      const tokenHashResult = await db.query(
        'SELECT token_hash FROM sessions WHERE id = $1',
        [row.id]
      );

      if (tokenHashResult.rows.length > 0) {
        await redis.del(`refresh_token:${tokenHashResult.rows[0].token_hash}`);
      }
    }

    logger.info('Expired sessions cleaned up', { deletedCount });

    return deletedCount;
  } catch (error) {
    logger.error('Failed to clean up expired sessions', {
      error: (error as Error).message,
    });
    return 0;
  }
}

/**
 * Background job to clean up inactive sessions
 * Should be run periodically (e.g., daily)
 */
export async function cleanupInactiveSessions(): Promise<number> {
  try {
    // Delete sessions inactive for more than 30 days
    const result = await db.query(
      `DELETE FROM sessions 
       WHERE last_activity_at < NOW() - INTERVAL '30 days'
       RETURNING id, token_hash`
    );

    const deletedCount = result.rows.length;

    // Remove corresponding refresh tokens from Redis
    for (const row of result.rows) {
      await redis.del(`refresh_token:${row.token_hash}`);
    }

    logger.info('Inactive sessions cleaned up', { deletedCount });

    return deletedCount;
  } catch (error) {
    logger.error('Failed to clean up inactive sessions', {
      error: (error as Error).message,
    });
    return 0;
  }
}
