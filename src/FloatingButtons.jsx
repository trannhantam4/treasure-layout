import { memo } from 'react';
import './FloatingButtons.css';
import { useTranslation } from 'react-i18next';
import { useTheme } from './hooks/useTheme';

const ThemeToggleButton = memo(() => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className="floating-btn theme-btn" aria-label="Toggle theme">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
});

const LanguageButton = memo(() => {
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
});

export default function FloatingButtons() {
  return (
    <div className="floating-buttons-container">
      <LanguageButton />
      <ThemeToggleButton />
    </div>
  );
}