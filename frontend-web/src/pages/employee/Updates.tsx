import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../api/client';
import { formatISTDateTime } from '../../utils/datetime';
import './Updates.css';

interface Update {
  id: string;
  title: string;
  body: string;
  priority: string;
  pinned: boolean;
  created_at: string;
}

export default function EmployeeUpdates() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    try {
      const data = await apiCall<Update[]>('/api/updates', user?.token || null);
      setUpdates(data.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'var(--color-error)';
      case 'medium': return 'var(--color-warning)';
      case 'low': return 'var(--color-info)';
      default: return 'var(--color-on-surface-secondary)';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  const tabs = [
    { path: '/employee/menu', label: 'Menu', icon: '🍽️' },
    { path: '/employee/orders', label: 'Orders', icon: '📋' },
    { path: '/employee/updates', label: 'Updates', icon: '📢' },
    { path: '/employee/polls', label: 'Polls', icon: '🗳️' },
    { path: '/employee/profile', label: 'Profile', icon: '👤' },
  ];

  if (loading) {
    return (
      <Layout tabs={tabs}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout tabs={tabs}>
      <div className="container updates-page">
        <h2 className="page-title">Updates & Announcements</h2>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        {updates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📢</div>
            <h3>No updates yet</h3>
            <p>Check back later for announcements</p>
          </div>
        ) : (
          <div className="updates-list">
            {updates.map(update => (
              <div key={update.id} className={`update-card ${update.pinned ? 'pinned' : ''}`}>
                {update.pinned && (
                  <div className="pinned-badge">📌 Pinned</div>
                )}
                
                <div className="update-header">
                  <h3 className="update-title">{update.title}</h3>
                  <span 
                    className="priority-badge"
                    style={{ color: getPriorityColor(update.priority) }}
                  >
                    {getPriorityIcon(update.priority)} {update.priority}
                  </span>
                </div>

                <p className="update-body">{update.body}</p>

                <p className="update-time">{formatISTDateTime(update.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
