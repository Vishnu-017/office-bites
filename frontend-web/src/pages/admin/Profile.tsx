import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import './admin.css';

const tabs = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/menu', label: 'Menu', icon: '🍽️' },
  { path: '/admin/updates', label: 'Updates', icon: '📢' },
  { path: '/admin/polls', label: 'Polls', icon: '🗳️' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/profile', label: 'Profile', icon: '👤' },
];

export default function AdminProfile() {
  const { user, logout } = useAuth();

  return (
    <Layout tabs={tabs}>
      <div className="container admin-page">
        <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Profile</h2>
        <div className="admin-card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: 'var(--color-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--spacing-md)',
            fontSize: 32,
          }}>🛡️</div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700 }}>{user?.name}</div>
          <div className="admin-subtitle" style={{ letterSpacing: 1 }}>ADMIN · {user?.employee_id}</div>
        </div>
        <button className="btn" style={{ width: '100%', border: '1px solid var(--color-error)', color: 'var(--color-error)', background: 'transparent' }} onClick={logout}>
          🚪 Log Out
        </button>
      </div>
    </Layout>
  );
}
