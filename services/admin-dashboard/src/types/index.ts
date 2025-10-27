export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'deactivated' | 'deleted';
  email_verified: boolean;
  created_at: string;
  last_login_at?: string;
  roles: Role[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface Session {
  id: string;
  user_id: string;
  device_info: string;
  ip_address: string;
  location?: string;
  last_activity_at: string;
  created_at: string;
  is_current: boolean;
}

export interface Metrics {
  totalUsers: number;
  activeSessions: number;
  failedLogins24h: number;
  revenue: {
    mtd: number;
    ytd: number;
  };
}

export interface UserGrowth {
  date: string;
  count: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  resource: string;
  resource_id?: string;
  changes?: any;
  timestamp: string;
  ip_address: string;
  user_agent: string;
}

export interface SystemSettings {
  [category: string]: {
    [key: string]: {
      value: any;
      description: string;
    };
  };
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
}
