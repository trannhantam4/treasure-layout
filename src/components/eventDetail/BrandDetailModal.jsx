import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import BrandLogo from '../BrandLogo';
import { modalOverlayStyle, modalCardStyle } from '../../Modal';
import { useTranslation } from 'react-i18next';

const rowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)',
};
const labelStyle = { fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: '500' };
const monoValueStyle = { fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'monospace' };

/**
 * Brand assignment detail modal (rank, booth position, QR code, treasure/remove actions).
 * Position-editing state lives here instead of in EventDetail.
 */
function BrandDetailModal({
  brand,
  user,
  canEdit,
  onRegisterQrCanvas,
  onClose,
  onBrandChange,        // setState-style updater for the selected brand
  onUpdateRank,         // (combinedId, rank) => Promise
  onUpdatePosition,     // (combinedId, position) => Promise<boolean>
  onToggleTreasure,     // (combinedId, current) => Promise
  onRemove,             // (combinedId) => Promise<boolean> (handles confirmation)
  onDownloadQR,         // (combinedId, brandName) => void
  onReloadQR,           // (combinedId) => void
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editPosition, setEditPosition] = useState(brand.position || '');
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionSaved, setPositionSaved] = useState(false);

  const isMyBrand = Boolean(
    user &&
      ((user.brandId && String(user.brandId) === String(brand.brandId)) ||
        (user.company &&
          brand.brandName &&
          user.company.trim().toLowerCase() === brand.brandName.trim().toLowerCase()))
  );
  const canViewVisitors = Boolean(canEdit || isMyBrand);

  const positionUnchanged = editPosition.trim() === (brand.position || '');

  const savePosition = async () => {
    setSavingPosition(true);
    const ok = await onUpdatePosition(brand.combinedId, editPosition.trim());
    setSavingPosition(false);
    if (ok) {
      setPositionSaved(true);
      setTimeout(() => setPositionSaved(false), 2000);
    }
  };

  return (
    <div style={modalOverlayStyle({ zIndex: 9999, background: 'rgba(0, 0, 0, 0.75)', blur: 'blur(8px)' })}>
      <div className="modal-container" style={{ ...modalCardStyle({ maxWidth: '440px', shadow: 'var(--shadow-glow)' }), display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <BrandLogo url={brand.logoUrl} name={brand.brandName} size={48} />
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>{brand.brandName}</h3>
              <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{brand.fieldOfWork}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: 'var(--font-lg)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('rankLabel')}</span>
            {canEdit ? (
              <select
                aria-label="Edit brand rank"
                value={brand.rank}
                onChange={async (e) => {
                  const newRank = e.target.value;
                  await onUpdateRank(brand.combinedId, newRank);
                  onBrandChange((prev) => ({ ...prev, rank: newRank }));
                }}
                style={{
                  fontSize: 'var(--font-sm)', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                {['gold', 'silver', 'bronze', 'standard'].map((r) => (
                  <option key={r} value={r} style={{ background: 'var(--bg-card-solid)', color: 'var(--text-primary)' }}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {brand.rank}
              </span>
            )}
          </div>

          <div style={{ ...rowStyle, gap: 'var(--space-2)' }}>
            <span style={{ ...labelStyle, flexShrink: 0 }}>{t('boothPositionLabel')}</span>
            {canEdit ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  aria-label="Edit brand booth position"
                  placeholder="e.g. A-12, Booth 3"
                  value={editPosition}
                  onChange={(e) => { setEditPosition(e.target.value); setPositionSaved(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') savePosition(); }}
                  style={{
                    fontSize: 'var(--font-sm)', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', width: '120px',
                  }}
                />
                <button
                  type="button"
                  onClick={savePosition}
                  disabled={savingPosition || positionUnchanged}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '4px 8px', fontSize: '11px', minWidth: '46px', opacity: positionUnchanged ? 0.5 : 1 }}
                >
                  {savingPosition ? '...' : (positionSaved ? '✓' : t('save'))}
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)' }}>
                {brand.position || '—'}
              </span>
            )}
          </div>

          {canEdit && (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>Brand ID</span>
                <span style={monoValueStyle}>{brand.brandId}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Assignment ID</span>
                <span style={monoValueStyle}>{brand.combinedId}</span>
              </div>
            </>
          )}
        </div>

        {/* QR code — ONLY for admin/manager */}
        {canEdit && brand.isTreasureHolder && (
          <div style={{
            padding: 'var(--space-4)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
          }}>
            <canvas
              ref={(el) => {
                if (el) {
                  onRegisterQrCanvas?.(brand.combinedId, el);
                  QRCode.toCanvas(el, brand.combinedId, { width: 160, margin: 1 }, (err) => {
                    if (err) console.error('QR modal draw error:', err);
                  });
                }
              }}
              style={{ borderRadius: 'var(--radius-md)', background: '#fff', padding: '6px' }}
            />
            <div style={{ textAlign: 'center', width: '100%' }}>
              <p style={{ margin: '0 0 2px', fontSize: 'var(--font-xs)', fontWeight: '600' }}>{t('qrCodeTreasureHolder')}</p>
              <p style={{ margin: '0 0 var(--space-2)', fontSize: '10px', color: 'var(--text-muted)' }}>
                Encodes: <code>{brand.combinedId}</code>
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                <button
                  onClick={() => onDownloadQR(brand.combinedId, brand.brandName)}
                  className="btn btn-info btn-sm"
                  style={{ fontSize: '10px', padding: '4px 8px' }}
                >
                  {t('downloadPngBtn')}
                </button>
                <button
                  onClick={() => onReloadQR(brand.combinedId)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '10px', padding: '4px 8px' }}
                >
                  {t('reloadQrBtn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Booth Visitors button (for brand members & admins/managers) */}
        {canViewVisitors && (
          <button
            type="button"
            onClick={() => {
              onClose();
              const params = new URLSearchParams();
              if (brand.brandId) params.set('brandId', brand.brandId);
              if (brand.eventId) params.set('eventId', brand.eventId);
              navigate(`/brand-visitors?${params.toString()}`);
            }}
            className="btn btn-primary btn-sm"
            style={{ width: '100%', marginBottom: canEdit ? 'var(--space-3)' : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>👥</span>
            <span>{t('viewMyBrandVisitorsBtn', { brand: brand.brandName, defaultValue: `View ${brand.brandName} Booth Visitors` })}</span>
          </button>
        )}

        {/* Admin management actions */}
        {canEdit && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', marginTop: 'auto' }}>
            <button
              onClick={async () => {
                const next = !brand.isTreasureHolder;
                await onToggleTreasure(brand.combinedId, brand.isTreasureHolder);
                onBrandChange((prev) => ({ ...prev, isTreasureHolder: next }));
              }}
              className={`btn btn-sm ${brand.isTreasureHolder ? 'btn-warning' : 'btn-ghost'}`}
              style={{ flex: 1 }}
            >
              {brand.isTreasureHolder ? t('removeTreasureBtn') : t('setTreasureBtn')}
            </button>
            <button
              onClick={async () => {
                const removed = await onRemove(brand.combinedId);
                if (removed) onClose();
              }}
              className="btn btn-danger btn-sm"
              style={{ flex: 1 }}
            >
              {t('removeBrandBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrandDetailModal;
