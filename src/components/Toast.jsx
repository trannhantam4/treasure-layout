import { useState, useEffect, memo } from 'react';
import '../utils/toast'; // ensure window.alert interceptor is loaded

const ICONS = {
  success: '✨',
  error: '⚠️',
  warning: '⚡',
  info: '✦',
};

const TITLES = {
  success: 'SUCCESS',
  error: 'NOTICE',
  warning: 'ATTENTION',
  info: 'TREASURE LAYOUT',
};

const BORDER_COLORS = {
  success: 'var(--border-gold-strong, #dfb76c)',
  error: 'rgba(239, 68, 68, 0.65)',
  warning: 'rgba(245, 158, 11, 0.65)',
  info: 'var(--border-gold, rgba(223, 183, 108, 0.4))',
};

const BADGE_BG = {
  success: 'linear-gradient(135deg, rgba(223, 183, 108, 0.25), rgba(52, 211, 153, 0.2))',
  error: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15))',
  warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(180, 83, 9, 0.15))',
  info: 'linear-gradient(135deg, rgba(223, 183, 108, 0.25), rgba(179, 134, 43, 0.15))',
};

function ToastItem({ toast, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration || 3800);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const handleManualDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 250);
  };

  const type = toast.type || 'info';

  return (
    <div
      role="alert"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: '14px 18px',
        background: 'var(--bg-card-solid)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${BORDER_COLORS[type] || 'var(--border-gold)'}`,
        borderRadius: 'var(--radius-lg, 16px)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45), 0 0 24px rgba(223, 183, 108, 0.18)',
        color: 'var(--text-primary)',
        width: '100%',
        maxWidth: '420px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'auto',
        transform: leaving ? 'translateY(-12px) scale(0.96)' : 'translateY(0) scale(1)',
        opacity: leaving ? 0 : 1,
        transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: 'toastSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {/* Icon badge */}
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: BADGE_BG[type] || BADGE_BG.info,
          border: `1px solid ${BORDER_COLORS[type]}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        }}
      >
        {ICONS[type] || '✦'}
      </div>

      {/* Message content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--gold-light, #dfb76c)',
            marginBottom: '3px',
          }}
        >
          {TITLES[type] || 'NOTIFICATION'}
        </div>
        <div
          style={{
            fontSize: 'var(--font-sm, 13px)',
            fontWeight: 500,
            lineHeight: 1.45,
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
        >
          {toast.message}
        </div>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={handleManualDismiss}
        aria-label="Close notification"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '2px 4px',
          lineHeight: 1,
          borderRadius: 'var(--radius-sm)',
          transition: 'color var(--duration-fast)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold-light)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        ✕
      </button>

      {/* Progress countdown bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2.5px',
          background: 'var(--gradient-accent, #dfb76c)',
          width: '100%',
          transformOrigin: 'left',
          animation: `toastProgress ${toast.duration || 3800}ms linear forwards`,
        }}
      />
    </div>
  );
}

const ToastContainer = memo(function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToastEvent = (e) => {
      if (e.detail) {
        setToasts((prev) => [e.detail, ...prev].slice(0, 5)); // Keep max 5 visible
      }
    };

    window.addEventListener('app:toast', handleToastEvent);
    return () => window.removeEventListener('app:toast', handleToastEvent);
  }, []);

  const handleDismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: 'calc(100% - 32px)',
        maxWidth: '420px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  );
});

export default ToastContainer;
