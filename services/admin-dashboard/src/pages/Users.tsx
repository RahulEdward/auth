import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUsers, updateUserStatus, deleteUser } from '../api/admin';
import type { User } from '../types';
import './Users.css';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadUsers();
  }, [page, search, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setUsers(response.users);
      setTotalPages(response.pagination.totalPages);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    if (!confirm(`Are you sure you want to ${newStatus} this user?`)) return;
    
    try {
      await updateUserStatus(userId, newStatus);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update user status');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
      await deleteUser(userId);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      inactive: 'badge-warning',
      deactivated: 'badge-danger',
      deleted: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  return (
    <div className="users-page">
      <div className="page-header">
        <h2>User Management</h2>
      </div>

      <div className="card">
        <div className="filters">
          <input
            type="text"
            className="input search-input"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.name || '-'}</td>
                    <td>
                      <span className={getStatusBadge(user.status)}>{user.status}</span>
                    </td>
                    <td>{user.email_verified ? '✓' : '✗'}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <Link to={`/users/${user.id}`} className="btn-link">
                          View
                        </Link>
                        {user.status === 'active' && (
                          <button
                            onClick={() => handleStatusChange(user.id, 'deactivated')}
                            className="btn-link danger"
                          >
                            Deactivate
                          </button>
                        )}
                        {user.status === 'deactivated' && (
                          <button
                            onClick={() => handleStatusChange(user.id, 'active')}
                            className="btn-link success"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="btn-link danger"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
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
