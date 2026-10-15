import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import EmptyState from '../EmptyState';
import { getCachedLayoutImage } from '../../storage';

function LayoutImageItem({ img, index, onOpen, canEdit, onReplace, onDelete, t }) {
  const originalUrl = typeof img === 'string' ? img : img?.url;
  const [src, setSrc] = useState(originalUrl);

  useEffect(() => {
    let active = true;
    getCachedLayoutImage(originalUrl).then((cachedSrc) => {
      if (active && cachedSrc) setSrc(cachedSrc);
    });
    return () => { active = false; };
  }, [originalUrl]);

  return (
    <div
      style={{
        position: 'relative', width: 'calc(50% - 6px)', paddingTop: 'calc((50% - 6px) * 9 / 16)',
        backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      <img
        src={src}
        alt={`Event Layout ${index + 1}`}
        onClick={() => onOpen(img, index)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
        loading="lazy"
        decoding="async"
      />
      {canEdit && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 5 }}>
          <label
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px',
              fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}
          >
            ✏️ {t('replaceLayout')}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => onReplace(index, e.target.files[0])}
            />
          </label>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
            style={{
              background: 'rgba(220, 38, 38, 0.85)', border: 'none',
              borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px',
              fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Event layout images grid with admin controls (replace, delete, add new).
 */
function LayoutGallery({
  images,
  canEdit,
  isUploading,
  onOpen,        // (img, index) => void
  onAdd,         // (event) => void  (file input change)
  onReplace,     // (index, file) => void
  onDelete,      // (index) => void
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  return (
    <div style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
      <h2 style={{ fontSize: 'var(--font-xl)', marginBottom: 'var(--space-4)' }}>{t('eventLayouts')}</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        {images.length > 0 ? (
          images.map((img, index) => (
            <LayoutImageItem
              key={index}
              img={img}
              index={index}
              onOpen={onOpen}
              canEdit={canEdit}
              onReplace={onReplace}
              onDelete={onDelete}
              t={t}
            />
          ))
        ) : (
          <EmptyState icon="🗺️" message={t('noLayoutImages')} />
        )}
      </div>

      {canEdit && (
        <>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={onAdd}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={isUploading}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {isUploading ? t('uploading') : t('addNewLayout')}
          </button>
        </>
      )}
    </div>
  );
}

export default LayoutGallery;
