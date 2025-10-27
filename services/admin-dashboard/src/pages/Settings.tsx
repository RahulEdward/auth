import { useEffect, useState } from 'react';
import { getFeatureFlags, updateFeatureFlag, getSystemHealth, clearCache } from '../api/admin';
import type { FeatureFlag } from '../types';

export default function Settings() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [flagsData, healthData] = await Promise.all([
        getFeatureFlags(),
        getSystemHealth(),
      ]);
      setFlags(flagsData);
      setHealth(healthData);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlag = async (flagName: string, enabled: boolean) => {
    try {
      await updateFeatureFlag(flagName, enabled);
      loadSettings();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update feature flag');
    }
  };

  const handleClearCache = async (cacheType: string) => {
    if (!confirm(`Are you sure you want to clear ${cacheType} cache?`)) return;
    
    try {
      await clearCache(cacheType);
      alert('Cache cleared successfully');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to clear cache');
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>System Settings</h2>

      <div className="card">
        <h3>System Health</h3>
        <div style={{ marginTop: '16px' }}>
          <p><strong>Status:</strong> <span className={`badge badge-${health?.status === 'healthy' ? 'success' : 'danger'}`}>{health?.status}</span></p>
          <p><strong>Last Check:</strong> {health?.timestamp ? new Date(health.timestamp).toLocaleString() : '-'}</p>
          
          {health?.checks && (
            <div style={{ marginTop: '16px' }}>
              <h4>Service Checks:</h4>
              {health.checks.map((check: any, index: number) => (
                <div key={index} style={{ marginTop: '8px' }}>
                  <strong>{check.service}:</strong> <span className={`badge badge-${check.status === 'healthy' ? 'success' : 'danger'}`}>{check.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Feature Flags</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Flag Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.name}>
                <td>{flag.name}</td>
                <td>{flag.description || '-'}</td>
                <td>
                  <span className={`badge badge-${flag.enabled ? 'success' : 'danger'}`}>
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleToggleFlag(flag.name, !flag.enabled)}
                    className={`btn ${flag.enabled ? 'btn-danger' : 'btn-success'}`}
                  >
                    {flag.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Cache Management</h3>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button onClick={() => handleClearCache('sessions')} className="btn btn-secondary">
            Clear Sessions Cache
          </button>
          <button onClick={() => handleClearCache('rate_limits')} className="btn btn-secondary">
            Clear Rate Limits Cache
          </button>
          <button onClick={() => handleClearCache('all')} className="btn btn-danger">
            Clear All Cache
          </button>
        </div>
      </div>
    </div>
  );
}
