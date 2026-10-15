import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from './hooks/useTheme';
import { canManage } from './utils/auth';
import Logo from './Logo.png';

function Navigation({ user }) {
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const currentLang = (i18n.language || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en';

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'vi' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const closeMenu = () => setIsMenuOpen(false);

  const isActive = (path) => (location.pathname === path ? 'active' : '');

  return (
    <header className="navigation">
      <div className="nav-inner">
        {/* Brand: Logo + Stacked Corporate Title */}
        <Link to="/" className="nav-brand" onClick={closeMenu}>
          <img src={Logo} alt="TreasureLayout" className="nav-brand-img" />
          <div className="nav-brand-text">
            <span className="nav-brand-title">TREASURE LAYOUT</span>
            <span className="nav-brand-sub">BINH DUONG NEW CITY</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="nav-menu" aria-label="Main Navigation">
          <ul className="nav-links">
            <li>
              <Link to="/" className={`nav-link ${isActive('/')}`} onClick={closeMenu}>
                <svg className="nav-home-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>{t('home', 'Home')}</span>
              </Link>
            </li>
            <li>
              <Link to="/events" className={`nav-link ${isActive('/events')}`} onClick={closeMenu}>
                {t('events', 'Events')}
              </Link>
            </li>
            {canManage(user) && (
              <li>
                <Link to="/brands" className={`nav-link ${isActive('/brands')}`} onClick={closeMenu}>
                  {t('brands', 'Brands')}
                </Link>
              </li>
            )}
            {canManage(user) && (
              <li>
                <Link to="/admin" className={`nav-link ${isActive('/admin')}`} onClick={closeMenu}>
                  {t('users', 'Users')}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Right Section: Language, Theme & CTA Button */}
        <div className="nav-right">
          {/* Language Selector (Desktop / Tablet) */}
          <button
            type="button"
            className="nav-lang-btn nav-hide-mobile"
            onClick={toggleLanguage}
            aria-label="Switch language"
          >
            <svg className="nav-globe-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="nav-lang-code">{currentLang.toUpperCase()}</span>
            <span className="nav-chevron">▾</span>
          </button>

          {/* Theme Toggle (Desktop / Tablet) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="nav-theme-btn nav-hide-mobile"
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Prominent White Pill CTA Button (Login / Profile) */}
          {!user ? (
            <Link to="/login" className="nav-cta-btn" onClick={closeMenu}>
              {t('login', 'Login')}
            </Link>
          ) : (
            <Link
              to="/profile"
              className={`nav-cta-btn nav-cta-profile ${isActive('/profile')}`}
              onClick={closeMenu}
              aria-label="View Profile"
            >
              <span className="nav-user-icon">👤</span>
              <span className="nav-user-name">
                {user.userName || user.name || user.fullName || 'Profile'}
              </span>
            </Link>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className="menu-toggle-btn"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMenuOpen && (
        <div className="nav-mobile-drawer">
          <ul className="nav-mobile-links">
            <li>
              <Link to="/" className={`nav-mobile-link ${isActive('/')}`} onClick={closeMenu}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>{t('home', 'Home')}</span>
              </Link>
            </li>
            <li>
              <Link to="/events" className={`nav-mobile-link ${isActive('/events')}`} onClick={closeMenu}>
                <span>{t('events', 'Events')}</span>
              </Link>
            </li>
            {canManage(user) && (
              <li>
                <Link to="/brands" className={`nav-mobile-link ${isActive('/brands')}`} onClick={closeMenu}>
                  <span>{t('brands', 'Brands')}</span>
                </Link>
              </li>
            )}
            {canManage(user) && (
              <li>
                <Link to="/admin" className={`nav-mobile-link ${isActive('/admin')}`} onClick={closeMenu}>
                  <span>{t('users', 'Users')}</span>
                </Link>
              </li>
            )}
            {/* Quick settings on mobile: Language & Theme toggles */}
            <li className="nav-mobile-tools-item">
              <div className="nav-mobile-tools-grid">
                <button
                  type="button"
                  className="nav-mobile-tool-card"
                  onClick={toggleLanguage}
                  aria-label="Switch language"
                >
                  <span className="nav-mobile-tool-icon">🌐</span>
                  <span>{currentLang === 'vi' ? 'Tiếng Việt (VN)' : 'English (EN)'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="nav-mobile-tool-card"
                  aria-label="Toggle theme"
                >
                  <span className="nav-mobile-tool-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
                  <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

export default Navigation;