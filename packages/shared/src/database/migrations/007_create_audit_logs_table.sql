-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID,
  changes JSONB,
  ip_address INET NOT NULL,
  user_agent TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

-- Create partitioning by month (for scalability)
-- This is optional but recommended for high-volume audit logs
-- Uncomment if you want monthly partitions:
-- CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Add comments
COMMENT ON TABLE audit_logs IS 'Audit trail for all system actions and changes';
COMMENT ON COLUMN audit_logs.changes IS 'JSON containing before/after values for updates';
COMMENT ON COLUMN audit_logs.user_id IS 'NULL for system-initiated actions';
