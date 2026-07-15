import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

function Navigation({ user }) {
  const [theme, setTheme] = useState('dark');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="navigation">
      <div className="nav-header">
        <button className="menu-toggle-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle Menu">
          ☰
        </button>
      </div>
      <ul className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
        <li><Link to="/" onClick={closeMenu}>Home</Link></li>
        <li><Link to="/events" onClick={closeMenu}>Events</Link></li>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <li><Link to="/admin" onClick={closeMenu}>User Manager</Link></li>
        )}
        <li><Link to="/profile" onClick={closeMenu}>Profile</Link></li>
        {!user ? (
          <li><Link to="/login" onClick={closeMenu}>Login</Link></li>
        ) : (
          <li><span className="user-greeting">Hi, {user.name}</span></li>
        )}
        <li>
          <button onClick={() => { toggleTheme(); closeMenu(); }} className="theme-toggle-btn">
            {theme === 'light' ? 'Dark' : 'Light'} Mode
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default Navigation;