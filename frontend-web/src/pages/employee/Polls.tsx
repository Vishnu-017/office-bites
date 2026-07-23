import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../api/client';
import { formatISTDateTime } from '../../utils/datetime';
import './Polls.css';

interface Poll {
  id: string;
  kind: string;
  title: string;
  description: string;
  date: string;
  closes_at: string;
  active: boolean;
  yes_count: number;
  no_count: number;
  user_vote?: string | null;
}

export default function EmployeePolls() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [votingPoll, setVotingPoll] = useState<string | null>(null);

  useEffect(() => {
    loadPolls();
  }, []);

  const loadPolls = async () => {
    try {
      const data = await apiCall<Poll[]>('/api/polls', user?.token || null);
      setPolls(data.sort((a, b) => {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const vote = async (pollId: string, response: 'yes' | 'no') => {
    setVotingPoll(pollId);
    setError('');
    
    try {
      await apiCall(`/api/polls/${pollId}/vote`, user?.token || null, {
        method: 'POST',
        body: JSON.stringify({ response })
      });
      
      // Reload polls to get updated counts
      await loadPolls();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVotingPoll(null);
    }
  };

  const getPollKindIcon = (kind: string) => {
    switch (kind) {
      case 'lunch': return '🍱';
      case 'snacks': return '🍪';
      default: return '🗳️';
    }
  };

  const getPollKindColor = (kind: string) => {
    switch (kind) {
      case 'lunch': return '#FF6B35';
      case 'snacks': return '#FFC107';
      default: return '#6C757D';
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
      <div className="container polls-page">
        <h2 className="page-title">Food Polls</h2>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        {polls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗳️</div>
            <h3>No polls available</h3>
            <p>Check back later for food polls</p>
          </div>
        ) : (
          <div className="polls-list">
            {polls.map(poll => (
              <div key={poll.id} className={`poll-card ${!poll.active ? 'inactive' : ''}`}>
                <div className="poll-header">
                  <div 
                    className="poll-kind"
                    style={{ backgroundColor: getPollKindColor(poll.kind) }}
                  >
                    {getPollKindIcon(poll.kind)} {poll.kind}
                  </div>
                  {!poll.active && (
                    <span className="poll-status">Closed</span>
                  )}
                </div>

                <h3 className="poll-title">{poll.title}</h3>
                <p className="poll-description">{poll.description}</p>
                <p className="poll-date">📅 {formatISTDateTime(poll.date)}</p>

                {poll.user_vote ? (
                  <div className="poll-voted">
                    <div className="voted-badge">
                      ✅ You voted: <strong>{poll.user_vote.toUpperCase()}</strong>
                    </div>
                    <div className="poll-results">
                      <div className="result-bar">
                        <div className="result-label">
                          <span>👍 Yes</span>
                          <span className="result-count">{poll.yes_count}</span>
                        </div>
                        <div className="result-progress">
                          <div 
                            className="result-fill yes"
                            style={{ 
                              width: `${poll.yes_count + poll.no_count > 0 
                                ? (poll.yes_count / (poll.yes_count + poll.no_count)) * 100 
                                : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="result-bar">
                        <div className="result-label">
                          <span>👎 No</span>
                          <span className="result-count">{poll.no_count}</span>
                        </div>
                        <div className="result-progress">
                          <div 
                            className="result-fill no"
                            style={{ 
                              width: `${poll.yes_count + poll.no_count > 0 
                                ? (poll.no_count / (poll.yes_count + poll.no_count)) * 100 
                                : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : poll.active ? (
                  <div className="poll-actions">
                    <button
                      className="btn vote-btn yes"
                      onClick={() => vote(poll.id, 'yes')}
                      disabled={votingPoll === poll.id}
                    >
                      {votingPoll === poll.id ? <div className="spinner"></div> : '👍 Yes'}
                    </button>
                    <button
                      className="btn vote-btn no"
                      onClick={() => vote(poll.id, 'no')}
                      disabled={votingPoll === poll.id}
                    >
                      {votingPoll === poll.id ? <div className="spinner"></div> : '👎 No'}
                    </button>
                  </div>
                ) : (
                  <div className="poll-closed">
                    <p>This poll is closed</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
