import {
  db,
  redis,
  logger,
  generateRandomToken,
  hashToken,
  generateTokenPair,
  TokenPair,
} from '@auth/shared';
import axios from 'axios';
import crypto from 'crypto';

interface OAuthProvider {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  redirectUri: string;
}

interface OAuthUserInfo {
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

export class OAuthService {
  private providers: Map<string, OAuthProvider>;

  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  /**
   * Initialize OAuth providers from environment variables
   */
  private initializeProviders(): void {
    // Google OAuth
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.providers.set('google', {
        name: 'google',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scope: 'openid email profile',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/oauth/google/callback',
      });
    }

    // Facebook OAuth
    if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
      this.providers.set('facebook', {
        name: 'facebook',
        authorizationUrl: 'https://www.facebook.com/v12.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v12.0/oauth/access_token',
        userInfoUrl: 'https://graph.facebook.com/me',
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        scope: 'email public_profile',
        redirectUri: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/oauth/facebook/callback',
      });
    }

    // GitHub OAuth
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      this.providers.set('github', {
        name: 'github',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scope: 'read:user user:email',
        redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/oauth/github/callback',
      });
    }

    logger.info('OAuth providers initialized', {
      providers: Array.from(this.providers.keys()),
    });
  }

  /**
   * Get authorization URL for OAuth provider
   */
  async getAuthorizationUrl(
    providerName: string,
    linkToUserId?: string
  ): Promise<{ redirectUrl: string }> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`OAuth provider '${providerName}' not configured`);
    }

    // Generate state token for CSRF protection
    const state = generateRandomToken();
    const stateHash = hashToken(state);

    // Store state in Redis with 10-minute expiration
    const stateData = {
      provider: providerName,
      linkToUserId,
      timestamp: Date.now(),
    };
    await redis.set(`oauth_state:${stateHash}`, JSON.stringify(stateData), 10 * 60);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scope,
      state,
    });

    // Provider-specific parameters
    if (providerName === 'google') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }

    const redirectUrl = `${provider.authorizationUrl}?${params.toString()}`;

    logger.info('OAuth authorization URL generated', {
      provider: providerName,
      linkToUserId,
    });

    return { redirectUrl };
  }

  /**
   * Handle OAuth callback and complete authentication
   */
  async handleCallback(
    providerName: string,
    code: string,
    state: string,
    ipAddress: string,
    userAgent: string
  ): Promise<TokenPair> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`OAuth provider '${providerName}' not configured`);
    }

    // Validate state token
    const stateHash = hashToken(state);
    const stateDataStr = await redis.get(`oauth_state:${stateHash}`);
    if (!stateDataStr) {
      throw new Error('Invalid or expired OAuth state token');
    }

    const stateData = JSON.parse(stateDataStr);
    if (stateData.provider !== providerName) {
      throw new Error('OAuth state provider mismatch');
    }

    // Delete state token (single use)
    await redis.del(`oauth_state:${stateHash}`);

    // Exchange authorization code for access token
    const tokenResponse = await this.exchangeCodeForToken(provider, code);

    // Fetch user profile from provider
    const userInfo = await this.fetchUserInfo(provider, tokenResponse.access_token);

    // Check if linking to existing user
    if (stateData.linkToUserId) {
      await this.linkOAuthAccount(
        stateData.linkToUserId,
        providerName,
        userInfo.providerId,
        tokenResponse
      );

      // Generate tokens for the linked user
      return this.generateTokensForUser(stateData.linkToUserId, ipAddress, userAgent);
    }

    // Check if OAuth account already exists
    const existingAccount = await db.query(
      'SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
      [providerName, userInfo.providerId]
    );

    let userId: string;

    if (existingAccount.rows.length > 0) {
      // Existing OAuth account - update tokens
      userId = existingAccount.rows[0].user_id;
      await this.updateOAuthTokens(userId, providerName, userInfo.providerId, tokenResponse);

      logger.info('OAuth login - existing account', {
        provider: providerName,
        userId,
      });
    } else {
      // New OAuth account - check if email exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [userInfo.email]
      );

      if (existingUser.rows.length > 0) {
        // Email exists - link OAuth account to existing user
        userId = existingUser.rows[0].id;
        await this.linkOAuthAccount(userId, providerName, userInfo.providerId, tokenResponse);

        logger.info('OAuth login - linked to existing user', {
          provider: providerName,
          userId,
        });
      } else {
        // Create new user with OAuth account
        userId = await this.createUserWithOAuth(userInfo, providerName, tokenResponse);

        logger.info('OAuth registration - new user created', {
          provider: providerName,
          userId,
        });
      }
    }

    // Generate JWT tokens
    return this.generateTokensForUser(userId, ipAddress, userAgent);
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(
    provider: OAuthProvider,
    code: string
  ): Promise<OAuthTokenResponse> {
    try {
      const params = new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: provider.redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await axios.post(provider.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('OAuth token exchange failed', {
        provider: provider.name,
        error: error.message,
      });
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  /**
   * Fetch user information from OAuth provider
   */
  private async fetchUserInfo(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<OAuthUserInfo> {
    try {
      let userInfoUrl = provider.userInfoUrl;
      const headers: any = {
        Authorization: `Bearer ${accessToken}`,
      };

      // Facebook requires fields parameter
      if (provider.name === 'facebook') {
        userInfoUrl += '?fields=id,email,name,picture';
      }

      const response = await axios.get(userInfoUrl, { headers });
      const data = response.data;

      // Parse user info based on provider
      switch (provider.name) {
        case 'google':
          return {
            providerId: data.id,
            email: data.email,
            name: data.name,
            avatarUrl: data.picture,
          };

        case 'facebook':
          return {
            providerId: data.id,
            email: data.email,
            name: data.name,
            avatarUrl: data.picture?.data?.url,
          };

        case 'github':
          // GitHub may not provide email in user endpoint
          let email = data.email;
          if (!email) {
            const emailResponse = await axios.get('https://api.github.com/user/emails', {
              headers,
            });
            const primaryEmail = emailResponse.data.find((e: any) => e.primary);
            email = primaryEmail?.email || emailResponse.data[0]?.email;
          }

          return {
            providerId: data.id.toString(),
            email,
            name: data.name || data.login,
            avatarUrl: data.avatar_url,
          };

        default:
          throw new Error(`Unsupported provider: ${provider.name}`);
      }
    } catch (error: any) {
      logger.error('Failed to fetch user info from OAuth provider', {
        provider: provider.name,
        error: error.message,
      });
      throw new Error('Failed to fetch user information from OAuth provider');
    }
  }

  /**
   * Create new user with OAuth account
   */
  private async createUserWithOAuth(
    userInfo: OAuthUserInfo,
    provider: string,
    tokenResponse: OAuthTokenResponse
  ): Promise<string> {
    // Encrypt OAuth tokens
    const encryptedAccessToken = this.encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? this.encryptToken(tokenResponse.refresh_token)
      : null;

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (email, name, avatar_url, email_verified, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userInfo.email, userInfo.name, userInfo.avatarUrl, true, 'active']
    );

    const userId = userResult.rows[0].id;

    // Assign default 'user' role
    const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', ['user']);
    if (roleResult.rows.length > 0) {
      await db.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [userId, roleResult.rows[0].id]
      );
    }

    // Create OAuth account record
    await db.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        provider,
        userInfo.providerId,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        tokenResponse.scope || '',
      ]
    );

    return userId;
  }

  /**
   * Link OAuth account to existing user
   */
  private async linkOAuthAccount(
    userId: string,
    provider: string,
    providerId: string,
    tokenResponse: OAuthTokenResponse
  ): Promise<void> {
    // Check if OAuth account already linked
    const existing = await db.query(
      'SELECT id FROM oauth_accounts WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );

    if (existing.rows.length > 0) {
      throw new Error(`${provider} account is already linked to this user`);
    }

    // Check if OAuth account linked to different user
    const linkedToOther = await db.query(
      'SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
      [provider, providerId]
    );

    if (linkedToOther.rows.length > 0 && linkedToOther.rows[0].user_id !== userId) {
      throw new Error(`This ${provider} account is already linked to another user`);
    }

    // Encrypt tokens
    const encryptedAccessToken = this.encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? this.encryptToken(tokenResponse.refresh_token)
      : null;

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Create OAuth account record
    await db.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        provider,
        providerId,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        tokenResponse.scope || '',
      ]
    );

    logger.info('OAuth account linked', { userId, provider });
  }

  /**
   * Update OAuth tokens for existing account
   */
  private async updateOAuthTokens(
    userId: string,
    provider: string,
    providerId: string,
    tokenResponse: OAuthTokenResponse
  ): Promise<void> {
    const encryptedAccessToken = this.encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? this.encryptToken(tokenResponse.refresh_token)
      : null;

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    await db.query(
      `UPDATE oauth_accounts
       SET access_token = $1, refresh_token = $2, expires_at = $3, scope = $4, updated_at = NOW()
       WHERE user_id = $5 AND provider = $6 AND provider_account_id = $7`,
      [
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        tokenResponse.scope || '',
        userId,
        provider,
        providerId,
      ]
    );
  }

  /**
   * Generate JWT tokens for user
   */
  private async generateTokensForUser(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<TokenPair> {
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

    // Parse device info
    const { parseUserAgent } = await import('../utils/device-parser');
    const deviceInfo = parseUserAgent(userAgent);

    // Create session
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

    return tokens;
  }

  /**
   * Encrypt OAuth token
   */
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt OAuth token (for future use)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private decryptToken(encryptedToken: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

    const parts = encryptedToken.split(':');
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

export const oauthService = new OAuthService();
