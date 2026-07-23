import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../api/client';
import { formatISTDateTime } from '../../utils/datetime';
import './admin.css';

interface UpdateItem {
  id: string;
  title: string;
  body: string;
  priority: string;
  pinned: boolean;
  created_at: string;
}

const emptyForm = { title: '', body: '', priority: 'normal', pinned: false };

const tabs = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/menu', label: 'Menu', icon: '🍽️' },
  { path: '/admin/updates', label: 'Updates', icon: '📢' },
  { path: '/admin/polls', label: 'Polls', icon: '🗳️' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/profile', label: 'Profile', icon: '👤' },
];

export default function AdminUpdates() {
  const { user } = useAuth();
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'new' | UpdateItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setItems(await apiCall<UpdateItem[]>('/api/updates', user.token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(emptyForm); setModal('new'); };
  const openEdit = (u: UpdateItem) => { setForm({ title: u.title, body: u.body, priority: u.priority, pinned: u.pinned }); setModal(u); };

  const save = async () => {
    if (!user || !form.title || !form.body) return;
    try {
      if (modal === 'new') {
        await apiCall('/api/updates', user.token, { method: 'POST', body: JSON.stringify(form) });
      } else if (modal) {
        await apiCall(`/api/updates/${modal.id}`, user.token, { method: 'PUT', body: JSON.stringify(form) });
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const del = async (u: UpdateItem) => {
    if (!user) return;
    if (!confirm(`Delete "${u.title}"?`)) return;
    try {
      await apiCall(`/api/updates/${u.id}`, user.token, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const togglePin = async (u: UpdateItem) => {
    if (!user) return;
    try {
      await apiCall(`/api/updates/${u.id}`, user.token, { method: 'PUT', body: JSON.stringify({ pinned: !u.pinned }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Layout tabs={tabs}>
      <div className="container admin-page">
        <div className="admin-header">
          <h2>Updates</h2>
          <button className="btn btn-primary" onClick={openNew}>+ New</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📢</div>
            <p>No updates yet. Post the first announcement.</p>
          </div>
        ) : items.map(u => {
          const expanded = expandedId === u.id;
          return (
            <div key={u.id} className={`admin-card ${u.pinned ? 'pinned-card' : ''}`} style={{ paddingBottom: expanded ? undefined : 'var(--spacing-md)' }}>
              <button
                onClick={() => setExpandedId(expanded ? null : u.id)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <h3 style={{ marginBottom: 0, flex: 1 }}>{u.pinned ? '📌 ' : ''}{u.title}</h3>
                  {u.priority === 'high' && <span className="badge badge-high">HIGH</span>}
                  <span className="admin-subtitle">{expanded ? '▲' : '▼'}</span>
                </div>
                <p className="admin-subtitle" style={{ marginTop: 4 }}>{formatISTDateTime(u.created_at)}</p>
              </button>
              {expanded && (
                <>
                  <p style={{ marginTop: 8, color: 'var(--color-on-surface-secondary)' }}>{u.body}</p>
                  <div className="list-actions">
                    <button className="link-action" onClick={() => togglePin(u)}>{u.pinned ? '📌 Unpin' : '📌 Pin'}</button>
                    <button className="link-action" onClick={() => openEdit(u)}>✏️ Edit</button>
                    <button className="link-action danger" onClick={() => del(u)}>🗑️ Delete</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'new' ? 'New Update' : 'Edit Update'}</h3>
            <div className="form-group">
              <input className="input" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <textarea className="input" placeholder="Message" rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
            </div>
            <div className="form-row">
              <span className="form-label" style={{ margin: 0 }}>Priority</span>
              <div className="pill-row">
                {['normal', 'high'].map(p => (
                  <button key={p} className={`pill ${form.priority === p ? 'active' : ''}`} onClick={() => setForm({ ...form, priority: p })}>{p}</button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <span className="form-label" style={{ margin: 0 }}>Pin to top</span>
              <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
