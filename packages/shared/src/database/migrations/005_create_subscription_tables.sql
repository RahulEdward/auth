-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  interval VARCHAR(20) NOT NULL CHECK (interval IN ('month', 'year')),
  interval_count INTEGER DEFAULT 1,
  features JSONB DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{"apiCalls": 1000, "storage": 1073741824, "users": 1}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  payment_method_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create usage_records table
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  metric VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_usage_user_metric ON usage_records(user_id, metric, timestamp);
CREATE INDEX idx_usage_subscription ON usage_records(subscription_id);

-- Create triggers
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price, interval, features, limits) VALUES
  ('Free', 'Free tier for testing', 0.00, 'month', 
   '{"mfa": false, "oauth": true, "support": "community"}'::jsonb,
   '{"apiCalls": 1000, "storage": 104857600, "users": 1}'::jsonb),
  ('Starter', 'Perfect for small projects', 29.00, 'month',
   '{"mfa": true, "oauth": true, "support": "email"}'::jsonb,
   '{"apiCalls": 10000, "storage": 1073741824, "users": 5}'::jsonb),
  ('Professional', 'For growing businesses', 99.00, 'month',
   '{"mfa": true, "oauth": true, "rbac": true, "support": "priority"}'::jsonb,
   '{"apiCalls": 100000, "storage": 10737418240, "users": 50}'::jsonb),
  ('Enterprise', 'Custom enterprise solution', 499.00, 'month',
   '{"mfa": true, "oauth": true, "rbac": true, "sso": true, "support": "dedicated"}'::jsonb,
   '{"apiCalls": -1, "storage": -1, "users": -1}'::jsonb)
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE subscription_plans IS 'Available subscription tiers with pricing and limits';
COMMENT ON TABLE subscriptions IS 'User subscriptions with billing periods';
COMMENT ON TABLE usage_records IS 'Usage tracking for quota enforcement';
COMMENT ON COLUMN subscription_plans.limits IS 'JSON with apiCalls, storage (bytes), users limits (-1 = unlimited)';
