import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../api/client';
import './admin.css';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  available: boolean;
}

const emptyForm = { name: '', description: '', image_url: '', category: 'Breakfast' };

const tabs = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/menu', label: 'Menu', icon: '🍽️' },
  { path: '/admin/updates', label: 'Updates', icon: '📢' },
  { path: '/admin/polls', label: 'Polls', icon: '🗳️' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/profile', label: 'Profile', icon: '👤' },
];

export default function AdminMenu() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<MenuItem | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiCall<MenuItem[]>('/api/menu', user.token);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(emptyForm); setModal('new'); };
  const openEdit = (item: MenuItem) => {
    setForm({ name: item.name, description: item.description, image_url: item.image_url, category: item.category });
    setModal(item);
  };

  const save = async () => {
    if (!user) return;
    const payload = {
      name: form.name,
      description: form.description,
      image_url: form.image_url,
      category: form.category,
    };
    try {
      if (modal === 'new') {
        await apiCall('/api/menu', user.token, { method: 'POST', body: JSON.stringify({ ...payload, available: true }) });
      } else if (modal) {
        await apiCall(`/api/menu/${modal.id}`, user.token, { method: 'PUT', body: JSON.stringify(payload) });
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const del = async (item: MenuItem) => {
    if (!user) return;
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await apiCall(`/api/menu/${item.id}`, user.token, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleAvail = async (item: MenuItem) => {
    if (!user) return;
    try {
      await apiCall(`/api/menu/${item.id}`, user.token, { method: 'PUT', body: JSON.stringify({ available: !item.available }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Layout tabs={tabs}>
      <div className="container admin-page">
        <div className="admin-header">
          <h2>Menu Items</h2>
          <button className="btn btn-primary" onClick={openNew}>+ Add Item</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍽️</div>
            <p>No menu items yet. Add the first one.</p>
          </div>
        ) : items.map(item => (
          <div key={item.id} className="item-row">
            {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />}
            <div className="item-row-main">
              <div className="item-row-name">{item.name}</div>
              <div className="item-row-meta">{item.category}</div>
            </div>
            <span className={`badge ${item.available ? 'badge-on' : 'badge-off'}`} style={{ cursor: 'pointer' }} onClick={() => toggleAvail(item)}>
              {item.available ? 'ON' : 'OFF'}
            </span>
            <button className="icon-btn" onClick={() => openEdit(item)} title="Edit">✏️</button>
            <button className="icon-btn danger" onClick={() => del(item)} title="Delete">🗑️</button>
          </div>
        ))}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'new' ? 'Add Menu Item' : 'Edit Menu Item'}</h3>
            <div className="form-group">
              <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <input className="input" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <input className="input" placeholder="Image URL" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />
            </div>
            <div className="form-group">
              <input className="input" placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
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
