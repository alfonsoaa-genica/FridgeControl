import React, { createContext, useState, useEffect, useMemo, useCallback, FC } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeModeContextValue {
  mode: ThemeMode;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = 'fridgecontrol_theme_mode';

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  toggleThemeMode: () => {},
  setThemeMode: () => {}
});

export { ThemeModeContext };

interface ThemeModeProviderProps {
  children: React.ReactNode;
}

export const ThemeModeProvider: FC<ThemeModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // 1. Recuperar preferencia guardada en el navegador
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // 2. Por defecto: Modo Oscuro (adecuado para telemetría automotriz y cabina)
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleThemeMode = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggleThemeMode,
      setThemeMode
    }),
    [mode, toggleThemeMode, setThemeMode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
};

export default ThemeModeContext;
