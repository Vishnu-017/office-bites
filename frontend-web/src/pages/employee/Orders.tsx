import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall, wsUrl } from '../../api/client';
import { formatISTDateTime } from '../../utils/datetime';
import './Orders.css';

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

export default function EmployeeOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      const data = await apiCall<Order[]>('/api/orders', user?.token || null);
      setOrders(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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
        
        if (data.type === 'order_update') {
          setOrders(prevOrders => {
            const index = prevOrders.findIndex(o => o.id === data.order.id);
            if (index >= 0) {
              const updated = [...prevOrders];
              updated[index] = data.order;
              return updated;
            } else {
              return [data.order, ...prevOrders];
            }
          });
        } else if (data.type === 'order_history_cleared') {
          setOrders([]);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      setWs(websocket);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'var(--color-warning)';
      case 'accepted':
      case 'preparing': return 'var(--color-info)';
      case 'ready': return 'var(--color-success)';
      case 'completed': return 'var(--color-on-surface-tertiary)';
      case 'cancelled': return 'var(--color-error)';
      default: return 'var(--color-on-surface-secondary)';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '⏳ Pending';
      case 'accepted': return '✅ Accepted';
      case 'preparing': return '👨‍🍳 Preparing';
      case 'ready': return '🎉 Ready for Pickup';
      case 'completed': return '✅ Completed';
      case 'cancelled': return '❌ Cancelled';
      default: return status;
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
      <div className="container orders-page">
        <h2 className="page-title">My Orders</h2>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No orders yet</h3>
            <p>Your orders will appear here once you place them</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div>
                    <h3 className="order-id">Order #{order.id.slice(0, 8)}</h3>
                    <p className="order-time">{formatISTDateTime(order.created_at)}</p>
                  </div>
                  <div 
                    className="order-status"
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {getStatusLabel(order.status)}
                  </div>
                </div>

                <div className="order-items">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      <span className="item-name">{item.name}</span>
                      <span className="item-quantity">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-on-surface-secondary)', fontStyle: 'italic', marginTop: 'var(--spacing-sm)' }}>
                    📝 {order.notes}
                  </p>
                )}

                {order.status === 'ready' && (
                  <div className="ready-alert">
                    🎉 Your order is ready for pickup!
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
