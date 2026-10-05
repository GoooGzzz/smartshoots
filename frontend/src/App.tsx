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

  const theme = useMemo(() => createTheme({
    direction: isRTL ? 'rtl' : 'ltr',
    palette: {
      mode: darkMode ? 'dark' : 'light',
      // FIX/NEW: away from the generic "purple/blue-black SaaS" look -
      // warm ink + paper + a confident terracotta accent, fitting a
      // photography studio brand rather than a generic dashboard template.
      primary: { main: '#B5482A', light: '#D9764F', dark: '#7C2E12', contrastText: '#FFFFFF' },
      secondary: { main: '#F5A524', light: '#FFC466', dark: '#C67E0A', contrastText: '#1A1A1A' },
      success: { main: '#10B981' },
      warning: { main: '#F59E0B' },
      error: { main: '#EF4444' },
      background: darkMode
        ? { default: '#171512', paper: '#221E19' }
        : { default: '#FAF7F2', paper: '#FFFFFF' },
      text: darkMode
        ? { primary: '#F3EEE7', secondary: '#B4A99C' }
        : { primary: '#211C16', secondary: '#6B6258' },
      divider: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(33,28,22,0.08)',
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 700 },
      button: { fontWeight: 600, letterSpacing: '0.01em' },
    },
    shadows: Array(25).fill('none').map((_, i) => i === 0 ? 'none' :
      `0 ${Math.min(i * 1.5, 24)}px ${Math.min(i * 3, 48)}px -${Math.min(i, 12)}px rgba(181,72,42,${darkMode ? 0.35 : 0.12})`,
    ) as any,
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            boxShadow: darkMode
              ? '0 8px 24px -8px rgba(0,0,0,0.5)'
              : '0 8px 24px -8px rgba(181, 72, 42,0.15)',
            border: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(31,27,46,0.04)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 10, paddingInline: 18 },
          containedPrimary: {
            // FIX/NEW: flat, confident color instead of a gradient - the
            // gradient-on-every-button look was part of what read as
            // "generic SaaS template" rather than a distinct brand.
            backgroundImage: 'none',
            backgroundColor: '#B5482A',
            boxShadow: '0 6px 16px -4px rgba(181, 72, 42, 0.45)',
            '&:hover': { backgroundImage: 'none', backgroundColor: '#7C2E12' },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTextField: { defaultProps: { size: 'small' } },
    },
  }), [darkMode, isRTL]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConnectionBanner />
      <AuthProvider>
        <Router>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
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