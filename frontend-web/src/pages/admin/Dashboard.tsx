import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall, wsUrl } from '../../api/client';
import { formatISTDate, todayISTDateString } from '../../utils/datetime';
import './admin.css';

interface Summary {
  orders_today: number;
  total_users: number;
  top_items: { name: string; quantity: number }[];
}

interface PollTrend {
  date: string;
  lunch: Record<string, number>;
  snacks: Record<string, number>;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((s, c) => s + c, 0);
}

const API = import.meta.env.VITE_API_URL || '';

const tabs = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/menu', label: 'Menu', icon: '🍽️' },
  { path: '/admin/updates', label: 'Updates', icon: '📢' },
  { path: '/admin/polls', label: 'Polls', icon: '🗳️' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/profile', label: 'Profile', icon: '👤' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [polls, setPolls] = useState<PollTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [s, p] = await Promise.all([
        apiCall<Summary>('/api/analytics/summary', user.token),
        apiCall<{ trend: PollTrend[] }>('/api/analytics/polls', user.token),
      ]);
      setData(s);
      setPolls(p.trend);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl(user.token));
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'poll_vote' || m.type === 'order_new' || m.type === 'order_update' || m.type === 'order_history_cleared') load();
        } catch { /* ignore */ }
      };
    } catch { /* ignore */ }
    return () => { try { ws?.close(); } catch { /* ignore */ } };
  }, [user, load]);

  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const exportCsv = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/api/analytics/export`, { headers: { Authorization: `Bearer ${user.token}` } });
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${todayISTDateString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('CSV downloaded');
      setTimeout(() => setMsg(''), 2500);
    } catch {
      setError('Export failed');
    }
  };

  const clearOrderHistory = async () => {
    if (!user) return;
    const confirmed = window.confirm('This will permanently delete all order history for everyone. Continue?');
    if (!confirmed) return;

    setError('');
    setMsg('');
    try {
      await apiCall('/api/orders/history', user.token, { method: 'DELETE' });
      await load();
      setMsg('All previous order history has been cleared');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const todayPoll = polls[0] || { lunch: {}, snacks: {}, date: '' };

  return (
    <Layout tabs={tabs}>
      <div className="container admin-page">
        <div className="admin-header">
          <div>
            <h2>Reports &amp; Analytics</h2>
            <p className="admin-subtitle">Live overview</p>
          </div>
          <div className="admin-header-btns">
            <button className="btn btn-secondary" onClick={exportCsv}>⬇️ Export CSV</button>
            <button className="btn btn-danger" onClick={clearOrderHistory}>🗑️ Clear Order History</button>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {msg && <div className="success-banner">{msg}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        ) : data && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-icon">🧾</div>
                <div className="kpi-value">{data.orders_today}</div>
                <div className="kpi-label">Orders Today</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon">👥</div>
                <div className="kpi-value">{data.total_users}</div>
                <div className="kpi-label">Total Users</div>
              </div>
            </div>

            <div className="admin-card">
              <h3>Today's Poll Response</h3>
              <div className="poll-tally-row" style={{ flexWrap: 'wrap' }}>
                <div className="poll-cell">
                  <div className="poll-cell-kind">🍛 LUNCH</div>
                  {Object.keys(todayPoll.lunch).length === 0 ? (
                    <div className="admin-subtitle">No votes yet</div>
                  ) : Object.entries(todayPoll.lunch).map(([opt, count]) => (
                    <div key={opt}>{opt}: <span className="poll-cell-num yes">{count}</span></div>
                  ))}
                </div>
                <div className="poll-cell">
                  <div className="poll-cell-kind">☕ SNACKS</div>
                  {Object.keys(todayPoll.snacks).length === 0 ? (
                    <div className="admin-subtitle">No votes yet</div>
                  ) : Object.entries(todayPoll.snacks).map(([opt, count]) => (
                    <div key={opt}>{opt}: <span className="poll-cell-num yes">{count}</span></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3>Most Ordered Items</h3>
              {data.top_items.length === 0 ? (
                <p className="empty-state">No orders yet</p>
              ) : data.top_items.map((it, i) => (
                <div key={it.name} className="top-item-row">
                  <div className="top-rank">{i + 1}</div>
                  <div className="top-item-name">{it.name}</div>
                  <div className="top-item-qty">{it.quantity} orders</div>
                </div>
              ))}
            </div>

            <div className="admin-card">
              <h3>Poll Participation History</h3>
              {polls.length === 0 ? (
                <p className="empty-state">No poll responses yet</p>
              ) : polls.map(p => (
                <div key={p.date} className="trend-row">
                  <div className="trend-date">{formatISTDate(p.date)}</div>
                  <div className="trend-stat">🍛 {sumCounts(p.lunch)} votes</div>
                  <div className="trend-stat">☕ {sumCounts(p.snacks)} votes</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
