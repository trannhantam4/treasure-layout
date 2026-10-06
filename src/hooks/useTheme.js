import { useState, useEffect } from 'react';

/**
 * Unified theme toggle hook.
 * Fixes split-brain bug: FloatingButtons defaulted to 'light' via localStorage,
 * while Navigation defaulted to 'dark' via data-theme attribute.
 * Now uses a single source of truth: localStorage with 'dark' default.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme };
}
