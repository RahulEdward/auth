-- Initialize database with extensions and basic setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema for audit logs (optional, for organization)
CREATE SCHEMA IF NOT EXISTS audit;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE authdb TO authuser;
GRANT ALL PRIVILEGES ON SCHEMA public TO authuser;
GRANT ALL PRIVILEGES ON SCHEMA audit TO authuser;

-- Set timezone
SET timezone = 'UTC';
