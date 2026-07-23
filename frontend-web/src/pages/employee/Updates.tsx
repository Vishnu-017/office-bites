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

const PRIORITY_META: Record<string, { color: string; icon: string }> = {
  high: { color: 'var(--color-error)', icon: '🔴' },
  medium: { color: 'var(--color-warning)', icon: '🟡' },
  low: { color: 'var(--color-info)', icon: '🔵' },
};

function priorityMeta(priority: string) {
  return PRIORITY_META[priority] || { color: 'var(--color-on-surface-secondary)', icon: '⚪' };
}

const tabs = [
  { path: '/employee/menu', label: 'Menu', icon: '🍽️' },
  { path: '/employee/orders', label: 'Orders', icon: '📋' },
  { path: '/employee/updates', label: 'Updates', icon: '📢' },
  { path: '/employee/polls', label: 'Polls', icon: '🗳️' },
  { path: '/employee/profile', label: 'Profile', icon: '👤' },
];

export default function EmployeeUpdates() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

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
        <h2 className="page-title">Updates &amp; Announcements</h2>

        {error && <div className="error-banner">{error}</div>}

        {updates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📢</div>
            <h3>No updates yet</h3>
            <p>Check back later for announcements</p>
          </div>
        ) : (
          <div className="updates-list">
            {updates.map(update => {
              const expanded = expandedId === update.id;
              const pm = priorityMeta(update.priority);
              return (
                <div key={update.id} className={`update-row ${update.pinned ? 'pinned' : ''}`}>
                  <button className="update-row-head" onClick={() => setExpandedId(expanded ? null : update.id)}>
                    <span className="update-row-icon">{pm.icon}</span>
                    <span className="update-row-main">
                      <span className="update-row-title">
                        {update.pinned && <span className="pin-dot">📌</span>}
                        {update.title}
                      </span>
                      <span className="update-row-time">{formatISTDateTime(update.created_at)}</span>
                    </span>
                    <span className="update-row-chevron">{expanded ? '▲' : '▼'}</span>
                  </button>
                  {expanded && (
                    <div className="update-row-body">
                      <p>{update.body}</p>
                      <span className="priority-badge" style={{ color: pm.color }}>{pm.icon} {update.priority}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
