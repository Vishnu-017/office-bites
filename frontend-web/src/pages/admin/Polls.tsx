import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall, wsUrl } from '../../api/client';
import { formatISTDate, formatISTDateTime, todayISTDateString } from '../../utils/datetime';
import './admin.css';

interface Poll {
  id: string;
  kind: string;
  title: string;
  description: string;
  date: string;
  closes_at: string;
  active: boolean;
  options: string[];
  option_counts?: Record<string, number>;
}

interface Vote { employee_id: string; employee_name: string; response: string; voted_at: string; }
interface ResponsesData { options: string[]; counts: Record<string, number>; responses: Record<string, Vote[]>; }

const todayStr = todayISTDateString;
const defaultCloseLocal = () => `${todayStr()}T11:00`;

// Interpret a "YYYY-MM-DDTHH:mm" string as IST wall-clock time and produce a UTC ISO string.
function istLocalToIso(localValue: string): string {
  const [datePart, timePart] = localValue.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, mi] = (timePart || '00:00').split(':').map(Number);
  const utcMs = Date.UTC(y, (m || 1) - 1, d || 1, h, mi) - (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs).toISOString();
}

// Convert a UTC ISO string to a "YYYY-MM-DDTHH:mm" value representing IST wall-clock time.
function isoToIstLocal(iso: string): string {
  try {
    const d = new Date(iso);
    const parts = d.toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).replace(',', '');
    const [dp, tp] = parts.split(' ');
    const [dd, mm, yy] = dp.split('/');
    return `${yy}-${mm}-${dd}T${tp}`;
  } catch {
    return defaultCloseLocal();
  }
}

const tabs = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/menu', label: 'Menu', icon: '🍽️' },
  { path: '/admin/updates', label: 'Updates', icon: '📢' },
  { path: '/admin/polls', label: 'Polls', icon: '🗳️' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/profile', label: 'Profile', icon: '👤' },
];

const emptyForm = { kind: 'lunch', title: '', description: '', date: todayStr(), closesLocal: defaultCloseLocal(), active: true, options: ['yes', 'no'] };

