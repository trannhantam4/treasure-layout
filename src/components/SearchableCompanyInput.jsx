import { useState, useEffect, useRef, memo } from 'react';

/**
 * Searchable company autocomplete dropdown with brand logos.
 * Features:
 * - 1-second debounce (sleep time) when typing before searching/filtering
 * - Requires at least 3 characters to execute brand search
 * - Clear feedback during debounce and under-length states
 */
const SearchableCompanyInput = memo(({ value, onChange, brands }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const [debouncedQuery, setDebouncedQuery] = useState(value || '');
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setSearch(value || '');
    setDebouncedQuery(value || '');
  }, [value]);

  useEffect(() => {
    const clickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSelect = (brandName) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSearch(brandName);
    setDebouncedQuery(brandName);
    onChange(brandName);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    setIsOpen(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setDebouncedQuery(val.trim());
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setDebouncedQuery(search.trim());
    }
  };

  const trimmedSearch = search.trim();
  const isShort = trimmedSearch.length > 0 && trimmedSearch.length < 3;
  const isPending = trimmedSearch.length >= 3 && debouncedQuery !== trimmedSearch;
  const hasEnoughChars = debouncedQuery.length >= 3;

  const filtered = hasEnoughChars
    ? brands.filter((b) =>
        b.brandName.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : [];

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor="company" className="form-label form-label-bold">Company</label>
      <div style={{ position: 'relative' }}>
        <input
          id="company"
          type="text"
          placeholder="Type to search or add company..."
          value={search}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          className="input-style"
          style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
          autoComplete="off"
          required
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

      {isOpen && trimmedSearch.length > 0 && (
        <div style={dropdownContainerStyle}>
          {isShort ? (
            <div style={{ ...itemStyle, color: 'var(--text-secondary)', cursor: 'default' }}>
              Type at least 3 characters to search...
            </div>
          ) : isPending ? (
            <div style={{ ...itemStyle, color: 'var(--text-secondary)', cursor: 'default' }}>
              Searching in 1s...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((b) => (
              <div
                key={b.brandId}
                onClick={() => handleSelect(b.brandName)}
                className="suggestion-item"
                style={itemStyle}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {b.logoUrl ? (
                    <img
                      src={b.logoUrl}
                      alt={b.brandName}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '14px' }}>🏢</span>
                  )}
                  <span>{b.brandName}</span>
                </div>
              </div>
            ))
          ) : (
            <div
              onClick={() => setIsOpen(false)}
              style={{ ...itemStyle, color: 'var(--text-secondary)', cursor: 'default' }}
            >
              Add custom company: "<strong>{search}</strong>"
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const dropdownContainerStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 1000,
  marginTop: '4px',
  background: 'var(--bg-card-solid)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-glow)',
  maxHeight: '200px',
  overflowY: 'auto',
};

const itemStyle = {
  padding: 'var(--space-3) var(--space-4)',
  cursor: 'pointer',
  fontSize: 'var(--font-sm)',
  transition: 'background var(--duration-fast) var(--ease-out)',
  borderBottom: '1px solid var(--border)',
};

export default SearchableCompanyInput;
