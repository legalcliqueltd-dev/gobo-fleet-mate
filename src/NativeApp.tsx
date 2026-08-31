import { useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppRoleProvider } from '@/contexts/AppRoleContext';
import { DriverSessionProvider } from '@/contexts/DriverSessionContext';
import DriverProtectedRoute from '@/components/DriverProtectedRoute';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import AdminAppLayout from '@/components/layout/AdminAppLayout';
import SubscriptionGate from '@/components/admin/SubscriptionGate';
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
import DriverAppExpenses from '@/pages/app/DriverAppExpenses';
import DriverAppRecord from '@/pages/app/DriverAppRecord';
import DriverAppChecks from '@/pages/app/DriverAppChecks';

import AdminEntry from '@/pages/app/admin/AdminEntry';
import AdminLogin from '@/pages/app/admin/AdminLogin';
import AdminSignup from '@/pages/app/admin/AdminSignup';
import AdminForgotPassword from '@/pages/app/admin/AdminForgotPassword';
import AdminUpdatePassword from '@/pages/app/admin/AdminUpdatePassword';
import AdminAppFleet from '@/pages/app/admin/AdminAppFleet';
import AdminAppDriverDetail from '@/pages/app/admin/AdminAppDriverDetail';
import AdminAppDriverHistory from '@/pages/app/admin/AdminAppDriverHistory';
import AdminAppCreateJob from '@/pages/app/admin/AdminAppCreateJob';
import AdminAppAddDriver from '@/pages/app/admin/AdminAppAddDriver';
import AdminAppCodes from '@/pages/app/admin/AdminAppCodes';
import AdminAppExpenses from '@/pages/app/admin/AdminAppExpenses';
import AdminAppReports from '@/pages/app/admin/AdminAppReports';
import AdminAppDailyReport from '@/pages/app/admin/AdminAppDailyReport';
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
 * Completes the journeys that leave the app and come back through
 * `fleettrackmate://auth/callback`: Google and Apple sign-in through the
 * system browser, email confirmation, and password reset.
 *
 * It lives in its own component purely so it can call `useNavigate` — a
 * password-reset link signs the manager in silently, and without the redirect
 * below they would land on the fleet map with the password they came to
 * change still unchanged.
 */
function AuthDeepLinks() {
  const navigate = useNavigate();

  useEffect(
    () =>
      registerAuthDeepLinkHandler((kind) => {
        if (kind === 'recovery') navigate('/app/admin/reset', { replace: true });
      }),
    [navigate]
  );

  return null;
}

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

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoleProvider>
          <AuthDeepLinks />

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
                      <Route
                        path="expenses"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppExpenses />
                          </DriverProtectedRoute>
                        }
                      />
                      <Route
                        path="record"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppRecord />
                          </DriverProtectedRoute>
                        }
                      />
                      <Route
                        path="checks"
                        element={
                          <DriverProtectedRoute>
                            <DriverAppChecks />
                          </DriverProtectedRoute>
                        }
                      />

                      {/* ── Manager ── */}
                      <Route path="admin" element={<AdminEntry />} />
                      <Route path="admin/login" element={<AdminLogin />} />
                      <Route path="admin/signup" element={<AdminSignup />} />
                      <Route path="admin/forgot" element={<AdminForgotPassword />} />
                      <Route path="admin/reset" element={<AdminUpdatePassword />} />
                      <Route
                        path="admin/*"
                        element={
                          <AdminProtectedRoute>
                            <AdminAppLayout>
                              <Routes>
                                <Route path="fleet" element={<AdminAppFleet />} />
                                <Route path="drivers/new" element={<SubscriptionGate feature="Adding drivers" reason="Creating new connection codes.">{<AdminAppAddDriver />}</SubscriptionGate>} />
                                <Route path="codes" element={<AdminAppCodes />} />
                                <Route path="drivers/:driverId/history" element={<SubscriptionGate feature="Driver history" reason="Route replay, trips and stops.">{<AdminAppDriverHistory />}</SubscriptionGate>} />
                                <Route path="drivers/:driverId" element={<AdminAppDriverDetail />} />
                                <Route path="jobs/new" element={<SubscriptionGate feature="Assigning jobs" reason="Sending work to a driver.">{<AdminAppCreateJob />}</SubscriptionGate>} />
                                <Route path="expenses" element={<SubscriptionGate feature="Expenses" reason="Approving what your drivers spend.">{<AdminAppExpenses />}</SubscriptionGate>} />
                                <Route path="reports" element={<SubscriptionGate feature="Checks and problems" reason="Vehicle faults raised by drivers.">{<AdminAppReports />}</SubscriptionGate>} />
                                <Route path="today" element={<SubscriptionGate feature="Today's summary" reason="Your end-of-day figures.">{<AdminAppDailyReport />}</SubscriptionGate>} />
                                <Route path="stations" element={<SubscriptionGate feature="Stations" requires="stations">{<AdminAppStations />}</SubscriptionGate>} />
                                <Route path="stations/:stationId" element={<SubscriptionGate feature="Stations" requires="stations">{<AdminAppStationDetail />}</SubscriptionGate>} />
                                <Route path="tasks" element={<SubscriptionGate feature="Jobs" reason="Dispatching work to drivers.">{<AdminAppTasks />}</SubscriptionGate>} />
                                <Route path="alerts" element={<AdminAppAlerts />} />
                                <Route path="insights" element={<SubscriptionGate feature="Insights" reason="Distance, speeds and per-driver figures.">{<AdminAppInsights />}</SubscriptionGate>} />
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
