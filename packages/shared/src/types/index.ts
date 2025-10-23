// User types
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash?: string;
  name: string;
  avatarUrl?: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  bio?: string;
  preferences: UserPreferences;
  mfaEnabled: boolean;
  mfaMethod?: 'totp' | 'sms' | 'email';
  status: 'active' | 'deactivated' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

// JWT token types
export interface JWTPayload {
  sub: string; // user id
  email: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Session types
export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  location?: GeoLocation;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

export interface DeviceInfo {
  userAgent: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  fingerprint: string;
}

export interface GeoLocation {
  country: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
}

// Role and Permission types
export interface Role {
  id: string;
  name: string;
  description: string;
  parentRoleId?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Error types
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
    timestamp: string;
  };
}

export enum ErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  INVALID_MFA_CODE = 'INVALID_MFA_CODE',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
