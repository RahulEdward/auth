import { apiClient } from './client';
import type { User, Metrics, UserGrowth, AuditLog, SystemSettings, FeatureFlag } from '../types';

// Auth
export const login = async (email: string, password: string) => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
};

// Users
export const getUsers = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  search?: string;
}) => {
  const response = await apiClient.get('/admin/users', { params });
  return response.data;
};

export const getUserDetails = async (userId: string) => {
  const response = await apiClient.get(`/admin/users/${userId}`);
  return response.data;
};

export const updateUserStatus = async (userId: string, status: string) => {
  const response = await apiClient.patch(`/admin/users/${userId}/status`, { status });
  return response.data;
};

export const deleteUser = async (userId: string) => {
  const response = await apiClient.delete(`/admin/users/${userId}`);
  return response.data;
};

export const impersonateUser = async (userId: string) => {
  const response = await apiClient.post(`/admin/users/${userId}/impersonate`);
  return response.data;
};

// Metrics
export const getMetrics = async (): Promise<Metrics> => {
  const response = await apiClient.get('/admin/metrics');
  return response.data;
};

export const getUserGrowth = async (period: string): Promise<UserGrowth[]> => {
  const response = await apiClient.get('/admin/metrics/user-growth', {
    params: { period },
  });
  return response.data.growth;
};

export const getAuthMethodBreakdown = async () => {
  const response = await apiClient.get('/admin/metrics/auth-methods');
  return response.data;
};

export const getSubscriptionDistribution = async () => {
  const response = await apiClient.get('/admin/metrics/subscriptions');
  return response.data;
};

export const getApiUsage = async () => {
  const response = await apiClient.get('/admin/metrics/api-usage');
  return response.data;
};

// Audit Logs
export const getAuditLogs = async (params?: {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const response = await apiClient.get('/admin/audit-logs', { params });
  return response.data;
};

export const getAuditLogDetails = async (logId: string): Promise<AuditLog> => {
  const response = await apiClient.get(`/admin/audit-logs/${logId}`);
  return response.data;
};

export const exportAuditLogs = async (params?: {
  format?: 'csv' | 'json';
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const response = await apiClient.get('/admin/audit-logs/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

export const getAuditLogStats = async (period: string) => {
  const response = await apiClient.get('/admin/audit-logs/stats', {
    params: { period },
  });
  return response.data;
};

// System Settings
export const getSystemSettings = async (): Promise<SystemSettings> => {
  const response = await apiClient.get('/admin/settings');
  return response.data;
};

export const updateSystemSettings = async (settings: SystemSettings) => {
  const response = await apiClient.put('/admin/settings', settings);
  return response.data;
};

export const getFeatureFlags = async (): Promise<FeatureFlag[]> => {
  const response = await apiClient.get('/admin/feature-flags');
  return response.data.flags;
};

export const updateFeatureFlag = async (flagName: string, enabled: boolean) => {
  const response = await apiClient.patch(`/admin/feature-flags/${flagName}`, { enabled });
  return response.data;
};

export const getSystemHealth = async () => {
  const response = await apiClient.get('/admin/health');
  return response.data;
};

export const clearCache = async (cacheType: string) => {
  const response = await apiClient.post('/admin/cache/clear', { cacheType });
  return response.data;
};

// Roles
export const getRoles = async () => {
  const response = await apiClient.get('/rbac/roles');
  return response.data;
};

export const assignRole = async (userId: string, roleId: string) => {
  const response = await apiClient.post(`/rbac/users/${userId}/roles`, { roleId });
  return response.data;
};

export const removeRole = async (userId: string, roleId: string) => {
  const response = await apiClient.delete(`/rbac/users/${userId}/roles/${roleId}`);
  return response.data;
};
