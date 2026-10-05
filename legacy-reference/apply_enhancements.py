import os

BASE = os.path.join(os.getcwd(), 'frontend', 'src')

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ {path}")

# ---------------------------------------------------------------------
# 1. ThemeContext.tsx
# ---------------------------------------------------------------------
write('contexts/ThemeContext.tsx', '''import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  darkMode: false,
  toggleDarkMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
''')

# ---------------------------------------------------------------------
# 2. Update App.tsx to use ThemeModeProvider and dark mode
# ---------------------------------------------------------------------
write('App.tsx', '''import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeContext';
import DashboardShell from './components/Layout/DashboardShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import OrdersPage from './pages/OrdersPage';
import SchedulePage from './pages/SchedulePage';
import PaymentsPage from './pages/PaymentsPage';
import ExpensesPage from './pages/ExpensesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import { useTranslation } from 'react-i18next';
import './i18n';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
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
      primary: { main: '#2563EB' },
      secondary: { main: '#10B981' },
      background: darkMode ? { default: '#0F172A', paper: '#1E293B' } : { default: '#F8FAFC', paper: '#FFFFFF' },
      text: darkMode ? { primary: '#F1F5F9', secondary: '#94A3B8' } : { primary: '#1E293B', secondary: '#64748B' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, sans-serif',
      h4: { fontWeight: 700 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: darkMode ? '0 4px 6px -1px rgba(0,0,0,0.3)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
    },
  }), [darkMode, isRTL]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="clients/:id" element={<ClientDetailPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
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
''')

# ---------------------------------------------------------------------
# 3. Update DashboardShell.tsx: collapsible, RTL-aware, dark mode toggle, copyright
# ---------------------------------------------------------------------
write('components/Layout/DashboardShell.tsx', '''import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, IconButton, List, ListItem,
  ListItemIcon, ListItemText, Typography, useMediaQuery, useTheme, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, CalendarMonth,
  Receipt, People, Assessment, Settings, Payment as PaymentIcon,
  MoneyOff, Logout, Language, Brightness4, Brightness7, ChevronLeft, ChevronRight,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

export default function DashboardShell() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: t('dashboard'), icon: <DashboardIcon /> },
    { path: '/clients', label: t('clients'), icon: <People /> },
    { path: '/orders', label: t('orders'), icon: <Receipt /> },
    { path: '/schedule', label: t('schedule'), icon: <CalendarMonth /> },
    { path: '/payments', label: t('payments'), icon: <PaymentIcon /> },
    { path: '/expenses', label: t('expenses'), icon: <MoneyOff /> },
    { path: '/reports', label: t('reports'), icon: <Assessment /> },
    { path: '/settings', label: t('settings'), icon: <Settings /> },
  ];

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
            {t('appName')}
          </Typography>
        )}
      </Box>
      <List sx={{ flex: 1, px: collapsed ? 1 : 2 }}>
        {menuItems.map((item) => (
          <Tooltip key={item.path} title={collapsed ? item.label : ''} placement={isRTL ? 'left' : 'right'}>
            <ListItem
              button
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                mb: 0.5,
                borderRadius: 3,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 0 : 2,
                backgroundColor: location.pathname === item.path ? 'primary.main' : 'transparent',
                color: location.pathname === item.path ? 'white' : 'text.primary',
                '&:hover': { backgroundColor: location.pathname === item.path ? 'primary.dark' : 'action.hover' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && <ListItemText primary={item.label} />}
            </ListItem>
          </Tooltip>
        ))}
      </List>
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        {!collapsed ? (
          <Typography variant="caption" color="text.secondary" align="center">
            © 2026 Ahmed Gouda, Cairo Egypt
          </Typography>
        ) : null}
      </Box>
    </Box>
  );

  const drawerWidth = collapsed && !isMobile ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => {
              if (isMobile) setMobileOpen(!mobileOpen);
              else setCollapsed(!collapsed);
            }}
            sx={{ mr: 2 }}
          >
            {isMobile ? <MenuIcon /> : (collapsed ? (isRTL ? <ChevronLeft /> : <ChevronRight />) : (isRTL ? <ChevronRight /> : <ChevronLeft />))}
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {t('appName')}
          </Typography>
          <IconButton color="inherit" onClick={toggleDarkMode}>
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
          <IconButton color="inherit" onClick={toggleLanguage}>
            <Language />
          </IconButton>
          <IconButton color="inherit" onClick={handleLogout}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        anchor={isRTL ? 'right' : 'left'}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            transition: 'width 0.3s',
          },
        }}
      >
        <Toolbar />
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
''')

# ---------------------------------------------------------------------
# 4. Update SettingsPage.tsx: functional theme/language toggles, select arrows
# ---------------------------------------------------------------------
write('pages/SettingsPage.tsx', '''import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid, MenuItem,
  FormControl, InputLabel, Select, Switch, FormControlLabel,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../contexts/ThemeContext';
import apiClient from '../api/client';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    name: '',
    currency: 'EGP',
    timezone: 'Africa/Cairo',
    language: 'en',
    theme: 'light',
    address: '',
    phone: '',
    email: '',
    website: '',
    tax_number: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => apiClient.get('/finance/settings/').then(res => res.data),
  });

  useEffect(() => {
    if (data?.results?.length > 0) {
      const s = data.results[0];
      setSettings({
        name: s.name || '',
        currency: s.currency || 'EGP',
        timezone: s.timezone || 'Africa/Cairo',
        language: s.language || 'en',
        theme: s.theme || 'light',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        website: s.website || '',
        tax_number: s.tax_number || '',
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updated: any) => apiClient.put(`/finance/settings/${updated.id}/`, updated),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-settings'] }),
  });
  const createMutation = useMutation({
    mutationFn: (newSettings: any) => apiClient.post('/finance/settings/', newSettings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-settings'] }),
  });

  const handleSave = () => {
    if (data?.results?.length > 0) {
      const current = data.results[0];
      updateMutation.mutate({ ...settings, id: current.id });
    } else {
      createMutation.mutate(settings);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const newLang = e.target.value as string;
    setSettings({ ...settings, language: newLang });
    i18n.changeLanguage(newLang);
  };

  const handleThemeChange = () => {
    setSettings({ ...settings, theme: darkMode ? 'light' : 'dark' });
    toggleDarkMode();
  };

  if (isLoading && !data) return <Typography>{t('loading')}</Typography>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('settings')}</Typography>
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('businessName')}
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('currency')}
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('timezone')}
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{t('language')}</InputLabel>
                <Select
                  value={settings.language}
                  label={t('language')}
                  onChange={handleLanguageChange}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="ar">العربية</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={<Switch checked={darkMode} onChange={handleThemeChange} />}
                label={darkMode ? t('darkMode') : t('lightMode')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('address')}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('phone')}
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('email')}
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('website')}
                value={settings.website}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('taxNumber')}
                value={settings.tax_number}
                onChange={(e) => setSettings({ ...settings, tax_number: e.target.value })}
              />
            </Grid>
          </Grid>
          <Button variant="contained" onClick={handleSave} sx={{ mt: 3 }}>
            {t('save')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
''')

print("\\n✅ Enhancements applied successfully.")