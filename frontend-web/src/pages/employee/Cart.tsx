import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../api/client';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

export default function EmployeeCart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      setCart(JSON.parse(saved));
    }
    const savedNotes = localStorage.getItem('cart_notes');
    if (savedNotes) {
      setNotes(savedNotes);
    }
  };

  const updateNotes = (value: string) => {
    setNotes(value);
    localStorage.setItem('cart_notes', value);
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    saveCart(cart.map(c => {
      if (c.item.id === itemId) {
        const newQty = c.quantity + delta;
        if (newQty > 3) {
          alert('Maximum order limit for this item is 3');
          return c;
        }
        return { ...c, quantity: newQty };
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (itemId: string) => {
    saveCart(cart.filter(c => c.item.id !== itemId));
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const items = cart.map(c => ({
        item_id: c.item.id,
        quantity: c.quantity
      }));

      await apiCall('/api/orders', user?.token || null, {
        method: 'POST',
        body: JSON.stringify({ items, notes: notes.trim() })
      });

      localStorage.removeItem('cart');
      localStorage.removeItem('cart_notes');
      alert('Order placed successfully!');
      navigate('/employee/orders');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { path: '/employee/menu', label: 'Menu', icon: '🍽️' },
    { path: '/employee/orders', label: 'Orders', icon: '📋' },
    { path: '/employee/updates', label: 'Updates', icon: '📢' },
    { path: '/employee/polls', label: 'Polls', icon: '🗳️' },
    { path: '/employee/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <Layout tabs={tabs}>
      <div className="container" style={{ padding: 'var(--spacing-lg)', maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: 'var(--font-2xl)', fontWeight: '700', marginBottom: 'var(--spacing-lg)' }}>
          Your Cart
        </h2>

        {error && (
          <div style={{ 
            backgroundColor: '#FEE',
            color: 'var(--color-error)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-lg)',
            borderLeft: '4px solid var(--color-error)'
          }}>
            {error}
          </div>
        )}

        {cart.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
            <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-md)' }}>🛒</div>
            <h3 style={{ fontSize: 'var(--font-xl)', fontWeight: '700', marginBottom: 'var(--spacing-sm)' }}>
              Your cart is empty
            </h3>
            <p style={{ color: 'var(--color-on-surface-secondary)', marginBottom: 'var(--spacing-lg)' }}>
              Add items from the menu to get started
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/employee/menu')}
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
              {cart.map(({ item, quantity }) => (
                <div key={item.id} className="card" style={{ marginBottom: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-md)' }}>
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--spacing-xs)' }}>
                      {item.name}
                    </h3>
                    <p style={{ color: 'var(--color-on-surface-secondary)', fontSize: 'var(--font-sm)' }}>
                      {item.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => updateQuantity(item.id, -1)}
                        style={{ padding: '8px 12px' }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: 'var(--font-lg)', fontWeight: '700', minWidth: '30px', textAlign: 'center' }}>
                        {quantity}
                      </span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={quantity >= 3}
                        style={{ padding: '8px 12px' }}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="btn"
                      onClick={() => removeFromCart(item.id)}
                      style={{ backgroundColor: 'var(--color-error)', color: 'white', padding: '8px 16px' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 'var(--font-sm)', marginBottom: 'var(--spacing-sm)' }}>
                📝 Customization / Special Instructions
              </label>
              <textarea
                className="input"
                placeholder="e.g. Less spicy, no onions, extra sauce on the side..."
                rows={3}
                maxLength={300}
                value={notes}
                onChange={e => updateNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-on-surface-secondary)', marginTop: 'var(--spacing-xs)' }}>
                Visible to the cook preparing your order.
              </p>
            </div>

            <div style={{ position: 'sticky', bottom: '80px', backgroundColor: 'var(--color-surface)', padding: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-on-surface-secondary)' }}>
                    Total Items
                  </p>
                  <p style={{ fontSize: 'var(--font-2xl)', fontWeight: '700' }}>
                    {cart.reduce((sum, c) => sum + c.quantity, 0)}
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={placeOrder}
                  disabled={loading}
                  style={{ padding: '16px 32px', fontSize: 'var(--font-lg)' }}
                >
                  {loading ? <div className="spinner"></div> : 'Place Order'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
