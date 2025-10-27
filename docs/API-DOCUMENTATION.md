# API Documentation - Enterprise Auth System

Complete API reference for all implemented endpoints.

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Session Management](#session-management)
4. [RBAC (Roles & Permissions)](#rbac)
5. [Subscriptions](#subscriptions)
6. [Payments](#payments)
7. [MFA (Multi-Factor Authentication)](#mfa)
8. [OAuth](#oauth)

---

## Base Information

### Base URLs
- **API Gateway:** `http://localhost:3000`
- **Auth Service:** `http://localhost:3001`
- **User Service:** `http://localhost:3002`

### Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Response Format
All responses follow this structure:

**Success Response:**
```json
{
  "data": { ... },
  "message": "Success message"
}
```

**Error Response:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": { ... },
    "requestId": "uuid",
    "timestamp": "2025-10-26T..."
  }
}
```

---

## Authentication

### POST /api/v1/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "captchaToken": "captcha-token"
}
```

**Response:** `201 Created`
```json
{
  "userId": "uuid",
  "message": "Verification email sent"
}
```

**Errors:**
- `400` - Validation error
- `409` - Email already exists

---

### GET /api/v1/auth/verify-email
Verify user email address.

**Query Parameters:**
- `token` (required) - Email verification token

**Response:** `200 OK`
```json
{
  "message": "Email verified successfully"
}
```

---

### POST /api/v1/auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900,
  "requiresMfa": false
}
```

**If MFA is enabled:**
```json
{
  "requiresMfa": true,
  "mfaToken": "temporary-token",
  "message": "MFA verification required"
}
```

**Errors:**
- `401` - Invalid credentials
- `403` - Account locked or deactivated

---

### POST /api/v1/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGc...",
  "expiresIn": 900
}
```

---

### POST /api/v1/auth/password/reset-request
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password reset email sent"
}
```

---

### POST /api/v1/auth/password/reset
Reset password with token.

**Request Body:**
```json
{
  "token": "reset-token",
  "newPassword": "NewSecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password reset successfully"
}
```

---

## User Management

### GET /api/v1/users/me
Get current user profile.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "emailVerified": true,
  "name": "John Doe",
  "avatarUrl": "http://...",
  "phoneNumber": "+1234567890",
  "bio": "Software Developer",
  "preferences": {
    "language": "en",
    "timezone": "UTC",
    "notifications": {
      "email": true,
      "sms": false,
      "push": false
    }
  },
  "roles": ["user"],
  "createdAt": "2025-10-26T...",
  "updatedAt": "2025-10-26T..."
}
```

---

### PATCH /api/v1/users/me
Update user profile.

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "name": "Jane Doe",
  "phoneNumber": "+1234567890",
  "bio": "Full Stack Developer",
  "preferences": {
    "language": "en",
    "timezone": "America/New_York",
    "notifications": {
      "email": true,
      "sms": true
    }
  }
}
```

**Response:** `200 OK`
Returns updated user profile.

---

### POST /api/v1/users/me/avatar
Upload user avatar image.

**Headers:** 
- `Authorization: Bearer TOKEN`
- `Content-Type: multipart/form-data`

**Form Data:**
- `avatar` - Image file (JPEG, PNG, WebP, max 5MB)

**Response:** `200 OK`
```json
{
  "avatarUrl": "http://localhost:3002/uploads/avatars/uuid.jpg",
  "thumbnails": {
    "small": "http://.../uuid_50x50.jpg",
    "medium": "http://.../uuid_150x150.jpg",
    "large": "http://.../uuid_300x300.jpg"
  }
}
```

---

### POST /api/v1/users/me/deactivate
Deactivate user account.

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "password": "CurrentPassword123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Account deactivated successfully"
}
```

---

### DELETE /api/v1/users/me
Delete user account (soft delete with 30-day grace period).

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "password": "CurrentPassword123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Account deletion scheduled. Your data will be permanently deleted in 30 days."
}
```

---

### GET /api/v1/users/me/data-export
Export all user data (GDPR compliance).

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "downloadUrl": "http://localhost:3002/exports/user_data_uuid_timestamp.json",
  "expiresAt": "2025-11-02T..."
}
```

