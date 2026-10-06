import { memo } from 'react';

const Modal = memo(({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-gold)', paddingBottom: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-xl)', fontFamily: 'var(--font-serif)', letterSpacing: '0.04em', color: 'var(--gold-light)' }}>{title}</h2>
          <button onClick={onClose} className="btn-ghost" style={{ border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--gold-light)', opacity: 0.8 }} aria-label="Close modal">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
});

/**
 * Shared modal style constants.
 * Replaces exact-duplicate overlayStyle/cardStyle/closeBtnStyle across
 * BrandFormModal, AssignBrandModal, QRScanModal, OnboardingModal, EventDetail.
 */
export const modalOverlayStyle = (options = {}) => ({
  position: 'fixed', inset: 0,
  zIndex: options.zIndex || 2000,
  background: options.background || 'rgba(0, 0, 0, 0.82)',
  backdropFilter: options.blur || 'blur(12px)',
  WebkitBackdropFilter: options.blur || 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'var(--space-4)',
});

export const modalCardStyle = (options = {}) => ({
  width: '100%',
  maxWidth: options.maxWidth || '520px',
  background: 'var(--bg-card-solid)',
  border: '1px solid var(--border-gold)',
  borderRadius: 'var(--radius-xl)',
  padding: options.padding || 'var(--space-6)',
  boxShadow: options.shadow || 'var(--shadow-lg), 0 0 32px rgba(223, 183, 108, 0.12)',
  boxSizing: 'border-box',
  maxHeight: options.maxHeight || '90vh',
  overflowY: options.overflow || 'auto',
});

export const modalCloseBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1.2rem', color: 'var(--gold-light)', opacity: 0.8, padding: '4px',
};

export default Modal;