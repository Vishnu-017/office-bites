import Layout from '../../components/Layout';

export default function CookProfile() {
  const tabs = [
    { path: '/cook/dashboard', label: 'Orders', icon: '📋' },
    { path: '/cook/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <Layout tabs={tabs}>
      <div className="container" style={{ padding: 'var(--spacing-lg)' }}>
        <h2>Cook Profile</h2>
        <p>Cook Profile - Coming soon</p>
      </div>
    </Layout>
  );
}
