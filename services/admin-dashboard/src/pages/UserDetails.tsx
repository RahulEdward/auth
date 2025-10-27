import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserDetails, impersonateUser, assignRole, removeRole, getRoles } from '../api/admin';
import type { User, Role } from '../types';

export default function UserDetails() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUserDetails();
    loadRoles();
  }, [userId]);

  const loadUserDetails = async () => {
    try {
      const data = await getUserDetails(userId!);
      setUser(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data.roles);
    } catch (err) {
      console.error('Failed to load roles', err);
    }
  };

  const handleImpersonate = async () => {
    if (!confirm('Are you sure you want to impersonate this user?')) return;
    
    try {
      const response = await impersonateUser(userId!);
      alert(`Impersonation token generated. Token: ${response.token.substring(0, 20)}...`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to impersonate user');
    }
  };

  if (loading) return <div className="loading">Loading user details...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/users')} className="btn btn-secondary">
        ← Back to Users
      </button>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2>User Details</h2>
        
        <div style={{ marginTop: '20px' }}>
          <p><strong>ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Name:</strong> {user.name || '-'}</p>
          <p><strong>Status:</strong> <span className={`badge badge-${user.status === 'active' ? 'success' : 'danger'}`}>{user.status}</span></p>
          <p><strong>Email Verified:</strong> {user.email_verified ? 'Yes' : 'No'}</p>
          <p><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</p>
          <p><strong>Last Login:</strong> {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3>Roles</h3>
          {user.roles && user.roles.length > 0 ? (
            <div>
              {user.roles.map((role) => (
                <span key={role.id} className="badge badge-info" style={{ marginRight: '8px' }}>
                  {role.name}
                </span>
              ))}
            </div>
          ) : (
            <p>No roles assigned</p>
          )}
        </div>

        <div style={{ marginTop: '24px' }}>
          <button onClick={handleImpersonate} className="btn btn-primary">
            Impersonate User
          </button>
        </div>
      </div>
    </div>
  );
}
