# API Testing Guide - Enterprise Auth System

This guide shows you how to test all the implemented endpoints using cURL or any HTTP client.

## Base URLs

- **API Gateway:** http://localhost:3000
- **Auth Service:** http://localhost:3001
- **User Service:** http://localhost:3002

---

## 1. Authentication Endpoints

### 1.1 Register a New User

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User",
    "captchaToken": "test-token"
  }'
```

**Expected Response:**
```json
{
  "userId": "uuid",
  "message": "Verification email sent"
}
```

### 1.2 Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900,
  "requiresMfa": false
}
```

### 1.3 Refresh Token

```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

### 1.4 Request Password Reset

```bash
curl -X POST http://localhost:3001/api/v1/auth/password/reset-request \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

### 1.5 Reset Password

```bash
curl -X POST http://localhost:3001/api/v1/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset-token",
    "newPassword": "NewSecurePass123!"
  }'
```

---

## 2. User Profile Endpoints

### 2.1 Get Current User Profile

```bash
curl -X GET http://localhost:3002/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "id": "uuid",
  "email": "test@example.com",
  "emailVerified": true,
  "name": "Test User",
  "avatarUrl": null,
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

### 2.2 Update Profile

```bash
curl -X PATCH http://localhost:3002/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "bio": "Software Developer",
    "preferences": {
      "language": "en",
      "timezone": "America/New_York"
    }
  }'
```

### 2.3 Upload Avatar

```bash
curl -X POST http://localhost:3002/api/v1/users/me/avatar \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "avatar=@/path/to/image.jpg"
```

**Expected Response:**
```json
{
  "avatarUrl": "http://localhost:3002/uploads/avatars/uuid.jpg",
  "thumbnails": {
    "small": "http://localhost:3002/uploads/avatars/uuid_50x50.jpg",
    "medium": "http://localhost:3002/uploads/avatars/uuid_150x150.jpg",
    "large": "http://localhost:3002/uploads/avatars/uuid_300x300.jpg"
  }
}
```

---

## 3. Session Management Endpoints

### 3.1 Get All Sessions

```bash
curl -X GET http://localhost:3002/api/v1/users/me/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "deviceInfo": {
        "browser": "Chrome",
        "os": "Windows"
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2025-10-26T...",
      "lastActivityAt": "2025-10-26T...",
      "isCurrent": true
    }
  ]
}
```

### 3.2 Revoke a Session

```bash
curl -X DELETE http://localhost:3002/api/v1/users/me/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3.3 Revoke All Sessions (Except Current)

```bash
curl -X DELETE http://localhost:3002/api/v1/users/me/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 4. RBAC Endpoints

### 4.1 Get All Roles

```bash
curl -X GET http://localhost:3002/api/v1/roles \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4.2 Create Role (Admin Only)

```bash
curl -X POST http://localhost:3002/api/v1/roles \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Editor",
    "description": "Can edit content",
    "permissions": ["users:read", "users:write"]
  }'
```

### 4.3 Get All Permissions

```bash
curl -X GET http://localhost:3002/api/v1/permissions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4.4 Assign Role to User (Admin Only)

```bash
curl -X POST http://localhost:3002/api/v1/users/USER_ID/roles \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleId": "ROLE_ID"
  }'
```

### 4.5 Get User Permissions

```bash
curl -X GET http://localhost:3002/api/v1/users/USER_ID/permissions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 5. Subscription Endpoints

### 5.1 Get All Subscription Plans

```bash
curl -X GET http://localhost:3002/api/v1/subscriptions/plans
```

**Expected Response:**
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
      "features": {
        "feature1": true,
        "feature2": false
      },
      "limits": {
        "apiCalls": 10000,
        "storage": 1000,
        "users": 5
      }
    }
  ]
}
```

### 5.2 Get Current Subscription

```bash
curl -X GET http://localhost:3002/api/v1/subscriptions/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5.3 Subscribe to a Plan

```bash
curl -X POST http://localhost:3002/api/v1/subscriptions/subscribe \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "PLAN_ID",
    "paymentMethodId": "PAYMENT_METHOD_ID"
  }'
```

### 5.4 Change Subscription Plan

