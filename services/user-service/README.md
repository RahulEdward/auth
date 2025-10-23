# User Service

User profile management service for the Enterprise Authentication System.

## Features

- ✅ User profile retrieval with Redis caching
- ✅ Profile updates (name, phone, bio, preferences)
- ✅ Avatar upload with automatic thumbnail generation
- ✅ Account deactivation
- ✅ Account deletion (soft delete with 30-day grace period)
- ✅ GDPR data export
- ✅ Permanent deletion background job

## API Endpoints

### Profile Management

#### GET /api/v1/users/me
Get current user profile.

**Authentication:** Required

**Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "emailVerified": true,
  "name": "John Doe",
  "avatarUrl": "http://localhost:3002/uploads/avatars/avatar.jpg",
  "phoneNumber": "+1234567890",
  "bio": "Software developer",
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
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

#### PATCH /api/v1/users/me
Update user profile.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Jane Doe",
  "phoneNumber": "+1234567890",
  "bio": "Updated bio",
  "preferences": {
    "language": "es",
    "timezone": "America/New_York",
    "notifications": {
      "email": true,
      "sms": true
    }
  }
}
```

### Avatar Management

#### POST /api/v1/users/me/avatar
Upload user avatar.

**Authentication:** Required

**Content-Type:** multipart/form-data

**Form Data:**
- `avatar`: Image file (JPEG, PNG, WebP, max 5MB)

**Response:**
```json
{
  "avatarUrl": "http://localhost:3002/uploads/avatars/original.jpg",
  "thumbnails": {
    "small": "http://localhost:3002/uploads/avatars/50x50.jpg",
    "medium": "http://localhost:3002/uploads/avatars/150x150.jpg",
    "large": "http://localhost:3002/uploads/avatars/300x300.jpg"
  }
}
```

### Account Lifecycle

#### POST /api/v1/users/me/deactivate
Deactivate user account.

**Authentication:** Required

**Request Body:**
```json
{
  "password": "user-password"
}
```

**Response:**
```json
{
  "message": "Account deactivated successfully"
}
```

#### DELETE /api/v1/users/me
Delete user account (soft delete).

**Authentication:** Required

**Request Body:**
```json
{
  "password": "user-password"
}
```

**Response:**
```json
{
  "message": "Account deletion scheduled. Your data will be permanently deleted in 30 days."
}
```

### GDPR Compliance

#### GET /api/v1/users/me/data-export
Export all user data.

**Authentication:** Required

**Response:**
```json
{
  "downloadUrl": "http://localhost:3002/exports/user_data_123.json",
  "expiresAt": "2025-01-08T00:00:00.000Z"
}
```

## Features

### Profile Caching
- User profiles are cached in Redis for 5 minutes
- Cache is automatically invalidated on profile updates
- Reduces database load for frequently accessed profiles

### Avatar Processing
- Automatic image resizing to 800x800 for originals
- Three thumbnail sizes: 50x50, 150x150, 300x300
- Supports JPEG, PNG, and WebP formats
- Maximum file size: 5MB
- Uses Sharp library for high-performance image processing

### Account Deactivation
- Requires password confirmation
- Revokes all active sessions
- Invalidates all Redis tokens
- Sends notification email
- Account can be reactivated by logging in again

### Account Deletion
- Soft delete with 30-day grace period
- Requires password confirmation
- Revokes all active sessions
- Sends confirmation email
- Permanent deletion after 30 days

### GDPR Data Export
- Exports all user data in JSON format
- Includes: profile, sessions, OAuth accounts, subscriptions
- Download link expires in 7 days
- Email notification with download link

### Permanent Deletion Job
- Background job runs periodically
- Finds users deleted > 30 days ago
- Anonymizes personal data
- Deletes OAuth accounts and sessions
- Preserves audit logs with anonymized ID

## Environment Variables

```bash
USER_SERVICE_PORT=3002
STORAGE_URL=http://localhost:3002
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev

# Start production
npm start
```

## Storage

### Local Development
- Avatars stored in `uploads/avatars/`
- Data exports stored in `exports/`
- Served as static files

### Production
- Upload to S3/MinIO for avatars
- Use signed URLs for data exports
- Configure CDN for avatar delivery

## Security

- Password verification required for account changes
- All endpoints require authentication
- File type validation for uploads
- File size limits enforced
- Malicious file scanning (TODO)
- GDPR compliant data export

## Testing

```bash
npm test
```

## Dependencies

- **express** - Web framework
- **multer** - File upload handling
- **sharp** - Image processing
- **uuid** - Unique ID generation
- **@auth/shared** - Shared utilities

## Notes

- Avatar uploads are stored locally in development
- In production, integrate with S3/MinIO
- Permanent deletion job should run via cron/scheduler
- Email notifications are queued (TODO: implement)