---

## Session Management

### GET /api/v1/users/me/sessions
Get all active sessions for current user.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "sessions": [
    {
      "id": "uuid",
      "deviceInfo": {
        "userAgent": "Mozilla/5.0...",
        "browser": "Chrome",
        "os": "Windows"
      },
      "ipAddress": "192.168.1.1",
      "location": {
        "country": "US",
        "city": "New York"
      },
      "createdAt": "2025-10-26T...",
      "lastActivityAt": "2025-10-26T...",
      "isCurrent": true
    }
  ]
}
```

---

### DELETE /api/v1/users/me/sessions/:sessionId
Revoke a specific session.

**Headers:** `Authorization: Bearer TOKEN`

**URL Parameters:**
- `sessionId` - Session ID to revoke

**Response:** `200 OK`
```json
{
  "message": "Session revoked successfully"
}
```

---

### DELETE /api/v1/users/me/sessions
Revoke all sessions except current.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "message": "2 session(s) revoked successfully",
  "revokedCount": 2
}
```

---

## RBAC

### GET /api/v1/roles
Get all roles.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "roles": [
    {
      "id": "uuid",
      "name": "Admin",
      "description": "Administrator role",
      "permissions": ["users:read", "users:write", "admin:access"],
      "parentRoleId": null,
      "isSystem": true,
      "createdAt": "2025-10-26T...",
      "updatedAt": "2025-10-26T..."
    }
  ]
}
```

---

### POST /api/v1/roles
Create a new role (Admin only).

**Headers:** `Authorization: Bearer ADMIN_TOKEN`

**Request Body:**
```json
{
  "name": "Editor",
  "description": "Content editor role",
  "permissions": ["users:read", "users:write"],
  "parentRoleId": "parent-role-uuid"
}
```

**Response:** `201 Created`
Returns created role object.

---

### PATCH /api/v1/roles/:roleId
Update a role (Admin only).

**Headers:** `Authorization: Bearer ADMIN_TOKEN`

**Request Body:**
```json
{
  "description": "Updated description",
  "permissions": ["users:read", "users:write", "users:delete"]
}
```

**Response:** `200 OK`
Returns updated role object.

---

### DELETE /api/v1/roles/:roleId
Delete a role (Admin only).

**Headers:** `Authorization: Bearer ADMIN_TOKEN`

**Response:** `200 OK`
```json
{
  "message": "Role deleted successfully"
}
```

---

### POST /api/v1/users/:userId/roles
Assign role to user (Admin only).

**Headers:** `Authorization: Bearer ADMIN_TOKEN`

**Request Body:**
```json
{
  "roleId": "role-uuid"
}
```

**Response:** `200 OK`
```json
{
  "message": "Role assigned successfully"
}
```

---

### DELETE /api/v1/users/:userId/roles/:roleId
Remove role from user (Admin only).

**Headers:** `Authorization: Bearer ADMIN_TOKEN`

**Response:** `200 OK`
```json
{
  "message": "Role removed successfully"
}
```

---

### GET /api/v1/permissions
Get all available permissions.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "permissions": [
    {
      "id": "1",
      "resource": "users",
      "action": "read",
      "description": "View user information"
    },
    {
      "id": "2",
      "resource": "users",
      "action": "write",
      "description": "Create and update users"
    }
  ]
}
```

---

