import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, IconButton, List, ListItem,
  ListItemIcon, ListItemText, Typography, useMediaQuery, useTheme, Tooltip,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, CalendarMonth,
  Receipt, People, Assessment, Settings, Payment as PaymentIcon,
  MoneyOff, Logout, Language, Brightness4, Brightness7, ChevronLeft, ChevronRight,
  Timer, AttachFile, Timeline, AutoAwesome, Search as SearchIcon, InstallMobile,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import NotificationCenter from '../Notifications/NotificationCenter';
import CommandPalette from '../Common/CommandPalette';
import useInstallPrompt from '../../utils/useInstallPrompt';
import { startOfflinePrefetch } from '../../utils/offlinePrefetch';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

function CameraLogo() {
  return (
    // NEW: replaced the flat, single-color camera icon with a genuinely
    // dimensional one - a gradient body (not a flat fill) for a rounded,
    // lit-from-above look, a metallic lens ring, and a small glint that
    // pulses like a real reflection catching light. The whole mark
    // tilts and lifts slightly on hover for a tactile, "pick me up"
    // feel instead of sitting completely static.
    <Box
      sx={{
        display: 'inline-flex', mr: 1, cursor: 'default',
        transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)',
        transform: 'perspective(300px) rotateY(0deg)',
        '&:hover': { transform: 'perspective(300px) rotateY(-12deg) scale(1.08)' },
      }}
    >
      <svg width="38" height="38" viewBox="0 0 512 512" style={{ filter: 'drop-shadow(0 4px 8px rgba(181, 72, 42,0.55))' }}>
        <defs>
          <linearGradient id="camBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B6FFF" />
            <stop offset="55%" stopColor="#5B3FD6" />
            <stop offset="100%" stopColor="#3B2496" />
          </linearGradient>
          <linearGradient id="camTop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A78BFF" />
            <stop offset="100%" stopColor="#C1522F" />
          </linearGradient>
          <radialGradient id="lensRing" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#EDE8FF" />
            <stop offset="55%" stopColor="#B9A8FF" />
            <stop offset="100%" stopColor="#C1522F" />
          </radialGradient>
          <radialGradient id="lensGlass" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#7FE0FF" />
            <stop offset="45%" stopColor="#2C63C9" />
            <stop offset="100%" stopColor="#161E4A" />
          </radialGradient>
          <radialGradient id="glint" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="192" y="140" width="128" height="36" rx="10" fill="url(#camTop)" />
        <rect x="64" y="172" width="384" height="204" rx="28" fill="url(#camBody)" />
        <rect x="64" y="172" width="384" height="18" rx="9" fill="#ffffff" opacity="0.18" />
        <circle cx="256" cy="272" r="78" fill="url(#lensRing)" />
        <circle cx="256" cy="272" r="54" fill="url(#lensGlass)" />
        <circle cx="235" cy="250" r="14" fill="url(#glint)">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="400" cy="204" r="10" fill="#FFD86E" />
      </svg>
    </Box>
  );
}

// NEW: an animated, multi-color gradient that sweeps across the "SMART
// SHOOTS" wordmark, plus a stack of translucent text-shadows underneath
// the gradient-filled text to fake letterpress/3D extrusion depth.
const gradientSweep = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

function AppTitle({ text }: { text: string }) {
  return (
    <Typography
      variant="h6"
      noWrap
      component="div"
      sx={{
        fontWeight: 900,
        ml: 1,
        letterSpacing: 1.5,
        fontSize: { xs: '1.1rem', sm: '1.35rem' },
        backgroundImage: 'linear-gradient(90deg, #FFD86E, #FF6EC7, #6EC6FF, #6EFFB3, #FFD86E)',
        backgroundSize: '300% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        animation: `${gradientSweep} 6s ease infinite`,
        textShadow: '0 1px 0 rgba(0,0,0,0.35), 0 2px 2px rgba(0,0,0,0.25), 0 5px 8px rgba(0,0,0,0.35)',
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
      }}
    >
      {text}
    </Typography>
  );
}

// NEW: 3D "beveled panel" digital clock - a raised, glassy plate with an
// inset dark well behind the digits and a bright top highlight, replacing
// the previous plain two-line text.
function DigitalClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <Box
      sx={{
        mx: 2,
        px: 2,
        py: 0.5,
        borderRadius: 2.5,
        textAlign: 'center',
        lineHeight: 1.2,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04))',
        border: '1px solid rgba(255,255,255,0.35)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 8px 16px -6px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.3)',
        display: { xs: 'none', sm: 'block' },
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          fontFamily: '"Courier New", monospace',
          letterSpacing: 2,
          color: '#fff',
          textShadow: '0 1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.4)',
        }}
      >
        {timeStr}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 1px rgba(0,0,0,0.35)' }}>
        {dateStr}
      </Typography>
    </Box>
  );
}

