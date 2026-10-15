import { useTranslation } from 'react-i18next';

/**
 * Registration modal with optional Treasure Hunt opt-in.
 */
function RegistrationModal({
  event,
  treasureBrands,
  joinTreasureHunt,
  onToggleJoinHunt,
  onConfirm,
  onClose,
}) {
  const { t } = useTranslation();
  const hasHunt = treasureBrands.length > 0;
  const plural = treasureBrands.length !== 1 ? 's' : '';

  return (
    <div className="reg-modal-overlay" onClick={onClose}>
      <div className="reg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reg-modal__header">
          <h2 className="reg-modal__title">{t('registerForEvent')}</h2>
          <button onClick={onClose} className="reg-modal__close" aria-label="Close">✕</button>
        </div>

        <div className="reg-modal__body">
          <div className="reg-modal__event-info">
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--font-lg)' }}>{event.eventName}</h3>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              {event.eventDateStart} · {event.eventLocation}
            </p>
          </div>

          {/* Treasure Hunt toggle */}
          {hasHunt && (
            <div
              className="reg-modal__hunt-toggle"
              onClick={onToggleJoinHunt}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleJoinHunt(); }}
            >
              <div style={{ flex: 1 }}>
                <div className="reg-modal__hunt-label">🎫 {t('treasureHuntBadge')}</div>
                <p className="reg-modal__hunt-desc">
                  {t('treasureHuntDesc')}
                </p>
              </div>
              <div className={`reg-modal__switch ${joinTreasureHunt ? 'reg-modal__switch--on' : ''}`}>
                <div className="reg-modal__switch-thumb" />
              </div>
            </div>
          )}

          {/* Preview brand slots */}
          {joinTreasureHunt && hasHunt && (
            <div className="reg-modal__preview">
              <p style={{ margin: '0 0 8px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('boothsVerified', { count: treasureBrands.length, total: treasureBrands.length })}:
              </p>
              <div className="reg-modal__brands-row">
                {treasureBrands.slice(0, 6).map((b) => (
                  <div key={b.combinedId} className="reg-modal__brand-chip">
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.brandName} className="reg-modal__brand-logo" loading="lazy" />
                    ) : (
                      <span style={{ fontSize: '14px' }}>🏢</span>
                    )}
                  </div>
                ))}
                {treasureBrands.length > 6 && (
                  <div className="reg-modal__brand-chip reg-modal__brand-more">
                    +{treasureBrands.length - 6}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="reg-modal__footer">
          <button onClick={onClose} className="btn btn-secondary btn-flex">{t('cancel')}</button>
          <button onClick={onConfirm} className="btn btn-primary btn-flex">
            {joinTreasureHunt && hasHunt ? `🎫 ${t('registerForEvent')} & ${t('startTreasureHunt')}` : t('registerForEvent')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegistrationModal;
