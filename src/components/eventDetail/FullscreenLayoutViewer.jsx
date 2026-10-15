import { useState, useEffect } from 'react';
import pinImages from './pinImages';
import { useTranslation } from 'react-i18next';
import { getCachedLayoutImage } from '../../storage';

const pinButtonStyle = (active) => ({
  background: active ? 'var(--accent)' : 'transparent',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: '4px',
  padding: '3px',
  cursor: 'pointer',
});

const PIN_TYPES = [
  { type: 'default', title: 'Default Pin' },
  { type: 'star', title: 'Star Pin' },
  { type: 'logo', title: 'Logo Pin' },
];

/**
 * Fullscreen layout image viewer with pin toolbar (admin/manager) and drag-to-move pins.
 * State/handlers come from the usePinEditor hook (`editor`).
 */
function FullscreenLayoutViewer({ editor, canEdit, onDeleteImage }) {
  const { t } = useTranslation();
  const {
    fullscreenImage, fullscreenImageIndex,
    selectedPinType, setSelectedPinType,
    pinSize, setPinSize,
    draggingPinIndex, hasDraggedRef, imageContainerRef,
    closeViewer, handleFullscreenClick, handlePinDelete,
    handlePinMouseDown, handlePinTouchStart,
    handleMouseUp, handleMouseMove, handleTouchMove,
  } = editor;

  const [displaySrc, setDisplaySrc] = useState(fullscreenImage?.url || '');

  useEffect(() => {
    let active = true;
    if (fullscreenImage?.url) {
      setDisplaySrc(fullscreenImage.url);
      getCachedLayoutImage(fullscreenImage.url).then((cached) => {
        if (active && cached) setDisplaySrc(cached);
      });
    }
    return () => { active = false; };
  }, [fullscreenImage?.url]);

  if (!fullscreenImage) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 9999,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '16px', boxSizing: 'border-box', overflow: 'hidden',
      }}
      onClick={() => {
        if (draggingPinIndex === null && !hasDraggedRef.current) closeViewer();
      }}
    >
      {canEdit && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '16px', left: '16px', zIndex: 10,
            background: 'rgba(0,0,0,0.75)', borderRadius: '8px', padding: '8px 12px',
            display: 'flex', flexDirection: 'column', gap: '8px',
            backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)',
            maxWidth: 'calc(100vw - 120px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600 }}>Pin:</span>
            {PIN_TYPES.map(({ type, title }) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedPinType(type)}
                style={pinButtonStyle(selectedPinType === type)}
                title={title}
              >
                <img src={pinImages[type]} alt={title} style={{ width: '22px', height: '22px', display: 'block' }} />
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', fontWeight: '500' }}>Size:</label>
            <input
              type="range"
              min="16" max="50"
              value={pinSize}
              onChange={(e) => setPinSize(Number(e.target.value))}
              style={{ width: '80px', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 10 }}>
        {canEdit && fullscreenImageIndex !== null && (
          <button
            style={{
              background: 'rgba(220, 38, 38, 0.85)', color: '#fff',
              border: 'none', borderRadius: '8px', padding: '6px 12px',
              fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
              backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { e.stopPropagation(); onDeleteImage(fullscreenImageIndex); }}
          >
            {t('deleteImageBtn')}
          </button>
        )}
        <button
          style={{
            background: 'rgba(255,255,255,0.2)', color: '#fff',
            border: 'none', borderRadius: '50%', width: '36px', height: '36px',
            fontSize: '18px', cursor: 'pointer', display: 'flex',
            justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { e.stopPropagation(); closeViewer(); }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Tight Image Wrapper — ensures pins are mapped 100% to visible image on all screen sizes */}
      <div
        ref={imageContainerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (draggingPinIndex === null && !hasDraggedRef.current) handleFullscreenClick(e);
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        style={{
          position: 'relative',
          display: 'inline-block',
          maxWidth: '94vw',
          maxHeight: '82vh',
          lineHeight: 0,
          userSelect: 'none',
          touchAction: 'none',
          cursor: canEdit && draggingPinIndex === null ? 'crosshair' : (draggingPinIndex !== null ? 'grabbing' : 'default'),
        }}
      >
        <img
          src={displaySrc}
          alt="Fullscreen Layout"
          draggable={false}
          style={{
            display: 'block',
            maxWidth: '94vw',
            maxHeight: '82vh',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '6px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            pointerEvents: 'none',
          }}
        />
        {fullscreenImage.pins?.map((pin, index) => {
          const style = {
            position: 'absolute',
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: 'translate(-50%, -50%)',
            width: `${pinSize}px`,
            height: `${pinSize}px`,
            cursor: canEdit ? (draggingPinIndex === index ? 'grabbing' : 'grab') : 'default',
            pointerEvents: 'auto',
            touchAction: 'none',
          };
          if (pin.type === 'star') {
            style.filter = 'drop-shadow(0px 0px 3px rgba(0, 0, 0, 0.9))';
          }
          return (
            <img
              key={index}
              src={pinImages[pin.type] || pinImages.default}
              alt="Pin"
              draggable={false}
              onMouseDown={canEdit ? (e) => handlePinMouseDown(e, index) : undefined}
              onTouchStart={canEdit ? (e) => handlePinTouchStart(e, index) : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (hasDraggedRef.current) return;
                // handlePinDelete asks for confirmation itself
                if (canEdit) handlePinDelete(e, index);
              }}
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
}

export default FullscreenLayoutViewer;
