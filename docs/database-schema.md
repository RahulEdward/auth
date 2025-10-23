# Database Schema Documentation

## Overview

The authentication system uses PostgreSQL 15+ with the following extensions:
- `uuid-ossp` - UUID generation
- `pgcrypto` - Encryption functions

## Tables

### users
Main user accounts table storing authentication and profile data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique email address |
| email_verified | BOOLEAN | Email verification status |
| password_hash | VARCHAR(255) | Argon2id hashed password (NULL for OAuth-only) |
| name | VARCHAR(255) | User's display name |
| avatar_url | TEXT | URL to user's avatar image |
| phone_number | VARCHAR(20) | Phone number for SMS MFA |
| phone_verified | BOOLEAN | Phone verification status |
| bio | TEXT | User biography |
| preferences | JSONB | User preferences (language, timezone, notifications) |
| mfa_enabled | BOOLEAN | MFA enabled flag |
| mfa_method | VARCHAR(20) | MFA method (totp, sms, email) |
| mfa_secret | TEXT | Encrypted TOTP secret |
| backup_codes | TEXT[] | Array of hashed backup codes |
| security_questions | JSONB | Security questions for account recovery |
| password_history | TEXT[] | Last 5 password hashes |
| status | VARCHAR(20) | Account status (active, deactivated, deleted) |
| deleted_at | TIMESTAMP | Soft delete timestamp |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_users_email` on email
- `idx_users_status` on status
- `idx_users_created_at` on created_at
- `idx_users_deleted_at` on deleted_at (partial)

### oauth_accounts
OAuth provider accounts linked to users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| provider | VARCHAR(50) | OAuth provider (google, facebook, github) |
| provider_account_id | VARCHAR(255) | Provider's user ID |
| access_token | TEXT | Encrypted OAuth access token |
| refresh_token | TEXT | Encrypted OAuth refresh token |
| expires_at | TIMESTAMP | Token expiration |
| scope | TEXT | OAuth scopes granted |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_oauth_user_id` on user_id
- `idx_oauth_provider` on (provider, provider_account_id)

**Constraints:**
- Unique constraint on (provider, provider_account_id)

### sessions
User sessions with device tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| token_hash | VARCHAR(255) | Hashed refresh token |
| device_info | JSONB | Device details (browser, OS, etc.) |
| ip_address | INET | IP address |
| location | JSONB | Geolocation data |
| created_at | TIMESTAMP | Session creation |
| last_activity_at | TIMESTAMP | Last activity timestamp |
| expires_at | TIMESTAMP | Session expiration |

**Indexes:**
- `idx_sessions_user_id` on user_id
- `idx_sessions_token_hash` on token_hash
- `idx_sessions_expires_at` on expires_at
- `idx_sessions_last_activity` on last_activity_at

### roles
RBAC roles with hierarchical inheritance.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Unique role name |
| description | TEXT | Role description |
| parent_role_id | UUID | Parent role for inheritance |
| permissions | TEXT[] | Array of permission strings |
| is_system | BOOLEAN | System role flag (cannot be deleted) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Default Roles:**
- `admin` - Full system access
- `user` - Standard user access
- `premium` - Premium user with extended features

**Indexes:**
- `idx_roles_name` on name
- `idx_roles_parent` on parent_role_id

### user_roles
Junction table linking users to roles.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | Foreign key to users |
| role_id | UUID | Foreign key to roles |
| assigned_at | TIMESTAMP | Assignment timestamp |
| assigned_by | UUID | User who assigned the role |

**Indexes:**
- `idx_user_roles_user` on user_id
- `idx_user_roles_role` on role_id

### subscription_plans
Available subscription tiers.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Plan name |
| description | TEXT | Plan description |
| price | DECIMAL(10,2) | Price amount |
| currency | VARCHAR(3) | Currency code (USD) |
| interval | VARCHAR(20) | Billing interval (month, year) |
| interval_count | INTEGER | Interval multiplier |
| features | JSONB | Feature flags |
| limits | JSONB | Usage limits (apiCalls, storage, users) |
| is_active | BOOLEAN | Active status |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Default Plans:**
- Free (0.00/month)
- Starter (29.00/month)
- Professional (99.00/month)
- Enterprise (499.00/month)

