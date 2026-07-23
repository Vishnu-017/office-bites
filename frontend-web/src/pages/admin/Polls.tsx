import Layout from '../../components/Layout';
import './Dashboard.css';

export default function AdminPolls() {
  const tabs = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/menu', label: 'Menu', icon: '🍽️' },
    { path: '/admin/updates', label: 'Updates', icon: '📢' },
    { path: '/admin/polls', label: 'Polls', icon: '🗳️' },
    { path: '/admin/users', label: 'Users', icon: '👥' },
    { path: '/admin/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <Layout tabs={tabs}>
      <div className="container admin-page">
        <h2 className="page-title">Admin Polls</h2>
        <p>Polls management - Coming soon in next iteration</p>
      </div>
    </Layout>
  );
}
