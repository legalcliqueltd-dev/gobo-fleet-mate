import { useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppRoleProvider } from '@/contexts/AppRoleContext';
import { DriverSessionProvider } from '@/contexts/DriverSessionContext';
import DriverProtectedRoute from '@/components/DriverProtectedRoute';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import AdminAppLayout from '@/components/layout/AdminAppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { registerAuthDeepLinkHandler } from '@/services/adminAuth';

import AppEntry from '@/pages/app/AppEntry';
import RoleSelect from '@/pages/app/RoleSelect';

import DriverApp from '@/pages/app/DriverApp';
import DriverAppConnect from '@/pages/app/DriverAppConnect';
import DriverAppDashboard from '@/pages/app/DriverAppDashboard';
import DriverAppTasks from '@/pages/app/DriverAppTasks';
import DriverAppCompleteTask from '@/pages/app/DriverAppCompleteTask';
import DriverAppSOS from '@/pages/app/DriverAppSOS';
import DriverAppSettings from '@/pages/app/DriverAppSettings';

import AdminEntry from '@/pages/app/admin/AdminEntry';
import AdminLogin from '@/pages/app/admin/AdminLogin';
import AdminSignup from '@/pages/app/admin/AdminSignup';
import AdminForgotPassword from '@/pages/app/admin/AdminForgotPassword';
import AdminAppFleet from '@/pages/app/admin/AdminAppFleet';
import AdminAppDriverDetail from '@/pages/app/admin/AdminAppDriverDetail';
import AdminAppCreateJob from '@/pages/app/admin/AdminAppCreateJob';
import AdminAppAddDriver from '@/pages/app/admin/AdminAppAddDriver';
import AdminAppStations from '@/pages/app/admin/AdminAppStations';
import AdminAppStationDetail from '@/pages/app/admin/AdminAppStationDetail';
import AdminAppTasks from '@/pages/app/admin/AdminAppTasks';
import AdminAppAlerts from '@/pages/app/admin/AdminAppAlerts';
import AdminAppInsights from '@/pages/app/admin/AdminAppInsights';
import AdminAppSettings from '@/pages/app/admin/AdminAppSettings';

import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import DeleteAccount from '@/pages/DeleteAccount';

/**
 * Native-only app entry. Built into the iOS and Android Capacitor bundles.
 *
 * Ships BOTH faces of the product behind a one-time mode picker:
 *
 *   /app/driver/* — code-based driver session, no email required.
 *   /app/admin/*  — manager portal on the same Supabase identities as the
 *                   website (email, Google, or Apple sign-in).
 *
 * What is still deliberately absent is every purchase surface: Landing,
 * Pricing, PaymentWall, PaymentModal, LockedFeature and the Stripe / Paystack
 * checkout paths are not imported anywhere in this tree, so Rollup keeps them
 * out of the native bundle. That is what lets the iOS build rely on App Store
 * guideline 3.1.3(f) — a free companion to a paid web tool with no in-app
 * calls to action to subscribe. Admin screens here must therefore never import
 * LockedFeature (it pulls in PaymentWall); gate on data, not on paywalls.
 *
 * Account deletion is routed in-app because the portal can create accounts
 * (App Store guideline 5.1.1(v)).
 */
export default function NativeApp() {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      // Capacitor plugin errors reach here as objects whose `message` is
      // non-enumerable, so the console bridge serialises them to bare
      // {"code":"UNIMPLEMENTED"} — which hides *which* plugin failed. Pull the
      // useful fields out by hand so the log names the culprit.
      const reason = event.reason as
        | { message?: string; code?: string; stack?: string }
        | undefined;
      console.error(
        'Unhandled rejection:',
        reason?.message ?? String(reason),
        reason?.code ? `[code: ${reason.code}]` : '',
        reason?.stack ?? ''
      );
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  // Completes browser-based Google / Apple sign-in when the OS reopens the
  // app on the fleettrackmate:// callback.
  useEffect(() => registerAuthDeepLinkHandler(), []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoleProvider>
          <ErrorBoundary>
            <Routes>
              {/* Shared legal + account pages, linked from both settings screens */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/delete-account" element={<DeleteAccount />} />

              {/* Cold start → remembered mode, or the picker on first launch */}
              <Route path="/app" element={<AppEntry />} />
              <Route path="/app/role" element={<RoleSelect />} />

              {/* ── Driver ── */}
              <Route
                path="/app/*"
                element={
                  <DriverSessionProvider>
                    <Routes>
                      <Route path="driver" element={<DriverApp />} />
                      <Route path="connect" element={<DriverAppConnect />} />
                      <Route
                        path="dashboard"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppDashboard />
                          </DriverProtectedRoute>
                        }
                      />
                      <Route
                        path="tasks"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppTasks />
                          </DriverProtectedRoute>
                        }
                      />
                      <Route
                        path="tasks/:taskId/complete"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppCompleteTask />
                          </DriverProtectedRoute>
                        }
                      />
                      <Route
                        path="sos"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppSOS />
                          </DriverProtectedRoute>
                        }
                      />
                      <Route
                        path="settings"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppSettings />
                          </DriverProtectedRoute>
                        }
                      />

                      {/* ── Manager ── */}
                      <Route path="admin" element={<AdminEntry />} />
                      <Route path="admin/login" element={<AdminLogin />} />
                      <Route path="admin/signup" element={<AdminSignup />} />
                      <Route path="admin/forgot" element={<AdminForgotPassword />} />
                      <Route
                        path="admin/*"
                        element={
                          <AdminProtectedRoute>
                            <AdminAppLayout>
                              <Routes>
                                <Route path="fleet" element={<AdminAppFleet />} />
                                <Route path="drivers/new" element={<AdminAppAddDriver />} />
                                <Route path="drivers/:driverId" element={<AdminAppDriverDetail />} />
                                <Route path="jobs/new" element={<AdminAppCreateJob />} />
                                <Route path="stations" element={<AdminAppStations />} />
                                <Route path="stations/:stationId" element={<AdminAppStationDetail />} />
                                <Route path="tasks" element={<AdminAppTasks />} />
                                <Route path="alerts" element={<AdminAppAlerts />} />
                                <Route path="insights" element={<AdminAppInsights />} />
                                <Route path="settings" element={<AdminAppSettings />} />
                                <Route path="*" element={<Navigate to="/app/admin/fleet" replace />} />
                              </Routes>
                            </AdminAppLayout>
                          </AdminProtectedRoute>
                        }
                      />

                      <Route path="*" element={<Navigate to="/app" replace />} />
                    </Routes>
                  </DriverSessionProvider>
                }
              />

              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </ErrorBoundary>

          {/* Toasts are used by the manager screens for save / error feedback */}
          <Toaster position="top-center" richColors closeButton />
        </AppRoleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
