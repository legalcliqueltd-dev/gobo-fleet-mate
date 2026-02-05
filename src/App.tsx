import { Route, Routes, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import DriverProtectedRoute from './components/DriverProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { DriverSessionProvider } from './contexts/DriverSessionContext';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import UpdatePassword from './pages/auth/UpdatePassword';
import AddDevice from './pages/devices/AddDevice';
import EditDevice from './pages/devices/EditDevice';
import DeviceDetails from './pages/devices/DeviceDetails';
import DriverDetails from './pages/DriverDetails';
import FleetAnalytics from './pages/FleetAnalytics';
import Geofences from './pages/Geofences';
import Trips from './pages/Trips';
import Settings from './pages/Settings';
import Status from './pages/Status';
import Driver from './pages/Driver';
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverTasks from './pages/driver/DriverTasks';
import DriverSettings from './pages/driver/DriverSettings';
import CompleteTask from './pages/driver/CompleteTask';
import ConnectDevice from './pages/driver/ConnectDevice';
import Incidents from './pages/ops/Incidents';
import OpsTasks from './pages/ops/OpsTasks';
import AdminDashboard from './pages/admin/AdminDashboard';
import DriversManagement from './pages/admin/DriversManagement';
import CreateTask from './pages/admin/CreateTask';
import LocationSimulator from './pages/app/LocationSimulator';
import TempShare from './pages/TempShare';
import TempTracking from './pages/TempTracking';
import BackgroundPathsDemo from './pages/BackgroundPathsDemo';
import HeroGeometricDemo from './pages/HeroGeometricDemo';
import PulseBeamsDemo from './pages/PulseBeamsDemo';
import Header3Demo from './pages/Header3Demo';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { ThemeProvider } from './contexts/ThemeContext';

// Driver App (Mobile-only pages) - No email/password required
import DriverApp from './pages/app/DriverApp';
import DriverAppConnect from './pages/app/DriverAppConnect';
import DriverAppDashboard from './pages/app/DriverAppDashboard';
import DriverAppTasks from './pages/app/DriverAppTasks';
import DriverAppCompleteTask from './pages/app/DriverAppCompleteTask';
import DriverAppSOS from './pages/app/DriverAppSOS';
import DriverAppSettings from './pages/app/DriverAppSettings';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Driver App Routes (Mobile-only, code-based auth - no email required) */}
          <Route path="/app/*" element={
            <DriverSessionProvider>
              <Routes>
                <Route path="/" element={<DriverApp />} />
                <Route path="/connect" element={<DriverAppConnect />} />
                <Route path="/dashboard" element={
                  <DriverProtectedRoute>
                    <DriverAppDashboard />
                  </DriverProtectedRoute>
                } />
                <Route path="/tasks" element={
                  <DriverProtectedRoute>
                    <DriverAppTasks />
                  </DriverProtectedRoute>
                } />
                <Route path="/tasks/:taskId/complete" element={
                  <DriverProtectedRoute>
                    <DriverAppCompleteTask />
                  </DriverProtectedRoute>
                } />
                <Route path="/sos" element={
                  <DriverProtectedRoute>
                    <DriverAppSOS />
                  </DriverProtectedRoute>
                } />
                <Route path="/settings" element={
                  <DriverProtectedRoute>
                    <DriverAppSettings />
                  </DriverProtectedRoute>
                } />
              </Routes>
            </DriverSessionProvider>
          } />

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
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
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
                  path="/driver/:driverId"
                  element={
                    <ProtectedRoute>
                      <DriverDetails />
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
                  path="/temp-tracking"
                  element={
                    <ProtectedRoute>
                      <TempTracking />
                    </ProtectedRoute>
                  }
                />
                {/* Driver Routes */}
                <Route
                  path="/driver"
                  element={
                    <ProtectedRoute>
                      <DriverDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/driver/connect"
                  element={
                    <ProtectedRoute>
                      <ConnectDevice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/driver/dashboard"
                  element={
                    <ProtectedRoute>
                      <DriverDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/driver/sos"
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
                  path="/driver/settings"
                  element={
                    <ProtectedRoute>
                      <DriverSettings />
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
                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/drivers"
                  element={
                    <ProtectedRoute>
                      <DriversManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/tasks/new"
                  element={
                    <ProtectedRoute>
                      <CreateTask />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/tasks"
                  element={
                    <ProtectedRoute>
                      <OpsTasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sos"
                  element={
                    <ProtectedRoute>
                      <Incidents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sos/:id"
                  element={
                    <ProtectedRoute>
                      <Incidents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/simulator"
                  element={
                    <ProtectedRoute>
                      <LocationSimulator />
                    </ProtectedRoute>
                  }
                />
                
                {/* Legacy Operations Routes */}
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