### GET /api/v1/users/:userId/permissions
Get user permissions (with inheritance).

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "permissions": [
    "users:read",
    "users:write",
    "sessions:read"
  ]
}
```

---

## Subscriptions

### GET /api/v1/subscriptions/plans
Get all subscription plans.

**Query Parameters:**
- `interval` (optional) - Filter by interval: `month` or `year`

**Response:** `200 OK`
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Basic Plan",
      "description": "Perfect for individuals",
      "price": 9.99,
      "currency": "USD",
      "interval": "month",
      "intervalCount": 1,
      "features": {
        "feature1": true,
        "feature2": false
      },
      "limits": {
        "apiCalls": 10000,
        "storage": 1000,
        "users": 5
      },
      "isActive": true,
      "createdAt": "2025-10-26T...",
      "updatedAt": "2025-10-26T..."
    }
  ]
}
```

---

### GET /api/v1/subscriptions/plans/:planId
Get specific subscription plan.

**Response:** `200 OK`
Returns single plan object.

---

### POST /api/v1/subscriptions/plans
Create subscription plan (Admin only).

**Headers:** `Authorization: Bearer ADMIN_TOKEN`

**Request Body:**
```json
{
  "name": "Premium Plan",
  "description": "For power users",
  "price": 29.99,
  "currency": "USD",
  "interval": "month",
  "intervalCount": 1,
  "features": {
    "advancedFeatures": true,
    "prioritySupport": true
  },
  "limits": {
    "apiCalls": 100000,
    "storage": 10000,
    "users": 50
  }
}
```

**Response:** `201 Created`
Returns created plan object.

---

### GET /api/v1/subscriptions/me
Get current user subscription.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "planId": "plan-uuid",
  "status": "active",
  "currentPeriodStart": "2025-10-26T...",
  "currentPeriodEnd": "2025-11-26T...",
  "cancelAtPeriodEnd": false,
  "usage": {
    "apiCalls": 1500,
    "storage": 250,
    "users": 2
  }
}
```

---

### POST /api/v1/subscriptions/subscribe
Subscribe to a plan.

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "planId": "plan-uuid",
  "paymentMethodId": "payment-method-uuid"
}
```

**Response:** `201 Created`
Returns subscription object.

---

### POST /api/v1/subscriptions/change-plan
Change subscription plan.

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "newPlanId": "new-plan-uuid",
  "prorationBehavior": "create_prorations"
}
```

**Response:** `200 OK`
Returns updated subscription object.

---

### POST /api/v1/subscriptions/cancel
Cancel subscription.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "message": "Subscription will be canceled at the end of the current billing period"
}
```

---

### POST /api/v1/subscriptions/usage
Track usage (internal).

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "metric": "apiCalls",
  "quantity": 100
}
```

**Response:** `200 OK`
```json
{
  "message": "Usage tracked successfully"
}
```

---

### GET /api/v1/subscriptions/check-limits
Check if usage is within limits.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "withinLimits": true,
  "message": "Usage within limits"
}
```

---

## Payments

### POST /api/v1/payments/methods
Add payment method.

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "type": "card",
  "token": "tok_visa",
  "last4": "4242",
  "brand": "Visa",
  "expiryMonth": 12,
  "expiryYear": 2025
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "type": "card",
  "last4": "4242",
  "brand": "Visa",
  "expiryMonth": 12,
  "expiryYear": 2025,
  "isDefault": true,
  "createdAt": "2025-10-26T...",
  "updatedAt": "2025-10-26T..."
}
```

---

### GET /api/v1/payments/methods
Get all payment methods.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "methods": [
    {
      "id": "uuid",
      "type": "card",
      "last4": "4242",
      "brand": "Visa",
      "expiryMonth": 12,
      "expiryYear": 2025,
      "isDefault": true
    }
  ]
}
```

---

### POST /api/v1/payments/methods/:methodId/set-default
Set default payment method.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "message": "Default payment method updated"
}
```

---

### DELETE /api/v1/payments/methods/:methodId
Delete payment method.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "message": "Payment method deleted successfully"
}
```

---

### GET /api/v1/payments/invoices
Get all invoices.

**Headers:** `Authorization: Bearer TOKEN`

**Query Parameters:**
- `status` (optional) - Filter by status: `draft`, `open`, `paid`, `void`

