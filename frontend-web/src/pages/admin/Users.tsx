import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../api/client';
import './admin.css';

interface User {
  id: string;
  employee_id: string;
  name: string;
  email?: string;
  role: string;
  active: boolean;
}

const emptyForm = { employee_id: '', name: '', email: '', password: '', role: 'employee', active: true };

const tabs = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/menu', label: 'Menu', icon: '🍽️' },
  { path: '/admin/updates', label: 'Updates', icon: '📢' },
  { path: '/admin/polls', label: 'Polls', icon: '🗳️' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/profile', label: 'Profile', icon: '👤' },
];

const roleBadge = (r: string) => r === 'admin' ? 'badge-admin' : r === 'cook' ? 'badge-cook' : 'badge-employee';

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'new' | User | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setUsers(await apiCall<User[]>('/api/users', user.token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(emptyForm); setModal('new'); };
  const openEdit = (u: User) => { setForm({ employee_id: u.employee_id, name: u.name, email: u.email || '', password: '', role: u.role, active: u.active }); setModal(u); };

  const save = async () => {
    if (!user) return;
    try {
      if (modal === 'new') {
        await apiCall('/api/users', user.token, { method: 'POST', body: JSON.stringify(form) });
      } else if (modal) {
        const upd: Record<string, unknown> = { name: form.name, email: form.email || null, role: form.role, active: form.active };
        if (form.password) upd.password = form.password;
        await apiCall(`/api/users/${modal.employee_id}`, user.token, { method: 'PUT', body: JSON.stringify(upd) });
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const del = async (u: User) => {
    if (!user) return;
    if (!confirm(`Delete user "${u.name}"?`)) return;
    try {
      await apiCall(`/api/users/${u.employee_id}`, user.token, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Layout tabs={tabs}>
      <div className="container admin-page">
        <div className="admin-header">
          <h2>Users</h2>
          <button className="btn btn-primary" onClick={openNew}>+ Add</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        ) : users.map(u => (
          <div key={u.id} className="item-row">
            <span className={`badge ${roleBadge(u.role)}`}>{u.role.slice(0, 1).toUpperCase()}</span>
            <div className="item-row-main">
              <div className="item-row-name">{u.name}</div>
              <div className="item-row-meta">{u.employee_id} · {u.role}{u.active ? '' : ' · (disabled)'}</div>
            </div>
            <button className="icon-btn" onClick={() => openEdit(u)} title="Edit">✏️</button>
            {u.employee_id !== user?.employee_id && (
              <button className="icon-btn danger" onClick={() => del(u)} title="Delete">🗑️</button>
            )}
          </div>
        ))}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'new' ? 'Add User' : 'Edit User'}</h3>
            {modal === 'new' && (
              <div className="form-group">
                <input className="input" placeholder="Employee ID" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <input className="input" placeholder="Email (optional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <input className="input" type="password" placeholder={modal === 'new' ? 'Password' : 'New password (leave blank to keep)'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <div className="pill-row">
                {['employee', 'cook', 'admin'].map(r => (
                  <button key={r} className={`pill ${form.role === r ? 'active' : ''}`} onClick={() => setForm({ ...form, role: r })}>{r}</button>
                ))}
              </div>
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
