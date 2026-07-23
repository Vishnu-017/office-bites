import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../api/client';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string;
  available: boolean;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

export default function EmployeeMenu() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMenu();
    loadCart();
  }, []);

  const loadMenu = async () => {
    try {
      const data = await apiCall<MenuItem[]>('/api/menu', user?.token || null);
      setMenuItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      setCart(JSON.parse(saved));
    }
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const addToCart = (item: MenuItem) => {
    const existing = cart.find(c => c.item.id === item.id);
    
    if (existing) {
      if (existing.quantity >= 3) {
        alert('Maximum order limit for this item is 3');
        return;
      }
      saveCart(cart.map(c => 
        c.item.id === item.id 
          ? { ...c, quantity: c.quantity + 1 }
          : c
      ));
    } else {
      saveCart([...cart, { item, quantity: 1 }]);
    }
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

  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

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
      <div className="container" style={{ padding: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h2 style={{ fontSize: 'var(--font-2xl)', fontWeight: '700' }}>Today's Menu</h2>
          {cartItemCount > 0 && (
            <a 
              href="/employee/cart" 
              className="btn btn-primary"
              style={{ position: 'relative' }}
            >
              🛒 Cart ({cartItemCount})
            </a>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-lg)' }}>
          {menuItems.map(item => {
            const inCart = cart.find(c => c.item.id === item.id);
            
            return (
              <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', opacity: item.available ? 1 : 0.6 }}>
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-md)' }}
                  />
                )}
                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: '700', marginBottom: 'var(--spacing-xs)' }}>
                  {item.name}
                </h3>
                <p style={{ color: 'var(--color-on-surface-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--spacing-sm)', flex: 1 }}>
                  {item.description}
                </p>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    backgroundColor: 'var(--color-brand-light)',
                    color: 'var(--color-brand)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: '600',
                  }}>
                    {item.category}
                  </span>
                  {!item.available && (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: 'var(--color-surface-tertiary)',
                      color: 'var(--color-on-surface-secondary)',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: '600',
                    }}>
                      Unavailable today
                    </span>
                  )}
                </div>

                {!item.available ? (
                  <button className="btn btn-secondary" disabled style={{ width: '100%' }}>Unavailable</button>
                ) : inCart ? (
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => updateQuantity(item.id, -1)}
                      style={{ flex: 1 }}
                    >
                      −
                    </button>
                    <span style={{ fontSize: 'var(--font-lg)', fontWeight: '700', minWidth: '40px', textAlign: 'center' }}>
                      {inCart.quantity}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => updateQuantity(item.id, 1)}
                      disabled={inCart.quantity >= 3}
                      style={{ flex: 1 }}
                    >
                      +
                    </button>
                    <button
                      className="btn"
                      onClick={() => removeFromCart(item.id)}
                      style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                    >
                      🗑️
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => addToCart(item)}
                    style={{ width: '100%' }}
                  >
                    Add to Cart
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
