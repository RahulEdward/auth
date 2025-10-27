import { useEffect, useState } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMetrics, getUserGrowth, getAuthMethodBreakdown, getSubscriptionDistribution } from '../api/admin';
import type { Metrics, UserGrowth } from '../types';
import './Dashboard.css';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626'];

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [userGrowth, setUserGrowth] = useState<UserGrowth[]>([]);
  const [authMethods, setAuthMethods] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [metricsData, growthData, authData, subsData] = await Promise.all([
        getMetrics(),
        getUserGrowth('30d'),
        getAuthMethodBreakdown(),
        getSubscriptionDistribution(),
      ]);
      
      setMetrics(metricsData);
      setUserGrowth(growthData);
      setAuthMethods(authData);
      setSubscriptions(subsData);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="dashboard">
      <h2>Dashboard Overview</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <div className="metric-value">{metrics?.totalUsers.toLocaleString()}</div>
            <div className="metric-label">Total Users</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">🔐</div>
          <div className="metric-content">
            <div className="metric-value">{metrics?.activeSessions.toLocaleString()}</div>
            <div className="metric-label">Active Sessions</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">⚠️</div>
          <div className="metric-content">
            <div className="metric-value">{metrics?.failedLogins24h.toLocaleString()}</div>
            <div className="metric-label">Failed Logins (24h)</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-value">${metrics?.revenue.mtd.toLocaleString()}</div>
            <div className="metric-label">Revenue (MTD)</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <h3>User Growth (30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Authentication Methods</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={authMethods?.breakdown || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.method}: ${entry.count}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {(authMethods?.breakdown || []).map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
