import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall, wsUrl } from '../../api/client';
import { formatISTTime } from '../../utils/datetime';
import './Polls.css';

interface Poll {
  id: string;
  kind: string;
  title: string;
  description: string;
  date: string;
  closes_at: string;
  active: boolean;
  options: string[];
}

interface PollWithVote {
  poll: Poll;
  my_vote: string | null;
  option_counts: Record<string, number>;
}

interface Voter { employee_id: string; employee_name: string; response: string; voted_at: string; }
interface ResponsesData { options: string[]; counts: Record<string, number>; responses: Record<string, Voter[]>; }

const tabs = [
  { path: '/employee/menu', label: 'Menu', icon: '🍽️' },
  { path: '/employee/orders', label: 'Orders', icon: '📋' },
  { path: '/employee/updates', label: 'Updates', icon: '📢' },
  { path: '/employee/polls', label: 'Polls', icon: '🗳️' },
  { path: '/employee/profile', label: 'Profile', icon: '👤' },
];

const KIND_META: Record<string, { label: string; icon: string; color: string }> = {
  lunch: { label: 'Lunch Poll', icon: '🍱', color: '#FF6B35' },
  snacks: { label: 'Snacks Poll', icon: '🍪', color: '#FFC107' },
};

const OPTION_ICON: Record<string, string> = {
  'yes': '👍',
  'no': '👎',
  'veg': '🥦',
  'non-veg': '🍗',
};

function optionIcon(option: string): string {
  return OPTION_ICON[option.toLowerCase()] || (option.toLowerCase().includes('no lunch') ? '🚫' : '🍽️');
}

function isClosed(p: Poll): boolean {
  if (!p.active) return true;
  try {
    return new Date() > new Date(p.closes_at);
  } catch {
    return false;
  }
}

export default function EmployeePolls() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PollWithVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [votingPoll, setVotingPoll] = useState<string | null>(null);
  const [responsesCache, setResponsesCache] = useState<Record<string, ResponsesData>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loadingVoters, setLoadingVoters] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiCall<PollWithVote[]>('/api/polls/today', user.token);
      setEntries(data);
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
          if (m.type === 'poll_vote' || m.type === 'notification') load();
        } catch { /* ignore */ }
      };
    } catch { /* ignore */ }
    return () => { try { ws?.close(); } catch { /* ignore */ } };
  }, [user, load]);

  useEffect(() => { const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const vote = async (pollId: string, response: string) => {
    setVotingPoll(pollId);
    setError('');
    try {
      await apiCall(`/api/polls/${pollId}/vote`, user?.token || null, {
        method: 'POST',
        body: JSON.stringify({ response }),
      });
      await load();
      setResponsesCache(c => { const next = { ...c }; delete next[pollId]; return next; });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVotingPoll(null);
    }
  };

  const toggleVoters = async (pollId: string, option: string) => {
    const key = `${pollId}:${option}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (!responsesCache[pollId]) {
      setLoadingVoters(pollId);
      try {
        const data = await apiCall<ResponsesData>(`/api/polls/${pollId}/responses`, user?.token || null);
        setResponsesCache(c => ({ ...c, [pollId]: data }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingVoters(null);
      }
    }
  };

  const lunch = entries.find(e => e.poll.kind === 'lunch');
  const snacks = entries.find(e => e.poll.kind === 'snacks');

  if (loading) {
    return (
      <Layout tabs={tabs}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner"></div>
        </div>
      </Layout>
    );
  }

  const renderPoll = (kind: string, entry?: PollWithVote) => {
    const meta = KIND_META[kind];
    if (!entry) {
      return (
        <div className="poll-card inactive" key={kind}>
          <div className="poll-header">
            <div className="poll-kind" style={{ backgroundColor: meta.color }}>{meta.icon} {meta.label}</div>
          </div>
          <p className="poll-description">No poll available for today.</p>
        </div>
      );
    }

    const { poll, my_vote, option_counts } = entry;
    const closed = isClosed(poll);
    const total = Object.values(option_counts).reduce((s, c) => s + c, 0);
    const cached = responsesCache[poll.id];

    return (
      <div key={poll.id} className={`poll-card ${closed ? 'inactive' : ''}`}>
        <div className="poll-header">
          <div className="poll-kind" style={{ backgroundColor: meta.color }}>{meta.icon} {meta.label}</div>
          {closed && <span className="poll-status">Closed</span>}
        </div>

        <h3 className="poll-title">{poll.title}</h3>
        {poll.description && <p className="poll-description">{poll.description}</p>}
        <p className="poll-date">⏰ Closes at {formatISTTime(poll.closes_at)} IST</p>

        <div className="poll-results">
          {poll.options.map(opt => {
            const count = option_counts[opt] || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const selected = my_vote === opt;
            const key = `${poll.id}:${opt}`;
            const expanded = expandedKey === key;
            const voterNames = cached?.responses[opt] || [];
            return (
              <div className="result-bar" key={opt}>
                <div className="result-label">
                  <span>{optionIcon(opt)} {opt}{selected ? ' (your vote)' : ''}</span>
                  <button className="result-count-btn" onClick={() => toggleVoters(poll.id, opt)}>
                    {count} {expanded ? '▲' : '▼'}
                  </button>
                </div>
                <div className="result-progress">
                  <div className={`result-fill ${selected ? 'yes' : 'no'}`} style={{ width: `${pct}%` }} />
                </div>
                {expanded && (
                  <div className="voters-inline">
                    {loadingVoters === poll.id ? (
                      <div className="spinner" style={{ margin: '8px auto' }}></div>
                    ) : voterNames.length === 0 ? (
                      <div className="voter-empty">No one yet</div>
                    ) : voterNames.map((v, i) => (
                      <div key={i} className="voter-row">👤 {v.employee_name}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {my_vote && (
          <div className="voted-badge" style={{ marginTop: 'var(--spacing-md)' }}>
            ✅ You voted: <strong>{my_vote}</strong>
          </div>
        )}

        {!closed && (
          <div className="poll-actions" style={{ marginTop: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            {poll.options.map(opt => (
              <button
                key={opt}
                className={`btn vote-btn ${my_vote === opt ? 'yes' : 'no'}`}
                onClick={() => vote(poll.id, opt)}
                disabled={votingPoll === poll.id}
                style={{ flex: '1 1 45%', minWidth: 140 }}
              >
                {votingPoll === poll.id ? <div className="spinner"></div> : `${optionIcon(opt)} ${opt}${my_vote === opt ? ' ✓' : ''}`}
              </button>
            ))}
          </div>
        )}
        {my_vote && !closed && (
          <p className="poll-date" style={{ marginTop: 'var(--spacing-sm)', marginBottom: 0 }}>You can change your response until the poll closes.</p>
        )}
      </div>
    );
  };

  return (
    <Layout tabs={tabs}>
      <div className="container polls-page">
        <h2 className="page-title">Food Polls</h2>
        {error && <div className="error-banner">{error}</div>}
        <div className="polls-list">
          {renderPoll('lunch', lunch)}
          {renderPoll('snacks', snacks)}
        </div>
      </div>
    </Layout>
  );
}
