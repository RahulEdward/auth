import { useEffect, useState } from 'react';
import { getAuditLogs, exportAuditLogs } from '../api/admin';
import type { AuditLog } from '../types';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, resourceFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await getAuditLogs({
        page,
        limit: 50,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
      });
      setLogs(response.logs);
      setTotalPages(response.pagination.totalPages);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportAuditLogs({ format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to export audit logs');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Audit Logs</h2>
        <div>
          <button onClick={() => handleExport('csv')} className="btn btn-secondary" style={{ marginRight: '8px' }}>
            Export CSV
          </button>
          <button onClick={() => handleExport('json')} className="btn btn-secondary">
            Export JSON
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <input
            type="text"
            className="input"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Filter by resource..."
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="loading">Loading audit logs...</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>{log.user_email}</td>
                    <td><span className="badge badge-info">{log.action}</span></td>
                    <td>{log.resource}</td>
                    <td>{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <button
                className="btn btn-secondary"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
