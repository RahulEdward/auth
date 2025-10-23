-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  phone_number VARCHAR(20),
  phone_verified BOOLEAN DEFAULT FALSE,
  bio TEXT,
  preferences JSONB DEFAULT '{"language": "en", "timezone": "UTC", "notifications": {"email": true, "sms": false, "push": false}}'::jsonb,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_method VARCHAR(20),
  mfa_secret TEXT,
  backup_codes TEXT[],
  security_questions JSONB,
  password_history TEXT[],
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'deleted')),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE users IS 'Main users table storing user accounts and authentication data';
COMMENT ON COLUMN users.password_hash IS 'Argon2id hashed password, NULL for OAuth-only users';
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret for MFA';
COMMENT ON COLUMN users.backup_codes IS 'Array of hashed backup codes for MFA recovery';
COMMENT ON COLUMN users.password_history IS 'Array of last 5 password hashes to prevent reuse';
