import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import EmployeeMenu from './pages/employee/Menu';
import EmployeeCart from './pages/employee/Cart';
import EmployeeOrders from './pages/employee/Orders';
import EmployeeUpdates from './pages/employee/Updates';
import EmployeePolls from './pages/employee/Polls';
import EmployeeProfile from './pages/employee/Profile';
import CookDashboard from './pages/cook/Dashboard';
import CookProfile from './pages/cook/Profile';
import AdminDashboard from './pages/admin/Dashboard';
import AdminMenu from './pages/admin/Menu';
import AdminUpdates from './pages/admin/Updates';
import AdminPolls from './pages/admin/Polls';
import AdminUsers from './pages/admin/Users';
import AdminProfile from './pages/admin/Profile';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Role-based routing
  if (user.role === 'employee') {
    return (
      <Routes>
        <Route path="/employee/menu" element={<EmployeeMenu />} />
        <Route path="/employee/cart" element={<EmployeeCart />} />
        <Route path="/employee/orders" element={<EmployeeOrders />} />
        <Route path="/employee/updates" element={<EmployeeUpdates />} />
        <Route path="/employee/polls" element={<EmployeePolls />} />
        <Route path="/employee/profile" element={<EmployeeProfile />} />
        <Route path="*" element={<Navigate to="/employee/menu" replace />} />
      </Routes>
    );
  }

  if (user.role === 'cook') {
    return (
      <Routes>
        <Route path="/cook/dashboard" element={<CookDashboard />} />
        <Route path="/cook/profile" element={<CookProfile />} />
        <Route path="*" element={<Navigate to="/cook/dashboard" replace />} />
      </Routes>
    );
  }

  if (user.role === 'admin') {
    return (
      <Routes>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/menu" element={<AdminMenu />} />
        <Route path="/admin/updates" element={<AdminUpdates />} />
        <Route path="/admin/polls" element={<AdminPolls />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/profile" element={<AdminProfile />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    );
  }

  return <Navigate to="/login" replace />;
}

export default App;
