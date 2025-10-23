# Auth Service

Authentication service providing user registration, login, and password management.

## Features

- ✅ User registration with CAPTCHA verification
- ✅ Email verification
- ✅ Email/password login
- ✅ Account lockout after failed attempts
- ✅ Password reset with secure tokens
- ✅ Password history (prevents reuse of last 5 passwords)
- ✅ MFA support (token generation)
- ✅ Role-based permissions

## API Endpoints

### POST /api/v1/auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "name": "John Doe",
  "captchaToken": "captcha-token-here"
}
```

**Response:** `201 Created`
```json
{
  "userId": "uuid",
  "message": "Registration successful. Please check your email to verify your account."
}
```

### GET /api/v1/auth/verify-email?token=xxx
Verify email address with token from email.

**Response:** `200 OK`
```json
{
  "message": "Email verified successfully"
}
```

### POST /api/v1/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```

**Response (MFA Required):** `403 Forbidden`
```json
{
  "requiresMfa": true,
  "mfaToken": "temporary-mfa-token",
  "message": "Multi-factor authentication required"
}
```

### POST /api/v1/auth/password/reset-request
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "If the email exists, a password reset link has been sent."
}
```

### POST /api/v1/auth/password/reset
Reset password with token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewPassword123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password reset successful. Please log in with your new password."
}
```

### POST /api/v1/auth/refresh
Refresh access token (TODO).

## Security Features

### Account Lockout
- After 5 failed login attempts within 15 minutes
- Account locked for 30 minutes
- Automatic unlock after timeout

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Cannot reuse last 5 passwords

### Token Security
- Email verification tokens: 24-hour expiration
- Password reset tokens: 1-hour expiration
- MFA tokens: 5-minute expiration
- All tokens hashed before storage

### CAPTCHA Verification
- Supports Google reCAPTCHA and hCaptcha
- Configurable via environment variables
- Skipped in test environment

## Running the Service

```bash
# Development
npm run dev -w @auth/auth-service

# Production
npm run build -w @auth/auth-service
npm start -w @auth/auth-service
```

## Environment Variables

```env
AUTH_SERVICE_PORT=3001
CAPTCHA_PROVIDER=recaptcha
RECAPTCHA_SECRET_KEY=your-secret-key
```

## Testing

```bash
npm test -w @auth/auth-service
```

## Dependencies

- `@auth/shared` - Shared utilities and types
- `express` - Web framework
- `axios` - HTTP client for CAPTCHA verification
