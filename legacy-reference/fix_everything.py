import os

BASE = os.getcwd()

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ {path}")

# ---------------------------------------------------------------------
# 1. config/settings.py
# ---------------------------------------------------------------------
settings_content = '''import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-smart-shoots-development-key')
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'django_filters',
    'django_fsm',

    # Local apps
    'apps.accounts',
    'apps.production',
    'apps.scheduling',
    'apps.finance',
    'apps.notifications',
    'apps.reports',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Add caching middleware (optional but improves performance)
    # 'django.middleware.cache.UpdateCacheMiddleware',
    # 'django.middleware.cache.FetchFromCacheMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Cairo'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# CSRF settings
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_HTTPONLY = False

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# Twilio settings (optional)
TWILIO_ACCOUNT_SID = ''
TWILIO_AUTH_TOKEN = ''
TWILIO_WHATSAPP_NUMBER = ''
'''
write('config/settings.py', settings_content)

# ---------------------------------------------------------------------
# 2. apps/finance/views.py
# ---------------------------------------------------------------------
finance_views = '''from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.management import call_command
from django.http import FileResponse
import tempfile, os
from .models import Payment, ExpenseCategory, Expense, Attachment, BusinessSettings
from .serializers import PaymentSerializer, ExpenseCategorySerializer, ExpenseSerializer, AttachmentSerializer, BusinessSettingsSerializer

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['method', 'is_deposit', 'client']
    search_fields = ['reference', 'order__order_number', 'client__name']
    ordering_fields = ['payment_date', 'amount']

class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category_type', 'is_active', 'is_recurring']
    search_fields = ['name']

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category', 'is_recurring']
    search_fields = ['description']
    ordering_fields = ['expense_date', 'amount']

class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ['client', 'order', 'is_shareable']
    search_fields = ['filename', 'description']

    def create(self, request, *args, **kwargs):
        # Handle multiple files
        files = request.FILES.getlist('file') or request.FILES.getlist('files')
        if len(files) > 1:
            attachments = []
            for file in files:
                data = {
                    'file': file,
                    'filename': file.name,
                    'file_type': file.content_type,
                    'file_size': file.size,
                    'uploaded_by': request.user,
                }
                # If client or order provided, add them
                if request.data.get('client'):
                    data['client_id'] = request.data['client']
                if request.data.get('order'):
                    data['order_id'] = request.data['order']
                att = Attachment.objects.create(**data)
                attachments.append(att)
            serializer = self.get_serializer(attachments, many=True)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return super().create(request, *args, **kwargs)

class BusinessSettingsViewSet(viewsets.ModelViewSet):
    queryset = BusinessSettings.objects.all()
    serializer_class = BusinessSettingsSerializer
    permission_classes = [IsAuthenticated]

class BackupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            call_command('backup_data', stdout=f)
            backup_path = f.name
        response = FileResponse(open(backup_path, 'rb'), as_attachment=True, filename='smart_shoots_backup.json')
        return response

class RestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=400)
        temp_path = os.path.join(tempfile.gettempdir(), file.name)
        with open(temp_path, 'wb+') as dest:
            for chunk in file.chunks():
                dest.write(chunk)
        try:
            call_command('restore_data', temp_path)
            return Response({'status': 'success'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
'''
write('apps/finance/views.py', finance_views)

# ---------------------------------------------------------------------
# 3. apps/finance/urls.py
# ---------------------------------------------------------------------
finance_urls = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'payments', views.PaymentViewSet)
router.register(r'expense-categories', views.ExpenseCategoryViewSet)
router.register(r'expenses', views.ExpenseViewSet)
router.register(r'attachments', views.AttachmentViewSet)
router.register(r'settings', views.BusinessSettingsViewSet)

