import { createTheme } from '@mui/material/styles';

export function createAtelierTheme(rtl: boolean) {
  return createTheme({
    direction: rtl ? 'rtl' : 'ltr',
    palette: {
      mode: 'dark',
      primary: { main: '#d4af37', dark: '#b8962e', light: '#e8c97a', contrastText: '#070b14' },
      secondary: { main: '#a8b3c7' },
      background: { default: '#070b14', paper: '#0f1729' },
      text: { primary: '#f8f4ef', secondary: '#a8b3c7', disabled: '#6b7a90' },
      divider: 'rgba(212, 175, 55, 0.25)',
      success: { main: '#4caf50' },
      error: { main: '#f44336' },
      warning: { main: '#ff9800' },
      info: { main: '#2196f3' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: rtl ? "'AtelierArabic', 'Cairo', Tahoma, sans-serif" : "'Plus Jakarta Sans', Arial, sans-serif",
      h4: { fontWeight: 800, letterSpacing: rtl ? 'normal' : '-.035em', lineHeight: 1.2 },
      h5: { fontWeight: 800, lineHeight: 1.25 },
      h6: { fontWeight: 750, lineHeight: 1.35 },
      body1: { lineHeight: 1.7 },
      body2: { lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 700 },
    },
    components: {
      MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8, minHeight: 44 }, contained: { boxShadow: 'none' } } },
      MuiCard: { styleOverrides: { root: { border: '1px solid rgba(212, 175, 55, 0.25)', backgroundColor: '#151f33', borderRadius: 16 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: '#0f1729' } } },
    },
  });
}