export default function DashboardShell() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  useEffect(() => startOfflinePrefetch(), []);
  // Ctrl/Cmd+K opens the quick switcher.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { logout, user } = useAuth();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const menuItems = [
    ...(['owner','admin'].includes(user?.role) ? [{ path: '/delivery', label: isRTL ? 'تسجيلات العملاء' : 'Client recordings', icon: <AttachFile />, color: '#B28A3D' }] : []),
    { path: '/', label: t('dashboard'), icon: <DashboardIcon />, color: '#C1522F' },
    { path: '/clients', label: t('clients'), icon: <People />, color: '#2196F3' },
    { path: '/orders', label: t('orders'), icon: <Receipt />, color: '#FF9800' },
    { path: '/schedule', label: t('schedule'), icon: <CalendarMonth />, color: '#00BCD4' },
    { path: '/payments', label: t('payments'), icon: <PaymentIcon />, color: '#4CAF50' },
    { path: '/expenses', label: t('expenses'), icon: <MoneyOff />, color: '#F44336' },
    { path: '/reports', label: t('reports'), icon: <Assessment />, color: '#9C27B0' },
    { path: '/tools', label: t('tools'), icon: <AutoAwesome />, color: '#B5482A' },
    { path: '/settings', label: t('settings'), icon: <Settings />, color: '#607D8B' },
    { path: '/time-tracking', label: t('timeTracking'), icon: <Timer />, color: '#FF6E9C' },
    { path: '/attachments', label: t('attachments'), icon: <AttachFile />, color: '#795548' },
    { path: '/progress', label: t('progress'), icon: <Timeline />, color: '#00C896' },
  ];

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CameraLogo />
          {!collapsed && (
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', ml: 0.5 }}>
              {t('appName')}
            </Typography>
          )}
        </Box>
      </Box>
      <List sx={{ flex: 1, px: collapsed ? 1 : 2, py: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Tooltip key={item.path} title={collapsed ? item.label : ''} placement={isRTL ? 'left' : 'right'}>
              <ListItem
                button
                onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                sx={{
                  mb: 1, borderRadius: 3,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 0 : 1.75, py: 1.1,
                  color: isActive ? '#fff' : 'text.primary',
                  position: 'relative', overflow: 'hidden',
                  transition: 'transform .18s ease, box-shadow .18s ease, background .18s ease',
                  // NEW: every nav item now reads as a physical 3D button -
                  // a raised, gradient-tinted surface at rest, that visibly
                  // "presses in" (inset shadow, no lift) when it's the
                  // active page, and lifts further on hover for anything
                  // that isn't already selected.
                  background: isActive
                    ? `linear-gradient(160deg, ${item.color}, ${item.color}CC)`
                    : `linear-gradient(160deg, ${item.color}0F 0%, transparent 60%)`,
                  boxShadow: isActive
                    ? `inset 0 2px 4px rgba(0,0,0,0.25), inset 0 -1px 0 rgba(255,255,255,0.15), 0 6px 14px -6px ${item.color}88`
                    : `0 1px 0 rgba(255,255,255,0.5) inset`,
                  '&:hover': {
                    transform: isActive ? 'none' : 'translateY(-2px)',
                    background: isActive
                      ? `linear-gradient(160deg, ${item.color}, ${item.color}CC)`
                      : `linear-gradient(160deg, ${item.color}22 0%, transparent 65%)`,
                    boxShadow: isActive
                      ? `inset 0 2px 4px rgba(0,0,0,0.25), inset 0 -1px 0 rgba(255,255,255,0.15), 0 6px 14px -6px ${item.color}88`
                      : `0 10px 18px -10px ${item.color}66`,
                  },
                  // NEW: hover alone means nothing on a touchscreen (no
                  // mouse to hover with) - this is the tactile feedback
                  // that actually matters for the Android build, a quick
                  // press-down scale on tap.
                  '&:active': {
                    transform: 'scale(0.96)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: '#fff', minWidth: collapsed ? 0 : 40, justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 1.75,
                    display: 'flex', alignItems: 'center',
                    background: isActive ? 'rgba(255,255,255,0.22)' : `linear-gradient(145deg, ${item.color}, ${item.color}AA)`,
                    boxShadow: isActive ? 'none' : `0 4px 8px -3px ${item.color}99, inset 0 1px 1px rgba(255,255,255,0.5)`,
                  }}
                >
                  {React.cloneElement(item.icon, { sx: { fontSize: 19, color: '#fff' } })}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    sx={{ ml: 1 }}
                    primaryTypographyProps={{ sx: { fontWeight: isActive ? 700 : 500 } }}
                  />
                )}
              </ListItem>
            </Tooltip>
          );
        })}
      </List>
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        {!collapsed ? <Typography variant="caption" color="text.secondary" align="center">© 2026 Ahmed Gouda, Cairo Egypt</Typography> : null}
      </Box>
    </Box>
  );

  const drawerWidth = collapsed && !isMobile ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, backgroundImage: 'linear-gradient(90deg, #B5482A 0%, #C1522F 100%)' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => { if (isMobile) setMobileOpen(!mobileOpen); else setCollapsed(!collapsed); }} sx={{ mr: 2 }}>
            {isMobile ? <MenuIcon /> : (collapsed ? (isRTL ? <ChevronLeft /> : <ChevronRight />) : (isRTL ? <ChevronRight /> : <ChevronLeft />))}
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <CameraLogo />
            <AppTitle text={t('appName')} />
          </Box>
          <IconButton color="inherit" onClick={() => setPaletteOpen(true)} aria-label="search"><SearchIcon /></IconButton>
          {canInstall && (
            <Tooltip title={t('installApp')}><IconButton color="inherit" onClick={install}><InstallMobile /></IconButton></Tooltip>
          )}
          <DigitalClock />
          <IconButton color="inherit" onClick={toggleDarkMode}>{darkMode ? <Brightness7 /> : <Brightness4 />}</IconButton>
          <IconButton color="inherit" onClick={toggleLanguage}><Language /></IconButton>
          <NotificationCenter />
          <IconButton color="inherit" onClick={handleLogout}><Logout /></IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        anchor={isRTL ? 'right' : 'left'}
        sx={{
          width: drawerWidth, flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth, boxSizing: 'border-box', transition: 'width 0.3s',
            backgroundImage: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(107,79,224,0.06) 0%, transparent 30%)'
              : 'linear-gradient(180deg, rgba(107,79,224,0.05) 0%, transparent 30%)',
            boxShadow: isRTL ? '-8px 0 24px -16px rgba(0,0,0,0.35)' : '8px 0 24px -16px rgba(0,0,0,0.35)',
            borderRight: isRTL ? 'none' : '1px solid rgba(107,79,224,0.12)',
            borderLeft: isRTL ? '1px solid rgba(107,79,224,0.12)' : 'none',
          },
        }}
      >
        <Toolbar />
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` },
          // NEW: leaves room for the mobile bottom nav bar below so the
          // last bit of page content isn't hidden behind it.
          pb: isMobile ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : 3,
        }}
      >
        <Toolbar />
        <Box key={location.pathname} className="ss-page"><Outlet /></Box>
      </Box>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* NEW: a proper native-feeling bottom tab bar for phones, instead
          of relying on a desktop-style hamburger+drawer as the PRIMARY
          way to navigate on a touchscreen. Four most-used destinations
          get instant one-tap access; "More" reuses the existing drawer
          for everything else. Respects gesture-nav safe-area insets so
          it doesn't collide with the Android system nav bar/pill. */}
      {isMobile && (
        <Box
          sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.drawer + 2,
            display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
            pb: 'env(safe-area-inset-bottom, 0px)',
            backgroundImage: 'linear-gradient(180deg, #2A1F18 0%, #1E1712 100%)',
            boxShadow: '0 -6px 20px -6px rgba(0,0,0,0.4)',
          }}
        >
          {[...menuItems.slice(0, 4), { path: '__more__', label: t('more'), icon: <MenuIcon />, color: '#9E8CF5' }].map((item) => {
            const isActive = item.path === '__more__' ? mobileOpen : location.pathname === item.path;
            return (
              <Box
                key={item.path}
                onClick={() => (item.path === '__more__' ? setMobileOpen(true) : navigate(item.path))}
                sx={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 0.25, py: 1, cursor: 'pointer', color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                  position: 'relative', transition: 'color 0.15s ease',
                  '&:active': { transform: 'scale(0.92)' },
                }}
              >
                <Box
                  sx={{
                    width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundImage: isActive ? `radial-gradient(circle, ${item.color}55 0%, transparent 70%)` : 'none',
                    boxShadow: isActive ? `0 0 0 1px ${item.color}88, 0 0 10px ${item.color}66` : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    '& .MuiSvgIcon-root': { fontSize: 20 },
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}