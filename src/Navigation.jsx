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

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navigation">
      <div className="nav-inner">
        {/* Brand */}
        <Link to="/" className="nav-brand" onClick={closeMenu}>
          <img src={Logo} alt="TreasureLayout" />
          <span>TreasureLayout</span>
        </Link>

        {/* Mobile controls: Language switch + Hamburger menu */}
        <div className="nav-header">
          <button
            type="button"
            className="lang-toggle-btn"
            onClick={toggleLanguage}
            aria-label="Switch language"
          >
            🌐 {currentLang.toUpperCase()}
          </button>
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

        {/* Links */}
        <ul className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
          <li><Link to="/" className={isActive('/')} onClick={closeMenu}>{t('home', 'Home')}</Link></li>
          <li><Link to="/events" className={isActive('/events')} onClick={closeMenu}>{t('events', 'Events')}</Link></li>
          {canManage(user) && (
            <li><Link to="/brands" className={isActive('/brands')} onClick={closeMenu}>{t('brands', 'Brands')}</Link></li>
          )}
          {canManage(user) && (
            <li><Link to="/admin" className={isActive('/admin')} onClick={closeMenu}>{t('users', 'Users')}</Link></li>
          )}
          {!user ? (
            <li><Link to="/login" className={isActive('/login')} onClick={closeMenu}>{t('login', 'Login')}</Link></li>
          ) : (
            <li>
              <Link
                to="/profile"
                className={`user-greeting-btn touchable-opacity ${isActive('/profile')}`}
                onClick={closeMenu}
                aria-label="View Profile"
              >
                <span>Hi, </span>
                <span className="user-name-highlight">
                  {user.userName || user.name || user.fullName}
                </span>
              </Link>
            </li>
          )}
          <li className="nav-desktop-lang">
            <button
              type="button"
              onClick={toggleLanguage}
              className="lang-toggle-btn"
              aria-label="Switch language"
            >
              🌐 {currentLang.toUpperCase()}
            </button>
          </li>
          <li>
            <button onClick={() => { toggleTheme(); closeMenu(); }} className="theme-toggle-btn" aria-label="Toggle theme">
              {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navigation;