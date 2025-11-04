import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import AuthPlaceholder from './pages/AuthPlaceholder';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPlaceholder />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </AppLayout>
  );
}
