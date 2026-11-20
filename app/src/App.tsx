import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Toasts } from './components/Toasts';
import { Loader } from './components/ui';
import { useApplyTheme } from './hooks';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './store/useAuthStore';

// Розділення коду: важкі сторінки (графіки) завантажуються за потреби.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SuitesPage = lazy(() => import('./pages/SuitesPage'));
const SuiteDetailPage = lazy(() => import('./pages/SuiteDetailPage'));
const RunsPage = lazy(() => import('./pages/RunsPage'));
const RunDetailPage = lazy(() => import('./pages/RunDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/** Увімкнення поведінки React Router v7 заздалегідь (без попереджень у консолі). */
export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

/** Захищений маршрут: неавторизованого користувача переадресовує на сторінку входу. */
function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  useApplyTheme();
  return (
    <HashRouter future={ROUTER_FUTURE}>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="suites" element={<SuitesPage />} />
            <Route path="suites/:suiteId" element={<SuiteDetailPage />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="runs/:runId" element={<RunDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
      <Toasts />
    </HashRouter>
  );
}
