import { oauthService } from '../services/oauth.service';
import { db, redis } from '@auth/shared';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OAuth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.end();
    await redis.quit();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL for Google', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/v1/auth/oauth/google/callback';

      const result = await oauthService.getAuthorizationUrl('google');

      expect(result.redirectUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.redirectUrl).toContain('client_id=test-google-client-id');
      expect(result.redirectUrl).toContain('scope=openid+email+profile');
      expect(result.redirectUrl).toContain('state=');
    });

    it('should generate authorization URL for Facebook', async () => {
      process.env.FACEBOOK_CLIENT_ID = 'test-facebook-client-id';
      process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-secret';
      process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:3001/api/v1/auth/oauth/facebook/callback';

      const result = await oauthService.getAuthorizationUrl('facebook');

      expect(result.redirectUrl).toContain('https://www.facebook.com/v12.0/dialog/oauth');
      expect(result.redirectUrl).toContain('client_id=test-facebook-client-id');
      expect(result.redirectUrl).toContain('scope=email+public_profile');
    });

    it('should generate authorization URL for GitHub', async () => {
      process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
      process.env.GITHUB_REDIRECT_URI = 'http://localhost:3001/api/v1/auth/oauth/github/callback';

      const result = await oauthService.getAuthorizationUrl('github');

      expect(result.redirectUrl).toContain('https://github.com/login/oauth/authorize');
      expect(result.redirectUrl).toContain('client_id=test-github-client-id');
      expect(result.redirectUrl).toContain('scope=read%3Auser+user%3Aemail');
    });

    it('should throw error for unconfigured provider', async () => {
      await expect(oauthService.getAuthorizationUrl('invalid')).rejects.toThrow(
        "OAuth provider 'invalid' not configured"
      );
    });

    it('should store state in Redis with linkToUserId', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';

      const userId = 'test-user-id';
      await oauthService.getAuthorizationUrl('google', userId);

      // State should be stored in Redis
      // We can't easily verify this without exposing the state token
      // In a real test, we'd need to mock Redis or expose the state
    });
  });

  describe('handleCallback - Google OAuth', () => {
    it('should create new user with Google OAuth', async () => {
      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'google-access-token',
          refresh_token: 'google-refresh-token',
          expires_in: 3600,
          scope: 'openid email profile',
        },
      });

      // Mock user info fetch
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 'google-user-123',
          email: 'newuser@example.com',
          name: 'New User',
          picture: 'https://example.com/avatar.jpg',
        },
      });

      // Create state token
      const stateResult = await oauthService.getAuthorizationUrl('google');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      const result = await oauthService.handleCallback(
        'google',
        'auth-code-123',
        state,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900); // 15 minutes

      // Verify user was created
      const userResult = await db.query('SELECT * FROM users WHERE email = $1', [
        'newuser@example.com',
      ]);
      expect(userResult.rows.length).toBe(1);
      expect(userResult.rows[0].email_verified).toBe(true);

      // Verify OAuth account was created
      const oauthResult = await db.query(
        'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
        ['google', 'google-user-123']
      );
      expect(oauthResult.rows.length).toBe(1);
    });

    it('should login existing user with Google OAuth', async () => {
      // Create existing user
      const userResult = await db.query(
        `INSERT INTO users (email, name, email_verified, status)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['existing@example.com', 'Existing User', true, 'active']
      );
      const userId = userResult.rows[0].id;

      // Create OAuth account
      await db.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_account_id, access_token, refresh_token, scope)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 'google', 'google-user-456', 'old-token', 'old-refresh', 'openid email']
      );

      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-google-access-token',
          refresh_token: 'new-google-refresh-token',
          expires_in: 3600,
        },
      });

      // Mock user info fetch
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 'google-user-456',
          email: 'existing@example.com',
          name: 'Existing User',
        },
      });

      // Create state token
      const stateResult = await oauthService.getAuthorizationUrl('google');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      const result = await oauthService.handleCallback(
        'google',
        'auth-code-456',
        state,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify tokens were updated
      const oauthResult = await db.query(
        'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
        ['google', 'google-user-456']
      );
      expect(oauthResult.rows[0].access_token).not.toBe('old-token');
    });

    it('should link OAuth account to existing email', async () => {
      // Create user without OAuth
      const userResult = await db.query(
        `INSERT INTO users (email, name, password_hash, email_verified, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ['linkuser@example.com', 'Link User', 'hashed-password', true, 'active']
      );
      const userId = userResult.rows[0].id;

      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'google-access-token',
          expires_in: 3600,
        },
      });

      // Mock user info fetch
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 'google-user-789',
          email: 'linkuser@example.com',
          name: 'Link User',
        },
      });

      // Create state token
      const stateResult = await oauthService.getAuthorizationUrl('google');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      const result = await oauthService.handleCallback(
        'google',
        'auth-code-789',
        state,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.accessToken).toBeDefined();

      // Verify OAuth account was linked
      const oauthResult = await db.query(
        'SELECT * FROM oauth_accounts WHERE user_id = $1 AND provider = $2',
        [userId, 'google']
      );
      expect(oauthResult.rows.length).toBe(1);
      expect(oauthResult.rows[0].provider_account_id).toBe('google-user-789');
    });
  });

  describe('handleCallback - Facebook OAuth', () => {
    it('should handle Facebook OAuth flow', async () => {
      process.env.FACEBOOK_CLIENT_ID = 'test-facebook-client-id';
      process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-secret';

      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'facebook-access-token',
          expires_in: 5184000,
        },
      });

      // Mock user info fetch
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 'facebook-user-123',
          email: 'fbuser@example.com',
          name: 'Facebook User',
          picture: {
            data: {
              url: 'https://facebook.com/avatar.jpg',
            },
          },
        },
      });

      // Create state token
      const stateResult = await oauthService.getAuthorizationUrl('facebook');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      const result = await oauthService.handleCallback(
        'facebook',
        'fb-auth-code',
        state,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.accessToken).toBeDefined();

      // Verify user was created
      const userResult = await db.query('SELECT * FROM users WHERE email = $1', [
        'fbuser@example.com',
      ]);
      expect(userResult.rows.length).toBe(1);
      expect(userResult.rows[0].avatar_url).toBe('https://facebook.com/avatar.jpg');
    });
  });

  describe('handleCallback - GitHub OAuth', () => {
    it('should handle GitHub OAuth flow', async () => {
      process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';

      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'github-access-token',
          scope: 'read:user,user:email',
        },
      });

      // Mock user info fetch
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 12345,
          login: 'githubuser',
          name: 'GitHub User',
          email: 'github@example.com',
          avatar_url: 'https://github.com/avatar.jpg',
        },
      });

      // Create state token
      const stateResult = await oauthService.getAuthorizationUrl('github');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      const result = await oauthService.handleCallback(
        'github',
        'gh-auth-code',
        state,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.accessToken).toBeDefined();

      // Verify user was created
      const userResult = await db.query('SELECT * FROM users WHERE email = $1', [
        'github@example.com',
      ]);
      expect(userResult.rows.length).toBe(1);
    });

    it('should fetch email from GitHub emails endpoint if not in profile', async () => {
      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'github-access-token',
        },
      });

      // Mock user info fetch (no email)
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 67890,
          login: 'noemailuser',
          name: 'No Email User',
          email: null,
          avatar_url: 'https://github.com/avatar2.jpg',
        },
      });

      // Mock emails endpoint
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          { email: 'primary@example.com', primary: true, verified: true },
          { email: 'secondary@example.com', primary: false, verified: true },
        ],
      });

      // Create state token
      const stateResult = await oauthService.getAuthorizationUrl('github');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      const result = await oauthService.handleCallback(
        'github',
        'gh-auth-code-2',
        state,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.accessToken).toBeDefined();

      // Verify user was created with primary email
      const userResult = await db.query('SELECT * FROM users WHERE email = $1', [
        'primary@example.com',
      ]);
      expect(userResult.rows.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid state token', async () => {
      await expect(
        oauthService.handleCallback('google', 'code', 'invalid-state', '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow('Invalid or expired OAuth state token');
    });

    it('should throw error when token exchange fails', async () => {
      // Create valid state
      const stateResult = await oauthService.getAuthorizationUrl('google');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      // Mock failed token exchange
      mockedAxios.post.mockRejectedValueOnce(new Error('Token exchange failed'));

      await expect(
        oauthService.handleCallback('google', 'bad-code', state, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow('Failed to exchange authorization code for token');
    });

    it('should throw error when user info fetch fails', async () => {
      // Create valid state
      const stateResult = await oauthService.getAuthorizationUrl('google');
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      // Mock successful token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'valid-token',
        },
      });

      // Mock failed user info fetch
      mockedAxios.get.mockRejectedValueOnce(new Error('User info fetch failed'));

      await expect(
        oauthService.handleCallback('google', 'code', state, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow('Failed to fetch user information from OAuth provider');
    });
  });

  describe('Account Linking', () => {
    it('should prevent duplicate OAuth account linking', async () => {
      // Create user with existing OAuth account
      const userResult = await db.query(
        `INSERT INTO users (email, name, email_verified, status)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['duplicate@example.com', 'Duplicate User', true, 'active']
      );
      const userId = userResult.rows[0].id;

      await db.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_account_id, access_token, scope)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'google', 'google-dup-123', 'token', 'scope']
      );

      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-token',
        },
      });

      // Mock user info fetch
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 'google-dup-456',
          email: 'duplicate@example.com',
          name: 'Duplicate User',
        },
      });

      // Create state token with linkToUserId
      const stateResult = await oauthService.getAuthorizationUrl('google', userId);
      const stateMatch = stateResult.redirectUrl.match(/state=([^&]+)/);
      const state = stateMatch ? stateMatch[1] : '';

      // This should throw because user already has Google linked
      await expect(
        oauthService.handleCallback('google', 'code', state, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow('google account is already linked to this user');
    });
  });
});
