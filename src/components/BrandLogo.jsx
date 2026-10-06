import { memo } from 'react';

/**
 * Reusable brand logo thumbnail with 🏢 fallback icon.
 * Replaces near-duplicate logo blocks across BrandManager, BrandFormModal,
 * AssignBrandModal, EventDetail, StampTicket, QRScanModal.
 */
const BrandLogo = memo(({ url, name, size = 40 }) => {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        decoding="async"
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: 'var(--radius-md)',
          backgroundColor: '#fff',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-input)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.5),
        flexShrink: 0,
      }}
    >
      🏢
    </div>
  );
});

export default BrandLogo;
