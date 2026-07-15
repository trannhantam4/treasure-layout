import React from 'react';

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 style={{ marginTop: '20px', marginBottom: '20px' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default Modal;