```bash
curl -X POST http://localhost:3002/api/v1/subscriptions/change-plan \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newPlanId": "NEW_PLAN_ID",
    "prorationBehavior": "create_prorations"
  }'
```

### 5.5 Cancel Subscription

```bash
curl -X POST http://localhost:3002/api/v1/subscriptions/cancel \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5.6 Check Usage Limits

```bash
curl -X GET http://localhost:3002/api/v1/subscriptions/check-limits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 6. Payment Endpoints

### 6.1 Add Payment Method

```bash
curl -X POST http://localhost:3002/api/v1/payments/methods \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "card",
    "token": "tok_visa",
    "last4": "4242",
    "brand": "Visa",
    "expiryMonth": 12,
    "expiryYear": 2025
  }'
```

### 6.2 Get Payment Methods

```bash
curl -X GET http://localhost:3002/api/v1/payments/methods \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
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

### 6.3 Set Default Payment Method

```bash
curl -X POST http://localhost:3002/api/v1/payments/methods/METHOD_ID/set-default \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6.4 Delete Payment Method

```bash
curl -X DELETE http://localhost:3002/api/v1/payments/methods/METHOD_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6.5 Get Invoices

```bash
curl -X GET http://localhost:3002/api/v1/payments/invoices \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6.6 Get Invoices by Status

```bash
curl -X GET "http://localhost:3002/api/v1/payments/invoices?status=paid" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 7. MFA Endpoints

### 7.1 Enroll TOTP MFA

```bash
curl -X POST http://localhost:3001/api/v1/auth/mfa/enroll/totp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backupCodes": ["123456", "234567", ...]
}
```

### 7.2 Verify MFA Enrollment

```bash
curl -X POST http://localhost:3001/api/v1/auth/mfa/verify-enrollment \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'
```

### 7.3 Verify MFA During Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "mfaToken": "temporary-mfa-token",
    "code": "123456",
    "method": "totp"
  }'
```

---

## 8. Account Management

### 8.1 Deactivate Account

```bash
curl -X POST http://localhost:3002/api/v1/users/me/deactivate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "YourPassword123!"
  }'
```

### 8.2 Delete Account (Soft Delete)

```bash
curl -X DELETE http://localhost:3002/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "YourPassword123!"
  }'
```

### 8.3 Export User Data (GDPR)

```bash
curl -X GET http://localhost:3002/api/v1/users/me/data-export \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "downloadUrl": "http://localhost:3002/exports/user_data_uuid_timestamp.json",
  "expiresAt": "2025-11-02T..."
}
```

---

## Testing Workflow

### Complete User Journey

1. **Register a new user**
2. **Login to get access token**
3. **Get user profile**
4. **Update profile**
5. **Upload avatar**
6. **View sessions**
7. **Get subscription plans**
8. **Add payment method**
9. **Subscribe to a plan**
10. **Check usage limits**

### Example Test Script (PowerShell)

```powershell
# 1. Register
$registerResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"SecurePass123!","name":"Test User","captchaToken":"test"}'

# 2. Login
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"SecurePass123!"}'

$token = $loginResponse.accessToken

# 3. Get Profile
$profile = Invoke-RestMethod -Uri "http://localhost:3002/api/v1/users/me" `
  -Method GET `
  -Headers @{Authorization="Bearer $token"}

Write-Host "User Profile: $($profile | ConvertTo-Json)"
```

---

## Health Checks

```bash
# API Gateway
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# User Service
curl http://localhost:3002/health
```

---

## Notes

- Replace `YOUR_ACCESS_TOKEN` with the actual token from login response
- Replace `USER_ID`, `ROLE_ID`, `PLAN_ID`, etc. with actual IDs
- All authenticated endpoints require the `Authorization: Bearer TOKEN` header
- Admin endpoints require a token with admin permissions

---

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Token expired or invalid - login again
2. **403 Forbidden**: Insufficient permissions - check user roles
3. **404 Not Found**: Resource doesn't exist - verify IDs
4. **500 Internal Server Error**: Check service logs

### View Logs

The services output logs in real-time. Check the terminal where services are running for detailed error messages.

---

**Happy Testing! 🚀**
