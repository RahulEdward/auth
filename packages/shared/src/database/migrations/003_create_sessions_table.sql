-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_info JSONB NOT NULL,
  ip_address INET NOT NULL,
  location JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity_at);

-- Add comments
COMMENT ON TABLE sessions IS 'User sessions with device tracking and activity logging';
COMMENT ON COLUMN sessions.token_hash IS 'Hashed refresh token for security';
COMMENT ON COLUMN sessions.device_info IS 'JSON containing browser, OS, device details';
COMMENT ON COLUMN sessions.location IS 'JSON containing geolocation data';
