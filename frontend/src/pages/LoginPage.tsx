import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert, InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, CameraAlt, PersonOutline, LockOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

// NEW: redesigned from a plain centered form into a split-screen layout -
// a branded gradient panel on one side, a clean card-style form on the
// other. Matches the theme overhaul in App.tsx (Plus Jakarta Sans font,
// indigo/amber palette) instead of default MUI look.
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(t('invalidCredentials'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Brand panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '45%',
          p: 6,
          color: '#fff',
          backgroundImage: 'radial-gradient(circle at 20% 20%, #C1522F 0%, #B5482A 45%, #2A1F18 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.15,
          backgroundImage: 'radial-gradient(circle, #F5A524 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, zIndex: 1 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)',
          }}>
            <CameraAlt />
          </Box>
          <Typography variant="h6" fontWeight={800} letterSpacing="-0.02em">SMART SHOOTS</Typography>
        </Box>
        <Box sx={{ zIndex: 1 }}>
          <Typography variant="h3" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 2, lineHeight: 1.15 }}>
            {t('loginHeroTitle')}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85, maxWidth: 420 }}>
            {t('loginHeroSubtitle')}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.6, zIndex: 1 }}>
          © {new Date().getFullYear()} SMART SHOOTS
        </Typography>
      </Box>

      {/* Form panel */}
      <Box sx={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3,
        bgcolor: 'background.default',
      }}>
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 4, justifyContent: 'center' }}>
            <CameraAlt color="primary" />
            <Typography variant="h6" fontWeight={800}>SMART SHOOTS</Typography>
          </Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>{t('welcomeBack')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {t('signInSubtitle')}
          </Typography>
          {error && <Alert severity="error" sx={{ width: '100%', mb: 2, borderRadius: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              fullWidth
              label={t('username')}
              margin="normal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline fontSize="small" /></InputAdornment> }}
            />
            <TextField
              fullWidth
              label={t('password')}
              type={showPassword ? 'text' : 'password'}
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined fontSize="small" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" tabIndex={-1}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={submitting}
              sx={{ mt: 3, py: 1.4 }}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {t('signIn')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