### subscriptions
User subscriptions with billing periods.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| plan_id | UUID | Foreign key to subscription_plans |
| status | VARCHAR(20) | Subscription status |
| current_period_start | TIMESTAMP | Current billing period start |
| current_period_end | TIMESTAMP | Current billing period end |
| cancel_at_period_end | BOOLEAN | Cancel flag |
| canceled_at | TIMESTAMP | Cancellation timestamp |
| trial_start | TIMESTAMP | Trial period start |
| trial_end | TIMESTAMP | Trial period end |
| payment_method_id | UUID | Default payment method |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_subscriptions_user` on user_id
- `idx_subscriptions_status` on status
- `idx_subscriptions_period_end` on current_period_end

### usage_records
Usage tracking for quota enforcement.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| subscription_id | UUID | Foreign key to subscriptions |
| metric | VARCHAR(50) | Metric name (apiCalls, storage) |
| quantity | INTEGER | Usage amount |
| timestamp | TIMESTAMP | Record timestamp |

**Indexes:**
- `idx_usage_user_metric` on (user_id, metric, timestamp)
- `idx_usage_subscription` on subscription_id

### payment_methods
Tokenized payment methods.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| type | VARCHAR(20) | Payment type (card, bank_account) |
| processor_id | VARCHAR(255) | Payment processor token ID |
| last4 | VARCHAR(4) | Last 4 digits |
| brand | VARCHAR(50) | Card brand (Visa, Mastercard) |
| expiry_month | INTEGER | Card expiry month |
| expiry_year | INTEGER | Card expiry year |
| is_default | BOOLEAN | Default payment method flag |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_payment_methods_user` on user_id

### invoices
Billing invoices.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| subscription_id | UUID | Foreign key to subscriptions |
| number | VARCHAR(50) | Unique invoice number |
| amount | DECIMAL(10,2) | Invoice amount |
| currency | VARCHAR(3) | Currency code |
| status | VARCHAR(20) | Invoice status |
| description | TEXT | Invoice description |
| due_date | TIMESTAMP | Payment due date |
| paid_at | TIMESTAMP | Payment timestamp |
| attempt_count | INTEGER | Payment attempt counter |
| next_attempt_at | TIMESTAMP | Next retry timestamp |
| pdf_url | TEXT | PDF invoice URL |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_invoices_user` on user_id
- `idx_invoices_status` on status
- `idx_invoices_due_date` on due_date
- `idx_invoices_number` on number

### payments
Payment transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| invoice_id | UUID | Foreign key to invoices |
| user_id | UUID | Foreign key to users |
| amount | DECIMAL(10,2) | Payment amount |
| currency | VARCHAR(3) | Currency code |
| status | VARCHAR(20) | Payment status |
| payment_method_id | UUID | Payment method used |
| processor_payment_id | VARCHAR(255) | Processor transaction ID |
| failure_reason | TEXT | Failure reason if failed |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_payments_invoice` on invoice_id
- `idx_payments_user` on user_id
- `idx_payments_status` on status

### audit_logs
Audit trail for all system actions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users (NULL for system) |
| action | VARCHAR(100) | Action performed |
| resource | VARCHAR(100) | Resource type |
| resource_id | UUID | Resource ID |
| changes | JSONB | Before/after values |
| ip_address | INET | IP address |
| user_agent | TEXT | User agent string |
| status | VARCHAR(20) | Action status (success, failure) |
| error_message | TEXT | Error message if failed |
| timestamp | TIMESTAMP | Action timestamp |

**Indexes:**
- `idx_audit_logs_user` on user_id
- `idx_audit_logs_resource` on (resource, resource_id)
- `idx_audit_logs_timestamp` on timestamp
- `idx_audit_logs_action` on action
- `idx_audit_logs_status` on status

## Migrations

Migrations are stored in `packages/shared/src/database/migrations/` and executed in order:

1. `001_create_users_table.sql` - Users table
2. `002_create_oauth_accounts_table.sql` - OAuth accounts
3. `003_create_sessions_table.sql` - Sessions
4. `004_create_roles_tables.sql` - Roles and user_roles
5. `005_create_subscription_tables.sql` - Subscription plans and subscriptions
6. `006_create_payment_tables.sql` - Payment methods, invoices, payments
7. `007_create_audit_logs_table.sql` - Audit logs

Run migrations with:
```bash
npm run db:migrate
```

## Seeding

Test data includes:
- 3 test users (admin, user, premium)
- Default roles (admin, user, premium)
- Default subscription plans
- Sample subscription for premium user

Run seeds with:
```bash
npm run db:seed
```