export default function AdminPolls() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'new' | Poll | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [responsesModal, setResponsesModal] = useState<Poll | null>(null);
  const [responses, setResponses] = useState<ResponsesData>({ options: [], counts: {}, responses: {} });

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setPolls(await apiCall<Poll[]>('/api/polls', user.token));
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
      ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'poll_vote') load(); } catch { /* ignore */ } };
    } catch { /* ignore */ }
    return () => { try { ws?.close(); } catch { /* ignore */ } };
  }, [user, load]);

  useEffect(() => { const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const openNew = (kind: string) => {
    // Lunch polls auto-generate daily — if today's already exists (of either kind), edit it instead of hitting the duplicate-poll error.
    const existingToday = polls.find(p => p.kind === kind && p.date === todayStr());
    if (existingToday) {
      openEdit(existingToday);
      return;
    }
    setForm({ ...emptyForm, kind, options: kind === 'lunch' ? ['Yes, I need lunch', 'No lunch (WFO)'] : ['yes', 'no'] });
    setModal('new');
  };
  const openEdit = (p: Poll) => {
    setForm({ kind: p.kind, title: p.title, description: p.description, date: p.date, closesLocal: isoToIstLocal(p.closes_at), active: p.active, options: [...p.options] });
    setModal(p);
  };

  const setOption = (idx: number, value: string) => {
    setForm(f => ({ ...f, options: f.options.map((o, i) => i === idx ? value : o) }));
  };
  const addOption = () => setForm(f => ({ ...f, options: [...f.options, ''] }));
  const removeOption = (idx: number) => setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!user) return;
    const options = form.options.map(o => o.trim()).filter(Boolean);
    if (options.length < 2) {
      setError('A poll needs at least 2 options');
      return;
    }
    const closes_at = istLocalToIso(form.closesLocal);
    try {
      if (modal === 'new') {
        await apiCall('/api/polls', user.token, {
          method: 'POST',
          body: JSON.stringify({ kind: form.kind, title: form.title, description: form.description, date: form.date, closes_at, active: form.active, options }),
        });
      } else if (modal) {
        await apiCall(`/api/polls/${modal.id}`, user.token, {
          method: 'PUT',
          body: JSON.stringify({ title: form.title, description: form.description, date: form.date, closes_at, active: form.active, options }),
        });
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const del = async (p: Poll) => {
    if (!user) return;
    if (!confirm(`Delete "${p.title}"?`)) return;
    try {
      await apiCall(`/api/polls/${p.id}`, user.token, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openResponses = async (p: Poll) => {
    if (!user) return;
    try {
      const data = await apiCall<ResponsesData>(`/api/polls/${p.id}/responses`, user.token);
      setResponses(data);
      setResponsesModal(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Layout tabs={tabs}>
      <div className="container admin-page">
        <div className="admin-header">
          <h2>Food Poll Management</h2>
          <div className="admin-header-btns">
            <button className="btn btn-primary" onClick={() => openNew('lunch')}>+ Lunch</button>
            <button className="btn btn-primary" onClick={() => openNew('snacks')}>+ Snacks</button>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        ) : polls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗳️</div>
            <p>No polls yet. Create today's Lunch &amp; Snacks polls above (Lunch auto-generates on weekdays).</p>
          </div>
        ) : polls.map(p => {
          const counts = p.option_counts || {};
          const total = Object.values(counts).reduce((s, c) => s + c, 0);
          return (
            <div key={p.id} className="admin-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="badge badge-admin">{p.kind.toUpperCase()}</span>
                <span className="admin-subtitle">{formatISTDate(p.date)}</span>
                {!p.active && <span className="badge badge-inactive">INACTIVE</span>}
              </div>
              <h3 style={{ marginBottom: 4 }}>{p.title}</h3>
              {p.description && <p className="admin-subtitle" style={{ marginBottom: 4 }}>{p.description}</p>}
              <p className="admin-subtitle">Closes: {formatISTDateTime(p.closes_at)}</p>
              <div className="poll-tally-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                {p.options.map(opt => (
                  <div className="poll-cell" style={{ textAlign: 'center', minWidth: 90 }} key={opt}>
                    <div className="poll-cell-num">{counts[opt] || 0}</div>
                    <div className="admin-subtitle">{opt}</div>
                  </div>
                ))}
                <div className="poll-cell" style={{ textAlign: 'center', minWidth: 90 }}>
                  <div className="poll-cell-num">{total}</div>
                  <div className="admin-subtitle">Total</div>
                </div>
              </div>
              <div className="list-actions">
                <button className="link-action" onClick={() => openResponses(p)}>👥 Responses</button>
                <button className="link-action" onClick={() => openEdit(p)}>✏️ Edit</button>
                <button className="link-action danger" onClick={() => del(p)}>🗑️ Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'new' ? `New ${form.kind} Poll` : 'Edit Poll'}</h3>
            <div className="form-group">
              <input className="input" placeholder="Title (e.g. Today's Lunch)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <input className="input" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Poll date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Closes at (IST)</label>
              <input className="input" type="datetime-local" value={form.closesLocal} onChange={e => setForm({ ...form, closesLocal: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Options</label>
              {form.options.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="input" placeholder={`Option ${idx + 1}`} value={opt} onChange={e => setOption(idx, e.target.value)} />
                  {form.options.length > 2 && (
                    <button className="icon-btn danger" onClick={() => removeOption(idx)} title="Remove option">✕</button>
                  )}
                </div>
              ))}
              <button className="link-action" onClick={addOption}>+ Add option</button>
            </div>
            <div className="form-row">
              <span className="form-label" style={{ margin: 0 }}>Active</span>
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {responsesModal !== null && (
        <div className="modal-overlay" onClick={() => setResponsesModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{responsesModal.title}</h3>
            <div className="responses-list">
              {responses.options.map(opt => (
                <div key={opt}>
                  <h4>{opt} ({responses.counts[opt] || 0})</h4>
                  {(responses.responses[opt] || []).map((r, i) => <div key={i} className="resp-row">{r.employee_name} · {r.employee_id}</div>)}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setResponsesModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
