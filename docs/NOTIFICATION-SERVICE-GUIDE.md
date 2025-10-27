# Notification Service Guide

## Overview

The Notification Service handles all email and SMS notifications for the Enterprise Authentication System. It uses a queue-based architecture with RabbitMQ for reliable message delivery and supports multiple email/SMS providers.

## Features

- **Email Sending**: Support for SMTP, SendGrid, AWS SES, and Mailgun
- **SMS Sending**: Support for Twilio and AWS SNS
- **Template System**: Handlebars-based email templates with HTML and text versions
- **Queue-Based Processing**: RabbitMQ for reliable async message delivery
- **Retry Logic**: Automatic retry with exponential backoff for failed deliveries
- **Notification Preferences**: User-configurable notification settings
- **Delivery Tracking**: Track email and SMS delivery status

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Services  │─────▶│   RabbitMQ   │─────▶│  Notification   │
│ (Auth/User) │      │    Queue     │      │    Service      │
└─────────────┘      └──────────────┘      └─────────────────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    │                │                │
                              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
                              │   SMTP    │   │  Twilio   │   │  MailHog  │
                              │  Provider │   │    SMS    │   │  (Dev)    │
                              └───────────┘   └───────────┘   └───────────┘
```

## Email Templates

The service includes pre-built templates for common notifications:

1. **email-verification** - Email address verification
2. **password-reset** - Password reset requests
3. **mfa-code** - Multi-factor authentication codes
4. **welcome** - Welcome email for new users
5. **password-changed** - Password change confirmation
6. **subscription-confirmation** - Subscription activation
7. **invoice** - Payment invoices
8. **payment-failed** - Failed payment notifications
9. **account-deletion** - Account deletion confirmation

## Configuration

### Environment Variables

```bash
# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Email Provider (smtp, sendgrid, ses, mailgun)
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM_NAME=Auth System
EMAIL_FROM_ADDRESS=noreply@authsystem.com
EMAIL_REPLY_TO=

# SendGrid (optional)
SENDGRID_API_KEY=

# AWS SES/SNS (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Mailgun (optional)
MAILGUN_API_KEY=
MAILGUN_DOMAIN=

# SMS Provider (twilio, sns)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Service Port
NOTIFICATION_SERVICE_PORT=3004
```

## Development Setup

### 1. Start Dependencies

```bash
# Start Docker containers (PostgreSQL, Redis, RabbitMQ, MailHog)
docker-compose up -d
```

### 2. Install Dependencies

```bash
cd services/notification-service
npm install
```

### 3. Start Service

```bash
npm run dev
```

### 4. View Emails (Development)

MailHog provides a web UI to view sent emails:
- Web UI: http://localhost:8025
- SMTP: localhost:1025

### 5. View RabbitMQ Management

RabbitMQ Management UI:
- URL: http://localhost:15672
- Username: guest
- Password: guest

## Usage

### Sending Emails via Queue

```typescript
import { QueueService } from './services/queue.service';

const queueService = new QueueService();
await queueService.connect();

// Queue an email
await queueService.publishEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
  variables: {
    name: 'John Doe',
    dashboardUrl: 'https://example.com/dashboard',
    year: new Date().getFullYear(),
  },
});
```

### Sending SMS via Queue

```typescript
await queueService.publishSms({
  to: '+1234567890',
  message: 'Your verification code is: 123456',
});
```

### Direct Email Sending

```typescript
import { EmailService } from './services/email.service';

const emailService = new EmailService();

const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Test Email',
  template: 'email-verification',
  variables: {
    name: 'John Doe',
    verificationUrl: 'https://example.com/verify/token123',
    year: 2024,
  },
});

console.log('Email sent:', result.providerId);
```

## Template Development

### Creating a New Template

1. Create HTML template: `src/templates/my-template.html.hbs`
2. Create text template: `src/templates/my-template.txt.hbs`

### Template Variables

Templates use Handlebars syntax:

```handlebars
<p>Hi {{name}},</p>
<p>Your code is: {{code}}</p>
<p>Expires: {{formatDate expiryDate}}</p>
<p>Amount: {{formatCurrency amount currency}}</p>
```

### Available Helpers

- `{{formatDate date}}` - Format date as "January 15, 2024"
- `{{formatCurrency amount currency}}` - Format as "$29.99"
- `{{eq a b}}` - Equality check
- `{{ne a b}}` - Not equal check
- `{{gt a b}}` - Greater than
- `{{lt a b}}` - Less than

## Notification Preferences

Users can configure their notification preferences:

```typescript
import { PreferenceService } from './services/preference.service';

