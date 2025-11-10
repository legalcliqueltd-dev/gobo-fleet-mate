import { Route, Routes, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import UpdatePassword from './pages/auth/UpdatePassword';
import AddDevice from './pages/devices/AddDevice';
import EditDevice from './pages/devices/EditDevice';
import DeviceDetails from './pages/devices/DeviceDetails';
import FleetAnalytics from './pages/FleetAnalytics';
import Geofences from './pages/Geofences';
import Trips from './pages/Trips';
import Settings from './pages/Settings';
import Status from './pages/Status';
import Driver from './pages/Driver';
import DriverTasks from './pages/driver/DriverTasks';
import CompleteTask from './pages/driver/CompleteTask';
import Incidents from './pages/ops/Incidents';
import OpsTasks from './pages/ops/OpsTasks';
import TempShare from './pages/TempShare';
import BackgroundPathsDemo from './pages/BackgroundPathsDemo';
import HeroGeometricDemo from './pages/HeroGeometricDemo';
import PulseBeamsDemo from './pages/PulseBeamsDemo';
import Header3Demo from './pages/Header3Demo';
import { ThemeProvider } from './contexts/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public share route without layout */}
          <Route path="/share/:token" element={<TempShare />} />
          
          {/* All other routes with AppLayout */}
          <Route path="/*" element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/demo/background-paths" element={<BackgroundPathsDemo />} />
                <Route path="/demo/hero-geometric" element={<HeroGeometricDemo />} />
                <Route path="/demo/pulse-beams" element={<PulseBeamsDemo />} />
                <Route path="/demo/header-3" element={<Header3Demo />} />
                <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/signup" element={<Signup />} />
                <Route path="/auth/forgot" element={<ForgotPassword />} />
                <Route path="/auth/update-password" element={<UpdatePassword />} />
                <Route path="/status" element={<Status />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <FleetAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/geofences"
                  element={
                    <ProtectedRoute>
                      <Geofences />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trips"
                  element={
                    <ProtectedRoute>
                      <Trips />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/devices/new"
                  element={
                    <ProtectedRoute>
                      <AddDevice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/devices/:id"
                  element={
                    <ProtectedRoute>
                      <DeviceDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/devices/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditDevice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/driver"
                  element={
                    <ProtectedRoute>
                      <Driver />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/driver/tasks"
                  element={
                    <ProtectedRoute>
                      <DriverTasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks/:taskId/complete"
                  element={
                    <ProtectedRoute>
                      <CompleteTask />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ops/incidents"
                  element={
                    <ProtectedRoute>
                      <Incidents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ops/tasks"
                  element={
                    <ProtectedRoute>
                      <OpsTasks />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
