import { useState, useEffect } from 'react';
import './FloatingButtons.css';
import { useTranslation } from 'react-i18next';

const ThemeToggleButton = () => {
  // Initialize theme from localStorage or default to 'light'
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Effect to apply the theme to the <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <button onClick={toggleTheme} className="floating-btn theme-btn" aria-label="Toggle theme">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};

const LanguageButton = () => {
  const { i18n } = useTranslation();

  const cycleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'vi' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <button onClick={cycleLanguage} className="floating-btn lang-btn" aria-label="Switch language">
      {i18n.language.toUpperCase()}
    </button>
  );
};

export default function FloatingButtons() {
  return (
    <div className="floating-buttons-container">
      <LanguageButton />
      <ThemeToggleButton />
    </div>
  );
}