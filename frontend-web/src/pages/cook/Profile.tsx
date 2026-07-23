import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import '../employee/Profile.css';

export default function CookProfile() {
  const { user, logout } = useAuth();

  const tabs = [
    { path: '/cook/dashboard', label: 'Orders', icon: '📋' },
    { path: '/cook/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <Layout tabs={tabs}>
      <div className="container profile-page">
        <div className="profile-card">
          <div className="profile-avatar">👨‍🍳</div>
          <h2 className="profile-name">{user?.name}</h2>
          <p className="profile-id">{user?.employee_id}</p>
          <span className="profile-role">{user?.role}</span>
        </div>

        <div className="profile-actions">
          <button className="btn btn-primary" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </Layout>
  );
}
