import React from 'react';

function SearchInput({ searchTerm, setSearchTerm, placeholder }) {
  return (
    <input type="text" placeholder={placeholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-style" style={{ marginBottom: '16px' }} />
  );
}

export default SearchInput;