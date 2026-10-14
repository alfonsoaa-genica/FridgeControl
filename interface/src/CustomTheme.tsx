import { FC, useMemo } from 'react';
import { CssBaseline } from '@mui/material';
import { createTheme, responsiveFontSizes, ThemeProvider, ThemeOptions } from '@mui/material/styles';
import { RequiredChildrenProps } from './utils';
import { ThemeModeProvider, useThemeMode, ThemeMode } from './contexts/theme';

const getDesignTokens = (mode: ThemeMode): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'dark'
      ? {
          // --- MODO OSCURO (Obsidiana Industrial & Cyber Blue) ---
          background: {
            default: '#090d16',
            paper: '#111827'
          },
          primary: {
            main: '#0284c7',
            light: '#38bdf8',
            dark: '#0369a1',
            contrastText: '#ffffff'
          },
          secondary: {
            main: '#10b981',
            light: '#34d399',
            dark: '#059669',
            contrastText: '#ffffff'
          },
          text: {
            primary: '#f8fafc',
            secondary: '#94a3b8'
          },
          divider: 'rgba(255, 255, 255, 0.08)',
          success: {
            main: '#10b981',
            light: '#34d399',
            dark: '#059669'
          },
          warning: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#d97706'
          },
          error: {
            main: '#ef4444',
            light: '#f87171',
            dark: '#dc2626'
          },
          info: {
            main: '#06b6d4',
            light: '#22d3ee',
            dark: '#0891b2'
          }
        }
      : {
          // --- MODO CLARO (Ejecutivo Pizarra & Azul Profundo) ---
          background: {
            default: '#f8fafc',
            paper: '#ffffff'
          },
          primary: {
            main: '#1e3a8a',
            light: '#2563eb',
            dark: '#172554',
            contrastText: '#ffffff'
          },
          secondary: {
            main: '#0d9488',
            light: '#14b8a6',
            dark: '#0f766e',
            contrastText: '#ffffff'
          },
          text: {
            primary: '#0f172a',
            secondary: '#475569'
          },
          divider: '#e2e8f0',
          success: {
            main: '#059669',
            light: '#10b981',
            dark: '#047857'
          },
          warning: {
            main: '#d97706',
            light: '#f59e0b',
            dark: '#b45309'
          },
          error: {
            main: '#dc2626',
            light: '#ef4444',
            dark: '#b91c1c'
          },
          info: {
            main: '#0284c7',
            light: '#0ea5e9',
            dark: '#0369a1'
          }
        })
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.02em'
    },
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.01em'
    },
    subtitle1: {
      fontWeight: 600
    },
    button: {
      fontWeight: 600,
      textTransform: 'none'
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: mode === 'dark' ? '#334155 #0f172a' : '#cbd5e1 #f8fafc',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 8,
            height: 8
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: mode === 'dark' ? '#334155' : '#cbd5e1',
            minHeight: 24,
            border: mode === 'dark' ? '2px solid #0f172a' : '2px solid #f8fafc'
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: mode === 'dark' ? '#0f172a' : '#f8fafc'
          }
        }
      }
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
          transition: 'background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease'
        }
      }
    },
    MuiCard: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
          boxShadow: mode === 'dark'
            ? '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#161f30' : '#f1f5f9',
          '& .MuiTableCell-head': {
            fontWeight: 700,
            color: mode === 'dark' ? '#cbd5e1' : '#334155',
            borderBottom: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #cbd5e1'
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #e2e8f0'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600
        }
      }
    }
  }
});

const CustomThemeInner: FC<RequiredChildrenProps> = ({ children }) => {
  const { mode } = useThemeMode();

  const theme = useMemo(() => {
    return responsiveFontSizes(createTheme(getDesignTokens(mode)));
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

const CustomTheme: FC<RequiredChildrenProps> = ({ children }) => (
  <ThemeModeProvider>
    <CustomThemeInner>
      {children}
    </CustomThemeInner>
  </ThemeModeProvider>
);

export default CustomTheme;
