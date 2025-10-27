import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Admin Dashboard</h2>
        </div>
        <nav className="sidebar-nav">
          <Link to="/" className="nav-item">
            <span>📊</span> Dashboard
          </Link>
          <Link to="/users" className="nav-item">
            <span>👥</span> Users
          </Link>
          <Link to="/audit-logs" className="nav-item">
            <span>📝</span> Audit Logs
          </Link>
          <Link to="/settings" className="nav-item">
            <span>⚙️</span> Settings
          </Link>
        </nav>
      </aside>
      <div className="main-content">
        <header className="header">
          <div className="header-content">
            <h1>Enterprise Auth System</h1>
            <div className="user-menu">
              <span className="user-name">{user?.name || user?.email}</span>
              <button onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
