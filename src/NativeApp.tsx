import { useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DriverSessionProvider } from '@/contexts/DriverSessionContext';
import DriverProtectedRoute from '@/components/DriverProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';

import DriverApp from '@/pages/app/DriverApp';
import DriverAppConnect from '@/pages/app/DriverAppConnect';
import DriverAppDashboard from '@/pages/app/DriverAppDashboard';
import DriverAppTasks from '@/pages/app/DriverAppTasks';
import DriverAppCompleteTask from '@/pages/app/DriverAppCompleteTask';
import DriverAppSOS from '@/pages/app/DriverAppSOS';
import DriverAppSettings from '@/pages/app/DriverAppSettings';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';

/**
 * Native-only app entry. Built into the iOS and Android Capacitor bundles.
 *
 * Contains only driver-facing surfaces. The admin / marketing / subscription
 * components (Landing, Pricing, PaymentWall, AppLayout, Stripe / Paystack
 * checkout, "Download APK" CTAs, etc.) are intentionally NOT imported here so
 * that Rollup tree-shakes them out of the production bundle. This is the
 * mechanism that lets the iOS app rely on App Store guideline 3.1.3(f) "Free
 * Stand-alone Apps acting as a stand-alone companion to a paid web tool" — no
 * purchase calls-to-action are reachable in the iOS bundle.
 */
export default function NativeApp() {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled rejection:', event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  return (
    <ThemeProvider>
      <DriverSessionProvider>
        <ErrorBoundary>
          <Routes>
            {/* Privacy and Terms — linked from in-app settings (Apple guideline 5.1.1(i)) */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Driver flow */}
            <Route path="/app" element={<DriverApp />} />
            <Route path="/app/connect" element={<DriverAppConnect />} />
            <Route
              path="/app/dashboard"
              element={
                <DriverProtectedRoute>
                  <DriverAppDashboard />
                </DriverProtectedRoute>
              }
            />
            <Route
              path="/app/tasks"
              element={
                <DriverProtectedRoute>
                  <DriverAppTasks />
                </DriverProtectedRoute>
              }
            />
            <Route
              path="/app/tasks/:taskId/complete"
              element={
                <DriverProtectedRoute>
                  <DriverAppCompleteTask />
                </DriverProtectedRoute>
              }
            />
            <Route
              path="/app/sos"
              element={
                <DriverProtectedRoute>
                  <DriverAppSOS />
                </DriverProtectedRoute>
              }
            />
            <Route
              path="/app/settings"
              element={
                <DriverProtectedRoute>
                  <DriverAppSettings />
                </DriverProtectedRoute>
              }
            />

            {/* Anything else routes back to the driver entry point */}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </ErrorBoundary>
      </DriverSessionProvider>
    </ThemeProvider>
  );
}
