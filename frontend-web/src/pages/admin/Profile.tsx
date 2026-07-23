import Layout from '../../components/Layout';

export default function AdminProfile() {
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
      <div className="container" style={{ padding: 'var(--spacing-lg)' }}>
        <h2>Admin Profile</h2>
        <p>Admin Profile - Coming soon</p>
      </div>
    </Layout>
  );
}
