import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'claude' | 'evernote' | 'terminal';

export const THEMES: Theme[] = ['light', 'dark', 'claude', 'evernote', 'terminal'];

export const themeLabels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  claude: 'Claude',
  evernote: 'Evernote',
  terminal: 'Terminal',
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'beijer-ink-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.includes(stored as Theme)) return stored as Theme;
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
