-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

-- Create indexes
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_parent ON roles(parent_role_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- Create trigger for roles table
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default system roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
  ('admin', 'System administrator with full access', ARRAY[
    'users:read', 'users:write', 'users:delete',
    'roles:read', 'roles:write', 'roles:delete',
    'subscriptions:read', 'subscriptions:write',
    'payments:read', 'system:manage'
  ], true),
  ('user', 'Standard user with basic access', ARRAY[
    'profile:read', 'profile:write',
    'sessions:read', 'sessions:manage'
  ], true),
  ('premium', 'Premium user with extended features', ARRAY[
    'profile:read', 'profile:write',
    'sessions:read', 'sessions:manage',
    'api:extended'
  ], true)
ON CONFLICT (name) DO NOTHING;

-- Add comments
COMMENT ON TABLE roles IS 'Roles for RBAC with hierarchical inheritance support';
COMMENT ON TABLE user_roles IS 'Junction table linking users to roles';
COMMENT ON COLUMN roles.permissions IS 'Array of permission strings (resource:action format)';
COMMENT ON COLUMN roles.is_system IS 'System roles cannot be deleted';
