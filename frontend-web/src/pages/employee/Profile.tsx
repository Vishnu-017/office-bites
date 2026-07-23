import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import './Profile.css';

export default function EmployeeProfile() {
  const { user, logout } = useAuth();

  const tabs = [
    { path: '/employee/menu', label: 'Menu', icon: '🍽️' },
    { path: '/employee/orders', label: 'Orders', icon: '📋' },
    { path: '/employee/updates', label: 'Updates', icon: '📢' },
    { path: '/employee/polls', label: 'Polls', icon: '🗳️' },
    { path: '/employee/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <Layout tabs={tabs}>
      <div className="container profile-page">
        <div className="profile-card">
          <div className="profile-avatar">👤</div>
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
