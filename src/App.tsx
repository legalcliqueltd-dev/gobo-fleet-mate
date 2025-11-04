import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import UpdatePassword from './pages/auth/UpdatePassword';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes without layout */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<Signup />} />
        <Route path="/auth/forgot" element={<ForgotPassword />} />
        <Route path="/auth/update-password" element={<UpdatePassword />} />

        {/* Routes with layout */}
        <Route path="/" element={<AppLayout><Landing /></AppLayout>} />
        <Route 
          path="/dashboard" 
          element={
            <AppLayout>
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </AppLayout>
          } 
        />
      </Routes>
    </AuthProvider>
  );
}
