import { useState, useEffect, useCallback, memo } from 'react';
import { modalOverlayStyle, modalCardStyle } from '../Modal';
import { useTranslation } from 'react-i18next';

const VARIANT_BUTTON_CLASS = {
  danger: 'btn btn-danger',
  primary: 'btn btn-primary',
  warning: 'btn btn-warning',
};

const VARIANT_BORDER = {
  danger: 'rgba(239, 68, 68, 0.45)',
  warning: 'rgba(233, 71, 14, 0.45)',
  primary: 'var(--border-gold-strong, #0284c7)',
};

const VARIANT_BADGE_BG = {
  danger: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(185, 28, 28, 0.12))',
  warning: 'linear-gradient(135deg, rgba(233, 71, 14, 0.22), rgba(217, 119, 6, 0.12))',
  primary: 'linear-gradient(135deg, rgba(2, 132, 199, 0.22), rgba(56, 189, 248, 0.12))',
};

/**
 * Global ConfirmDialogContainer mounted at root of App.
 * Listens for 'app:confirm' events and renders a high-end luxury confirmation modal.
 */
const ConfirmDialogContainer = memo(function ConfirmDialogContainer() {
  const { t } = useTranslation();
  const [currentDialog, setCurrentDialog] = useState(null);

  useEffect(() => {
    const handleConfirmEvent = (e) => {
      if (e.detail) {
        setCurrentDialog(e.detail);
      }
    };

    window.addEventListener('app:confirm', handleConfirmEvent);
    return () => window.removeEventListener('app:confirm', handleConfirmEvent);
  }, []);

  const handleAction = useCallback((result) => {
    if (currentDialog) {
      currentDialog.resolve(result);
      setCurrentDialog(null);
    }
  }, [currentDialog]);

  // Keyboard accessibility: ESC cancels
  useEffect(() => {
    if (!currentDialog) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAction(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDialog, handleAction]);

  if (!currentDialog) return null;

  const variant = currentDialog.confirmVariant || 'danger';

  return (
    <div
      style={modalOverlayStyle({ zIndex: 100000 })}
      onClick={() => handleAction(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          ...modalCardStyle({ maxWidth: '440px', padding: 'var(--space-6)' }),
          border: `1px solid ${VARIANT_BORDER[variant] || 'var(--border-gold)'}`,
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(2, 132, 199, 0.2)',
          animation: 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: VARIANT_BADGE_BG[variant] || VARIANT_BADGE_BG.primary,
              border: `1px solid ${VARIANT_BORDER[variant] || 'var(--border-gold)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}
          >
            {currentDialog.icon || '⚠️'}
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--accent, #0284c7)',
              }}
            >
              {currentDialog.title || t('confirmationBadge')}
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--font-lg, 18px)',
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-primary)',
              }}
            >
              {t('confirmActionTitle')}
            </h3>
          </div>
        </div>

        {/* Message body */}
        <p
          style={{
            margin: '0 0 var(--space-6)',
            fontSize: 'var(--font-base, 15px)',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          {currentDialog.message}
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleAction(false)}
            style={{ minWidth: '100px' }}
          >
            {currentDialog.cancelText || t('cancel')}
          </button>
          <button
            type="button"
            className={VARIANT_BUTTON_CLASS[variant] || 'btn btn-danger'}
            onClick={() => handleAction(true)}
            autoFocus
            style={{ minWidth: '110px' }}
          >
            {currentDialog.confirmText || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ConfirmDialogContainer;
