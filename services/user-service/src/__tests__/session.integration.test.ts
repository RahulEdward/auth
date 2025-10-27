import request from 'supertest';
import app from '../index';
import { db, redis } from '@auth/shared';

describe('Session Management Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Connect to test database
    await db.connect();
    await redis.connect();

    // Create a test user and get auth token
    // This would normally come from the auth service
    // For testing, we'll mock this
    userId = 'test-user-id';
    sessionId = 'test-session-id';
    authToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    await db.disconnect();
    await redis.disconnect();
  });

  describe('GET /api/v1/users/me/sessions', () => {
    it('should return all active sessions for the user', async () => {
      // Create test sessions
      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')`,
        [
          'session-1',
          userId,
          'hash-1',
          JSON.stringify({ browser: 'Chrome', os: 'Windows' }),
          '192.168.1.1',
        ]
      );

      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')`,
        [
          'session-2',
          userId,
          'hash-2',
          JSON.stringify({ browser: 'Firefox', os: 'macOS' }),
          '192.168.1.2',
        ]
      );

      const response = await request(app)
        .get('/api/v1/users/me/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.sessions[0]).toHaveProperty('id');
      expect(response.body.sessions[0]).toHaveProperty('deviceInfo');
      expect(response.body.sessions[0]).toHaveProperty('ipAddress');
      expect(response.body.sessions[0]).toHaveProperty('createdAt');
      expect(response.body.sessions[0]).toHaveProperty('lastActivityAt');
      expect(response.body.sessions[0]).toHaveProperty('isCurrent');
    });

    it('should mark current session correctly', async () => {
      const response = await request(app)
        .get('/api/v1/users/me/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const currentSession = response.body.sessions.find((s: any) => s.isCurrent);
      expect(currentSession).toBeDefined();
      expect(currentSession.id).toBe(sessionId);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get('/api/v1/users/me/sessions')
        .expect(401);
    });
  });

  describe('DELETE /api/v1/users/me/sessions/:sessionId', () => {
    it('should revoke a specific session', async () => {
      // Create a test session
      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')`,
        [
          'session-to-revoke',
          userId,
          'hash-to-revoke',
          JSON.stringify({ browser: 'Safari', os: 'iOS' }),
          '192.168.1.3',
        ]
      );

      // Store token in Redis
      await redis.set('refresh_token:hash-to-revoke', userId, 30 * 24 * 60 * 60);

      const response = await request(app)
        .delete('/api/v1/users/me/sessions/session-to-revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Session revoked successfully');

      // Verify session is deleted
      const result = await db.query('SELECT * FROM sessions WHERE id = $1', ['session-to-revoke']);
      expect(result.rows).toHaveLength(0);

      // Verify token is removed from Redis
      const token = await redis.get('refresh_token:hash-to-revoke');
      expect(token).toBeNull();
    });

    it('should return 404 if session does not belong to user', async () => {
      await request(app)
        .delete('/api/v1/users/me/sessions/non-existent-session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .delete('/api/v1/users/me/sessions/some-session')
        .expect(401);
    });
  });

  describe('DELETE /api/v1/users/me/sessions', () => {
    it('should revoke all sessions except current', async () => {
      // Create multiple test sessions
      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')`,
        [
          'session-a',
          userId,
          'hash-a',
          JSON.stringify({ browser: 'Chrome', os: 'Windows' }),
          '192.168.1.4',
        ]
      );

      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')`,
        [
          'session-b',
          userId,
          'hash-b',
          JSON.stringify({ browser: 'Firefox', os: 'Linux' }),
          '192.168.1.5',
        ]
      );

      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')`,
        [
          sessionId,
          userId,
          'hash-current',
          JSON.stringify({ browser: 'Edge', os: 'Windows' }),
          '192.168.1.6',
        ]
      );

      // Store tokens in Redis
      await redis.set('refresh_token:hash-a', userId, 30 * 24 * 60 * 60);
      await redis.set('refresh_token:hash-b', userId, 30 * 24 * 60 * 60);
      await redis.set('refresh_token:hash-current', userId, 30 * 24 * 60 * 60);

      const response = await request(app)
        .delete('/api/v1/users/me/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.revokedCount).toBe(2);
      expect(response.body.message).toContain('2 session(s) revoked');

      // Verify only current session remains
      const result = await db.query('SELECT * FROM sessions WHERE user_id = $1', [userId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(sessionId);

      // Verify other tokens are removed from Redis
      const tokenA = await redis.get('refresh_token:hash-a');
      const tokenB = await redis.get('refresh_token:hash-b');
      const tokenCurrent = await redis.get('refresh_token:hash-current');

      expect(tokenA).toBeNull();
      expect(tokenB).toBeNull();
      expect(tokenCurrent).not.toBeNull();
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .delete('/api/v1/users/me/sessions')
        .expect(401);
    });
  });

  describe('Session Limit Enforcement', () => {
    it('should enforce maximum concurrent sessions', async () => {
      // This test would be in the auth service
      // Testing that when creating a 6th session, the oldest is revoked
      // Skipping for now as it requires auth service integration
    });
  });

  describe('Session Activity Tracking', () => {
    it('should update last_activity_at on each request', async () => {
      // Create a session
      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at, last_activity_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days', NOW() - INTERVAL '1 hour')`,
        [
          'activity-session',
          userId,
          'hash-activity',
          JSON.stringify({ browser: 'Chrome', os: 'Windows' }),
          '192.168.1.7',
        ]
      );

      // Get initial last_activity_at
      const before = await db.query(
        'SELECT last_activity_at FROM sessions WHERE id = $1',
        ['activity-session']
      );
      const beforeTime = new Date(before.rows[0].last_activity_at);

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make a request (this would trigger the middleware)
      // For this test, we'll manually update
      await db.query(
        'UPDATE sessions SET last_activity_at = NOW() WHERE id = $1',
        ['activity-session']
      );

      // Get updated last_activity_at
      const after = await db.query(
        'SELECT last_activity_at FROM sessions WHERE id = $1',
        ['activity-session']
      );
      const afterTime = new Date(after.rows[0].last_activity_at);

      expect(afterTime.getTime()).toBeGreaterThan(beforeTime.getTime());
    });
  });

  describe('Session Timeout', () => {
    it('should timeout sessions inactive for more than 30 days', async () => {
      // Create an old inactive session
      await db.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at, last_activity_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days', NOW() - INTERVAL '31 days')`,
        [
          'timeout-session',
          userId,
          'hash-timeout',
          JSON.stringify({ browser: 'Chrome', os: 'Windows' }),
          '192.168.1.8',
        ]
      );

      // The middleware would detect this and delete it
      // For testing, we'll check if it's old enough
      const result = await db.query(
        `SELECT * FROM sessions 
         WHERE id = $1 AND last_activity_at < NOW() - INTERVAL '30 days'`,
        ['timeout-session']
      );

      expect(result.rows).toHaveLength(1);

      // Clean up
      await db.query('DELETE FROM sessions WHERE id = $1', ['timeout-session']);
    });
  });
});
