# OAuth Integration Setup Guide

This guide explains how to set up OAuth authentication with Google, Facebook, and GitHub providers.

## Table of Contents

- [Overview](#overview)
- [Google OAuth Setup](#google-oauth-setup)
- [Facebook OAuth Setup](#facebook-oauth-setup)
- [GitHub OAuth Setup](#github-oauth-setup)
- [Environment Configuration](#environment-configuration)
- [Testing OAuth Flow](#testing-oauth-flow)
- [Security Considerations](#security-considerations)

## Overview

The Auth Service supports OAuth 2.0 authentication with three major providers:

- **Google** - Using Google OAuth 2.0
- **Facebook** - Using Facebook Login
- **GitHub** - Using GitHub OAuth Apps

### OAuth Flow

1. User clicks "Login with [Provider]" button
2. Frontend calls `/api/v1/auth/oauth/{provider}/authorize`
3. Backend generates authorization URL with state token (CSRF protection)
4. User is redirected to provider's authorization page
5. User grants permissions
6. Provider redirects back to `/api/v1/auth/oauth/{provider}/callback`
7. Backend exchanges authorization code for access token
8. Backend fetches user profile from provider
9. Backend creates or updates user account
10. Backend generates JWT tokens and redirects to frontend

## Google OAuth Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API

### 2. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: Auth System
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:3001/api/v1/auth/oauth/google/callback`
5. Click **Create**
6. Copy **Client ID** and **Client Secret**

### 3. Configure Environment Variables

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/google/callback
```

### 4. Scopes Requested

- `openid` - OpenID Connect authentication
- `email` - User's email address
- `profile` - User's basic profile information

## Facebook OAuth Setup

### 1. Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** > **Create App**
3. Select **Consumer** app type
4. Fill in app details and create

### 2. Configure Facebook Login

1. In your app dashboard, add **Facebook Login** product
2. Go to **Facebook Login** > **Settings**
3. Add **Valid OAuth Redirect URIs**: `http://localhost:3001/api/v1/auth/oauth/facebook/callback`
4. Save changes

### 3. Get App Credentials

1. Go to **Settings** > **Basic**
2. Copy **App ID** and **App Secret**

### 4. Configure Environment Variables

```bash
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
FACEBOOK_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/facebook/callback
```

### 5. Scopes Requested

- `email` - User's email address
- `public_profile` - User's public profile information

## GitHub OAuth Setup

### 1. Create GitHub OAuth App

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** > **New OAuth App**
3. Fill in:
   - **Application name**: Auth System
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3001/api/v1/auth/oauth/github/callback`
4. Click **Register application**

### 2. Get Credentials

1. Copy **Client ID**
2. Click **Generate a new client secret**
3. Copy **Client Secret**

### 3. Configure Environment Variables

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/github/callback
```

### 4. Scopes Requested

- `read:user` - Read user profile data
- `user:email` - Access user email addresses

## Environment Configuration

### Complete OAuth Configuration

Add these variables to your `.env` file:

```bash
# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/google/callback

# Facebook OAuth
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
FACEBOOK_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/facebook/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/github/callback

# Encryption key for storing OAuth tokens (32 bytes hex)
ENCRYPTION_KEY=your-32-byte-hex-encryption-key
```

### Generate Encryption Key

```bash
# Generate a random 32-byte hex key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testing OAuth Flow

### 1. Start Services

```bash
# Start database and Redis
docker-compose up -d postgres redis

# Start auth service
cd services/auth-service
npm run dev
```

### 2. Test Authorization URL Generation

```bash
# Get Google authorization URL
curl http://localhost:3001/api/v1/auth/oauth/google/authorize

# Response:
{
  "redirectUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=..."
}
```

### 3. Test Complete Flow

1. Open the `redirectUrl` in a browser
2. Log in with your Google/Facebook/GitHub account
3. Grant permissions
4. You'll be redirected to the callback URL
5. Backend will process the callback and redirect to frontend with tokens

### 4. Test Account Linking

```bash
# First, login with email/password to get access token
# Then link OAuth account

curl -X POST http://localhost:3001/api/v1/auth/oauth/link/google \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response:
{
  "redirectUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=..."
}
```

## API Endpoints

### GET /api/v1/auth/oauth/:provider/authorize

Initiate OAuth authorization flow.

**Parameters:**
- `provider` (path) - OAuth provider: `google`, `facebook`, or `github`
- `link` (query, optional) - Set to `true` to link account (requires authentication)

**Response:**
```json
{
  "redirectUrl": "https://provider.com/oauth/authorize?..."
}
```

### GET /api/v1/auth/oauth/:provider/callback

Handle OAuth callback from provider (called by provider, not directly).

**Parameters:**
- `provider` (path) - OAuth provider
- `code` (query) - Authorization code from provider
- `state` (query) - State token for CSRF protection

**Response:**
Redirects to frontend with tokens in URL parameters.

### POST /api/v1/auth/oauth/link/:provider

Link OAuth account to authenticated user.

**Headers:**
- `Authorization: Bearer <access_token>`

**Parameters:**
- `provider` (path) - OAuth provider to link

**Response:**
```json
{
  "redirectUrl": "https://provider.com/oauth/authorize?..."
}
```

## Security Considerations

### State Token (CSRF Protection)

- Unique state token generated for each OAuth flow
- Stored in Redis with 10-minute expiration
- Validated on callback to prevent CSRF attacks
- Single-use (deleted after validation)

### Token Encryption

- OAuth access and refresh tokens are encrypted before storage
- Uses AES-256-GCM encryption
- Encryption key must be 32 bytes (256 bits)
- Each token has unique IV and auth tag

### Email Verification

- Users created via OAuth have `email_verified=true`
- Email is trusted from OAuth provider
- No verification email sent

### Account Linking

- Prevents duplicate OAuth account linking
- Checks if OAuth account already linked to another user
- Requires authentication to link accounts
- Validates user owns the email address

### Token Storage

- OAuth tokens stored encrypted in database
- Refresh tokens updated on each login
- Expired tokens can be refreshed (if provider supports)

### Error Handling

- Generic error messages to prevent information disclosure
- Detailed errors logged server-side
- Failed OAuth attempts tracked
- Rate limiting on OAuth endpoints

## Troubleshooting

### "OAuth provider not configured"

- Check environment variables are set correctly
- Restart the service after adding variables
- Verify client ID and secret are correct

### "Invalid or expired OAuth state token"

- State token expired (10-minute TTL)
- Redis connection issue
- User took too long to authorize
- CSRF attack attempt

### "Failed to exchange authorization code for token"

- Invalid client secret
- Incorrect redirect URI
- Authorization code already used
- Network connectivity issue

### "Failed to fetch user information"

- Invalid access token
- Insufficient scopes requested
- Provider API is down
- Rate limit exceeded

### Email Not Provided by Provider

- GitHub: User may have private email
- Facebook: User denied email permission
- Solution: Request email permission explicitly

## Production Considerations

### HTTPS Required

- OAuth providers require HTTPS in production
- Update redirect URIs to use `https://`
- Configure SSL certificates

### Domain Verification

- Verify domain ownership with providers
- Add production domains to authorized origins
- Update redirect URIs for production

### Rate Limiting

- Implement rate limiting on OAuth endpoints
- Prevent abuse of authorization flow
- Monitor failed OAuth attempts

### Monitoring

- Log all OAuth events
- Track success/failure rates
- Monitor token refresh failures
- Alert on suspicious patterns

### Compliance

- Display privacy policy during OAuth
- Explain what data is collected
- Provide option to unlink accounts
- Support data deletion requests

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