urlpatterns = [
    path('backup/', views.BackupView.as_view(), name='backup'),
    path('restore/', views.RestoreView.as_view(), name='restore'),
    path('', include(router.urls)),
]
'''
write('apps/finance/urls.py', finance_urls)

# ---------------------------------------------------------------------
# 4. apps/notifications/views.py
# ---------------------------------------------------------------------
notifications_views = '''from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'is_read']
    ordering_fields = ['created_at']

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({'status': 'success'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        return Response({'status': 'success'})

class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    queryset = NotificationPreference.objects.all()
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
'''
write('apps/notifications/views.py', notifications_views)

# ---------------------------------------------------------------------
# 5. apps/notifications/urls.py
# ---------------------------------------------------------------------
notifications_urls = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'preferences', views.NotificationPreferenceViewSet, basename='notification-preference')
router.register(r'', views.NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
'''
write('apps/notifications/urls.py', notifications_urls)

# ---------------------------------------------------------------------
# 6. apps/notifications/management/commands/send_reminders.py
# ---------------------------------------------------------------------
send_reminders = '''from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.scheduling.models import Appointment
from apps.notifications.services import send_whatsapp, send_sms

class Command(BaseCommand):
    help = 'Send reminders for upcoming appointments'

    def handle(self, *args, **kwargs):
        now = timezone.now()
        upcoming = Appointment.objects.filter(
            start_time__gte=now,
            start_time__lte=now + timedelta(hours=24),
            status__in=['confirmed', 'pending']
        )
        for appt in upcoming:
            message = f'Reminder: Your appointment is at {appt.start_time}'
            # Send WhatsApp and SMS if credentials are configured
            if hasattr(settings, 'TWILIO_ACCOUNT_SID') and settings.TWILIO_ACCOUNT_SID:
                try:
                    send_whatsapp(appt.client.primary_phone, message)
                    send_sms(appt.client.primary_phone, message)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Failed to send reminder: {e}'))
            else:
                self.stdout.write(f'Reminder for {appt.client.name} at {appt.start_time}')
'''
write('apps/notifications/management/commands/send_reminders.py', send_reminders)

# ---------------------------------------------------------------------
# 7. frontend/src/api/client.ts
# ---------------------------------------------------------------------
client_ts = '''import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  const csrfToken = getCookie('csrftoken');
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
});

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default apiClient;
'''
write('frontend/src/api/client.ts', client_ts)

# ---------------------------------------------------------------------
# 8. frontend/src/contexts/AuthContext.tsx
# ---------------------------------------------------------------------
auth_context = '''import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  login: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/api/accounts/auth/login/', { username, password }, {
        withCredentials: true,
      });
      const { token, user } = response.data;
      localStorage.setItem('auth_token', token);
      setUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
'''
write('frontend/src/contexts/AuthContext.tsx', auth_context)

# ---------------------------------------------------------------------
# 9. frontend/src/components/Notifications/NotificationCenter.tsx
# ---------------------------------------------------------------------
notification_center = '''import React, { useState } from 'react';
import {
  Badge, IconButton, Menu, MenuItem, Typography, Box, Button,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

export default function NotificationCenter() {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications/?is_read=false').then(res => res.data),
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiClient.post('/notifications/mark_all_read/'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = data?.results?.length ?? 0;

  return (
    <>
      <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ p: 2, width: 300, maxHeight: 400, overflow: 'auto' }}>
          <Typography variant="subtitle1">{t('notifications')}</Typography>
          {data?.results?.length === 0 ? (
            <Typography variant="body2" color="textSecondary">{t('noData')}</Typography>
          ) : (
            data?.results?.map((n: any) => (
              <MenuItem key={n.id} onClick={() => setAnchorEl(null)}>
                <Box>
                  <Typography variant="body2" fontWeight="bold">{n.title}</Typography>
                  <Typography variant="caption" color="textSecondary">{n.message}</Typography>
                </Box>
              </MenuItem>
            ))
          )}
          <Button size="small" onClick={() => markAllRead.mutate()}>{t('markAllRead')}</Button>
        </Box>
      </Menu>
    </>
  );
}
'''
write('frontend/src/components/Notifications/NotificationCenter.tsx', notification_center)

# ---------------------------------------------------------------------
# 10. frontend/src/components/Layout/DashboardShell.tsx (with NotificationCenter)
# ---------------------------------------------------------------------
dashboard_shell = '''import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, IconButton, List, ListItem,
  ListItemIcon, ListItemText, Typography, useMediaQuery, useTheme, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, CalendarMonth,
  Receipt, People, Assessment, Settings, Payment as PaymentIcon,
  MoneyOff, Logout, Language, Brightness4, Brightness7, ChevronLeft, ChevronRight,
  Timer, AttachFile,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import NotificationCenter from '../Notifications/NotificationCenter';

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
    { path: '/time-tracking', label: t('timeTracking'), icon: <Timer /> },
    { path: '/attachments', label: t('attachments'), icon: <AttachFile /> },
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
          <NotificationCenter />
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
'''
write('frontend/src/components/Layout/DashboardShell.tsx', dashboard_shell)

# ---------------------------------------------------------------------
# 11. frontend/src/pages/SettingsPage.tsx (with backup/restore)
# ---------------------------------------------------------------------
settings_page = '''import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  LinearProgress,
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

  const backupMutation = useMutation({
    mutationFn: () => apiClient.get('/finance/backup/', { responseType: 'blob' }),
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'smart_shoots_backup.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/finance/restore/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => alert(t('restoreSuccess')),
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
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('businessName')} value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('currency')} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('timezone')} value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{t('language')}</InputLabel>
                <Select value={settings.language} label={t('language')} onChange={handleLanguageChange}>
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
              <TextField fullWidth label={t('address')} value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('phone')} value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('email')} value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('website')} value={settings.website} onChange={(e) => setSettings({ ...settings, website: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('taxNumber')} value={settings.tax_number} onChange={(e) => setSettings({ ...settings, tax_number: e.target.value })} />
            </Grid>
          </Grid>
          <Button variant="contained" onClick={handleSave} sx={{ mt: 3 }}>{t('save')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('backupRestore')}</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button variant="outlined" onClick={() => backupMutation.mutate()}>
              {t('backup')}
            </Button>
            <Button variant="outlined" component="label">
              {t('restore')}
              <input type="file" hidden accept=".json" onChange={(e) => {
                if (e.target.files?.[0]) restoreMutation.mutate(e.target.files[0]);
              }} />
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
'''
write('frontend/src/pages/SettingsPage.tsx', settings_page)

print("\\n✅ All critical files updated. Please run migrations and restart servers.")