import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'retro';

/** Theme: stored preference > prefers-color-scheme (Reddit/system UI). */
function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem('kinoticon-theme');
  if (stored === 'dark' || stored === 'light' || stored === 'retro') {
    return stored as ThemeMode;
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('retro');
    } else if (theme === 'retro') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('retro');
    } else {
      // light
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.remove('retro');
    }
    localStorage.setItem('kinoticon-theme', theme);
  }, [theme]);

  // Cycle through themes: light → dark → retro → light
  const toggle = useCallback(() => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'retro';
      return 'light';
    });
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    isRetro: theme === 'retro',
    toggle,
  };
}
