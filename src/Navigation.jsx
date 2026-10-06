import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { canManage } from './utils/auth';
import Logo from './Logo.png';

function Navigation({ user }) {
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

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

        {/* Mobile hamburger */}
        <div className="nav-header">
          <button
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
          <li><Link to="/" className={isActive('/')} onClick={closeMenu}>Home</Link></li>
          <li><Link to="/events" className={isActive('/events')} onClick={closeMenu}>Events</Link></li>
          {canManage(user) && (
            <li><Link to="/brands" className={isActive('/brands')} onClick={closeMenu}>Brands</Link></li>
          )}
          {canManage(user) && (
            <li><Link to="/admin" className={isActive('/admin')} onClick={closeMenu}>Users</Link></li>
          )}
          {!user ? (
            <li><Link to="/login" className={isActive('/login')} onClick={closeMenu}>Login</Link></li>
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