const preferenceService = new PreferenceService();

// Check if should send email
const shouldSend = await preferenceService.shouldSendEmail(userId, 'marketing');

// Unsubscribe from marketing
await preferenceService.unsubscribeFromMarketing(userId);

// Unsubscribe from all
await preferenceService.unsubscribeFromAll(userId);
```

### Preference Categories

- **security** - Always sent (password changes, login alerts)
- **marketing** - Promotional emails
- **updates** - Product updates and announcements

## API Endpoints

### Health Checks

```bash
# Liveness check
GET /health/live

# Readiness check
GET /health/ready
```

### Notification Preferences

```bash
# Get user preferences
GET /api/v1/notifications/preferences/:userId

# Unsubscribe from marketing
POST /api/v1/notifications/unsubscribe/marketing/:userId

# Unsubscribe from all
POST /api/v1/notifications/unsubscribe/all/:userId
```

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm test -- --coverage
```

### Manual Testing with MailHog

1. Start MailHog: `docker-compose up -d mailhog`
2. Send test email through the service
3. View email in MailHog UI: http://localhost:8025

## Monitoring

### Queue Metrics

Monitor RabbitMQ queues:
- Queue depth
- Message rate
- Consumer count
- Failed messages in dead letter queue

### Delivery Tracking

The service tracks delivery status:
- `pending` - Queued for delivery
- `sent` - Sent to provider
- `delivered` - Confirmed delivery
- `failed` - Delivery failed
- `bounced` - Email bounced

## Error Handling

### Retry Logic

- Failed messages are retried up to 3 times
- Exponential backoff: 2s, 4s, 8s
- After max retries, messages go to dead letter queue

### Dead Letter Queue

Failed messages are stored in `notifications.failed` queue for manual review.

## Production Considerations

### Email Provider Selection

- **SMTP**: Simple, works with any provider
- **SendGrid**: High deliverability, good analytics
- **AWS SES**: Cost-effective, requires domain verification
- **Mailgun**: Developer-friendly, good for transactional emails

### SMS Provider Selection

- **Twilio**: Reliable, global coverage, good documentation
- **AWS SNS**: Cost-effective, integrates with AWS ecosystem

### Scaling

- Run multiple notification service instances
- RabbitMQ handles load distribution
- Monitor queue depth and adjust consumers

### Security

- Store API keys in environment variables or secrets manager
- Use TLS for SMTP connections
- Validate email addresses before sending
- Implement rate limiting to prevent abuse

## Troubleshooting

### Emails Not Sending

1. Check SMTP configuration in .env
2. Verify MailHog is running: `docker ps`
3. Check service logs for errors
4. Test SMTP connection: `npm run dev` and check logs

### Queue Not Processing

1. Check RabbitMQ is running: `docker ps`
2. View RabbitMQ management UI: http://localhost:15672
3. Check for messages in dead letter queue
4. Review service logs for consumer errors

### Template Errors

1. Verify template file exists in `src/templates/`
2. Check template syntax (Handlebars)
3. Ensure all variables are provided
4. Review template service logs

## Integration with Other Services

### From Auth Service

```typescript
// Queue email verification
await queueService.publishEmail({
  to: user.email,
  subject: 'Verify Your Email',
  template: 'email-verification',
  variables: {
    name: user.name,
    verificationUrl: `${config.frontendUrl}/verify/${token}`,
    year: new Date().getFullYear(),
  },
});
```

### From User Service

```typescript
// Queue password changed notification
await queueService.publishEmail({
  to: user.email,
  subject: 'Password Changed',
  template: 'password-changed',
  variables: {
    name: user.name,
    changedAt: new Date(),
    ipAddress: req.ip,
    device: req.get('user-agent'),
    year: new Date().getFullYear(),
  },
});
```

## Next Steps

- [ ] Implement push notifications
- [ ] Add email analytics and tracking
- [ ] Support for email attachments
- [ ] Template versioning
- [ ] A/B testing for email templates
- [ ] Webhook callbacks for delivery status
