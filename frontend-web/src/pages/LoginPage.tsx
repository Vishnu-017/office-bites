import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter both Employee ID and password');
      return;
    }

    setLoading(true);
    try {
      const user = await login(employeeId.trim(), password);
      
      if (user.role === 'employee') {
        navigate('/employee/menu');
      } else if (user.role === 'cook') {
        navigate('/cook/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (id: string, pw: string) => {
    setEmployeeId(id);
    setPassword(pw);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo-section">
          <div className="login-logo">🍽️</div>
          <h1 className="login-title">OfficeBites</h1>
          <p className="login-subtitle">Order your breakfast, before the day begins.</p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="employeeId" className="form-label">Employee ID or Email</label>
            <input
              id="employeeId"
              type="text"
              className="input"
              placeholder="e.g. EMP001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? <div className="spinner"></div> : 'Sign In'}
          </button>
        </form>

        <div className="demo-accounts">
          <p className="demo-title">Demo Accounts</p>
          <button onClick={() => quickFill('EMP001', 'emp123')} className="demo-btn">
            <span>👤</span>
            <span>Employee · EMP001 / emp123</span>
          </button>
          <button onClick={() => quickFill('cook', 'cook123')} className="demo-btn">
            <span>👨‍🍳</span>
            <span>Cook · cook / cook123</span>
          </button>
          <button onClick={() => quickFill('admin', 'admin123')} className="demo-btn">
            <span>🛡️</span>
            <span>Admin · admin / admin123</span>
          </button>
        </div>
      </div>
    </div>
  );
}
