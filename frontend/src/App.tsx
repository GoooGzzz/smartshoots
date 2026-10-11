import { createAtelierTheme } from './styles/atelierTheme';
import React, { useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeContext';
import DashboardShell from './components/Layout/DashboardShell';
import ConnectionBanner from './components/Common/ConnectionBanner';
import LoginPage from './pages/LoginPage';
import { useTranslation } from 'react-i18next';
import './i18n';

// FIX/NEW (performance): every page used to be bundled into ONE ~2.2MB
// JS file, downloaded in full before the person could see even the
// login screen - the exact thing Vite's own build output kept warning
// about ("chunks larger than 500 kB") every single build. Loading each
// page's code only when its route is actually opened turns that one
// giant download into ~15 small ones, so first load (and every reload,
// including on a slow venue Wi-Fi) pulls a small fraction of that.
const StudioPage=lazy(()=>import('./pages/StudioPage'));
const ScreeningPage=lazy(()=>import('./pages/ScreeningPage'));
const AcademyPage = lazy(() => import('./pages/AcademyPage'));
const DeliveryPage = lazy(() => import('./pages/DeliveryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TimeTrackingPage = lazy(() => import('./pages/TimeTrackingPage'));
const AttachmentsPage = lazy(() => import('./pages/AttachmentsPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));

function RouteFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <CircularProgress />
    </Box>
  );
}


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading || isAuthenticated && !user) return <RouteFallback />;
  if (user?.role === 'client') return <Navigate to="/recordings" replace />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function DeliveryRoute() {
 const { isAuthenticated, loading, user } = useAuth();
 if (loading) return <RouteFallback />;
 if (!isAuthenticated) return <Navigate to="/login" replace />;
 if (!user) return <RouteFallback />;
 return user.role === 'client' ? <DeliveryPage /> : <Navigate to="/delivery" replace />;
}

function AppContent() {
  const { i18n } = useTranslation();
  const { darkMode } = useThemeMode();
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);

  const theme = useMemo(() => createAtelierTheme(isRTL), [isRTL]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConnectionBanner />
      <AuthProvider>
        <Router>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/screening/:id" element={<ScreeningPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/recordings" element={<DeliveryRoute />} />
              <Route path="/" element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientDetailPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="tools" element={<ToolsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="time-tracking" element={<TimeTrackingPage />} />
                <Route path="attachments" element={<AttachmentsPage />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="delivery" element={<DeliveryPage />} />
                <Route path="academy" element={<AcademyPage />} />
                <Route path="studio" element={<StudioPage />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <AppContent />
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}

export default App;
