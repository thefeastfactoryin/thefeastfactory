'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';

const theme = createTheme({
  palette: {
    primary: { main: '#7a1f2b', contrastText: '#ffffff' },
    secondary: { main: '#c19a43', contrastText: '#171717' },
    background: { default: '#faf7f2', paper: '#ffffff' },
    text: { primary: '#1a1a1a', secondary: '#6e6e6e' },
    divider: '#e5ded4',
  },
  typography: {
    fontFamily: 'var(--font-sans), Inter, ui-sans-serif, system-ui, sans-serif',
  },
  shape: { borderRadius: 12 },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 20px 60px -15px rgb(0 0 0 / 0.24)',
          border: '1px solid #e5ded4',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked': { color: '#7a1f2b' } },
        track: { '.Mui-checked.Mui-checked + &': { backgroundColor: '#7a1f2b' } },
      },
    },
    MuiRadio: {
      styleOverrides: { root: { '&.Mui-checked': { color: '#7a1f2b' } } },
    },
  },
});

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
