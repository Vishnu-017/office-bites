import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall, wsUrl } from '../../api/client';
import { formatISTTime } from '../../utils/datetime';
import './Dashboard.css';

interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  employee_id: string;
  employee_name: string;
  items: OrderItem[];
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export default function CookDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    loadOrders();
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const loadOrders = async () => {
    try {
      const data = await apiCall<Order[]>('/api/orders?scope=active', user?.token || null);
      setOrders(data.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    if (!user?.token) return;

    try {
      const websocket = new WebSocket(wsUrl(user.token));

      websocket.onopen = () => {
        console.log('WebSocket connected');
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'order_update' || data.type === 'order_new' || data.type === 'order_history_cleared') {
          loadOrders(); // Reload orders on any update
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(connectWebSocket, 3000);
      };

      setWs(websocket);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrder(orderId);
    setError('');
    
    try {
      await apiCall(`/api/orders/${orderId}/status`, user?.token || null, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdatingOrder(null);
    }
  };

  const acceptOrder = (orderId: string) => updateOrderStatus(orderId, 'preparing');
  const markAsReady = (orderId: string) => updateOrderStatus(orderId, 'completed');

  const getElapsedTime = (createdAt: string) => {
    const now = new Date().getTime();
    const created = new Date(createdAt).getTime();
    const diff = Math.floor((now - created) / 1000 / 60);
    return diff;
  };

  const getPriorityClass = (minutes: number) => {
    if (minutes >= 10) return 'high-priority';
    if (minutes >= 5) return 'medium-priority';
    return 'normal-priority';
  };

  const newOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing' || o.status === 'accepted');

  const tabs = [
    { path: '/cook/dashboard', label: 'Orders', icon: '📋' },
    { path: '/cook/profile', label: 'Profile', icon: '👤' },
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
      <div className="cook-dashboard">
        <div className="dashboard-header">
          <h2 className="dashboard-title">Kitchen Orders</h2>
          <div className="order-stats">
            <span className="stat-badge new">{newOrders.length} New</span>
            <span className="stat-badge preparing">{preparingOrders.length} Preparing</span>
          </div>
        </div>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <h3>All caught up!</h3>
            <p>No pending orders at the moment</p>
          </div>
        ) : (
          <div className="orders-sections">
            {newOrders.length > 0 && (
              <div className="order-section">
                <h3 className="section-title">🔔 New Orders ({newOrders.length})</h3>
                <div className="orders-grid">
                  {newOrders.map(order => {
                    const elapsed = getElapsedTime(order.created_at);
                    
                    return (
                      <div key={order.id} className={`cook-order-card ${getPriorityClass(elapsed)}`}>
                        <div className="order-top">
                          <div className="order-info">
                            <h4 className="customer-name">👤 {order.employee_name}</h4>
                            <p className="order-time">
                              <span className="time-label">⏱️ {elapsed} min</span>
                              <span className="time-value">{formatISTTime(order.created_at)}</span>
                            </p>
                          </div>
                          {elapsed >= 10 && (
                            <div className="priority-indicator">🔴</div>
                          )}
                          {elapsed >= 5 && elapsed < 10 && (
                            <div className="priority-indicator">🟡</div>
                          )}
                        </div>

                        <div className="order-items-list">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="order-item-row">
                              <span className="item-qty">×{item.quantity}</span>
                              <span className="item-name">{item.name}</span>
                            </div>
                          ))}
                        </div>

                        {order.notes && (
                          <div className="order-notes">
                            <strong>📝 Note:</strong>
                            <span>{order.notes}</span>
                          </div>
                        )}

                        <button
                          className="btn btn-accept"
                          onClick={() => acceptOrder(order.id)}
                          disabled={updatingOrder === order.id}
                        >
                          {updatingOrder === order.id ? <div className="spinner"></div> : '✅ Accept Order'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {preparingOrders.length > 0 && (
              <div className="order-section">
                <h3 className="section-title">👨‍🍳 Preparing ({preparingOrders.length})</h3>
                <div className="orders-grid">
                  {preparingOrders.map(order => {
                    const elapsed = getElapsedTime(order.created_at);
                    
                    return (
                      <div key={order.id} className={`cook-order-card preparing ${getPriorityClass(elapsed)}`}>
                        <div className="order-top">
                          <div className="order-info">
                            <h4 className="customer-name">👤 {order.employee_name}</h4>
                            <p className="order-time">
                              <span className="time-label">⏱️ {elapsed} min</span>
                              <span className="time-value">{formatISTTime(order.created_at)}</span>
                            </p>
                          </div>
                          {elapsed >= 10 && (
                            <div className="priority-indicator">🔴</div>
                          )}
                          {elapsed >= 5 && elapsed < 10 && (
                            <div className="priority-indicator">🟡</div>
                          )}
                        </div>

                        <div className="order-items-list">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="order-item-row">
                              <span className="item-qty">×{item.quantity}</span>
                              <span className="item-name">{item.name}</span>
                            </div>
                          ))}
                        </div>

                        {order.notes && (
                          <div className="order-notes">
                            <strong>📝 Note:</strong>
                            <span>{order.notes}</span>
                          </div>
                        )}

                        <button
                          className="btn btn-ready"
                          onClick={() => markAsReady(order.id)}
                          disabled={updatingOrder === order.id}
                        >
                          {updatingOrder === order.id ? <div className="spinner"></div> : '🎉 Mark as Ready'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
