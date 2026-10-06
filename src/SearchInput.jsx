import { useState, useEffect, useRef, memo } from 'react';

/**
 * Standardized Search Input component.
 * Features:
 * - 1-second debounce (sleep time) after keystrokes to prevent database/client overload
 * - Requires at least 3 characters to execute search
 * - Shows visual indicator when input is under 3 characters
 * - Immediate Enter key support for quick search when >= 3 characters
 */
const SearchInput = memo(({ searchTerm, setSearchTerm, placeholder, style, className }) => {
  const [inputValue, setInputValue] = useState(searchTerm || '');
  const timerRef = useRef(null);

  // Sync if parent clears searchTerm externally (e.g. reset filters)
  useEffect(() => {
    if (searchTerm === '' && inputValue.trim().length >= 3) {
      setInputValue('');
    }
  }, [searchTerm]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const trimmed = val.trim();
      if (trimmed.length === 0) {
        setSearchTerm('');
      } else if (trimmed.length >= 3) {
        setSearchTerm(trimmed);
      } else {
        // Under 3 characters: do not search yet to avoid overloading
        setSearchTerm('');
      }
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const trimmed = inputValue.trim();
      if (trimmed.length === 0 || trimmed.length >= 3) {
        setSearchTerm(trimmed);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const isShort = inputValue.trim().length > 0 && inputValue.trim().length < 3;

  return (
    <div style={{ position: 'relative', marginBottom: 'var(--space-4)', ...style }}>
      <input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={className || "input-style"}
        style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }}
        aria-label={placeholder || "Search"}
      />
      {isShort && (
        <span
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            background: 'var(--bg-input)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}
        >
          Min 3 chars
        </span>
      )}
    </div>
  );
});

export default SearchInput;