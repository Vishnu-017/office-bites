import Layout from '../../components/Layout';

export default function EmployeeProfile() {
  const tabs = [
    { path: '/employee/menu', label: 'Menu', icon: '🍽️' },
    { path: '/employee/orders', label: 'Orders', icon: '📋' },
    { path: '/employee/updates', label: 'Updates', icon: '📢' },
    { path: '/employee/polls', label: 'Polls', icon: '🗳️' },
    { path: '/employee/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <Layout tabs={tabs}>
      <div className="container" style={{ padding: 'var(--spacing-lg)' }}>
        <h2>Profile</h2>
        <p>Profile page - Coming soon</p>
      </div>
    </Layout>
  );
}