**Response:** `200 OK`
```json
{
  "invoices": [
    {
      "id": "uuid",
      "number": "INV-2025-001",
      "amount": 29.99,
      "currency": "USD",
      "status": "paid",
      "description": "Monthly subscription",
      "dueDate": "2025-11-02T...",
      "paidAt": "2025-10-26T...",
      "pdfUrl": "http://.../invoice.pdf",
      "createdAt": "2025-10-26T..."
    }
  ]
}
```

---

### POST /api/v1/payments/process
Process payment (internal).

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "invoiceId": "invoice-uuid",
  "paymentMethodId": "payment-method-uuid"
}
```

**Response:** `200 OK`
```json
{
  "id": "payment-uuid",
  "invoiceId": "invoice-uuid",
  "amount": 29.99,
  "currency": "USD",
  "status": "succeeded",
  "paymentMethodId": "payment-method-uuid",
  "processorPaymentId": "ch_...",
  "createdAt": "2025-10-26T..."
}
```

---

### POST /api/v1/payments/webhooks
Handle payment processor webhooks (public endpoint).

**Headers:** 
- `stripe-signature` or `x-webhook-signature`

**Request Body:**
```json
{
  "type": "payment.succeeded",
  "data": {
    "id": "ch_...",
    ...
  }
}
```

**Response:** `200 OK`
```json
{
  "received": true
}
```

---

## MFA

### POST /api/v1/auth/mfa/enroll/totp
Enroll TOTP MFA.

**Headers:** `Authorization: Bearer TOKEN`

**Response:** `200 OK`
```json
{
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backupCodes": [
    "123456",
    "234567",
    "345678",
    ...
  ]
}
```

---

### POST /api/v1/auth/mfa/verify-enrollment
Verify MFA enrollment.

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "message": "MFA enabled successfully",
  "backupCodes": ["123456", "234567", ...]
}
```

---

### POST /api/v1/auth/mfa/verify
Verify MFA code during login.

**Request Body:**
```json
{
  "mfaToken": "temporary-mfa-token",
  "code": "123456",
  "method": "totp"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900
}
```

---

### POST /api/v1/auth/mfa/disable
Disable MFA.

**Headers:** `Authorization: Bearer TOKEN`

**Request Body:**
```json
{
  "password": "CurrentPassword123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "MFA disabled successfully"
}
```

---

## OAuth

### GET /api/v1/auth/oauth/:provider/authorize
Initiate OAuth flow.

**URL Parameters:**
- `provider` - OAuth provider: `google`, `facebook`, `github`

**Response:** `302 Redirect`
Redirects to OAuth provider authorization page.

---

### GET /api/v1/auth/oauth/:provider/callback
OAuth callback handler.

**Query Parameters:**
- `code` - Authorization code from provider
- `state` - CSRF state token

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Email or password is incorrect |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `MFA_REQUIRED` | 403 | MFA verification needed |
| `INVALID_MFA_CODE` | 400 | MFA code is incorrect or expired |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `INVALID_TOKEN` | 401 | Token is malformed or invalid |
| `ACCOUNT_LOCKED` | 403 | Account temporarily locked |
| `ACCOUNT_DEACTIVATED` | 403 | Account has been deactivated |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `SUBSCRIPTION_REQUIRED` | 402 | Active subscription required |
| `QUOTA_EXCEEDED` | 429 | Usage quota exceeded |
| `PAYMENT_FAILED` | 402 | Payment processing failed |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 5 requests per 15 minutes per IP |
| Registration | 3 requests per hour per IP |
| Password Reset | 3 requests per hour per email |
| MFA Verification | 5 requests per 5 minutes per session |
| Authenticated API | 1000 requests per hour per user |
| Public API | 100 requests per hour per IP |
| Admin API | 5000 requests per hour per user |

---

**Version:** 1.0.0  
**Last Updated:** October 26, 2025
