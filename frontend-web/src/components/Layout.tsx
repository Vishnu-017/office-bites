import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
  tabs: Array<{
    path: string;
    label: string;
    icon: string;
  }>;
}

export default function Layout({ children, tabs }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="header-content">
          <div className="header-left">
            <span className="app-logo">🍽️</span>
            <h1 className="app-title">OfficeBites</h1>
          </div>
          <div className="header-right">
            <span className="user-name">{user?.name}</span>
            <button onClick={logout} className="btn-logout">Logout</button>
          </div>
        </div>
      </header>

      <main className="layout-main">
        {children}
      </main>

      <nav className="layout-nav">
        {tabs.map(tab => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`nav-tab ${location.pathname === tab.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
