import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Event keyview image + event info + register / admin action buttons.
 */
function EventInfoHeader({
  event,
  keyviewImage,
  canEdit,
  user,
  isRegistered,
  displayRegisteredCount,
  isUploadingKeyview,
  onKeyviewUpload,
  onRegister,
  onUpdate,
  onDelete,
}) {
  const { t } = useTranslation();
  const keyviewFileInputRef = useRef(null);

  return (
    <>
      {/* Main event keyview image */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
        <img
          src={keyviewImage}
          alt={event.eventName}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {canEdit && (
          <>
            <input
              type="file"
              accept="image/*"
              ref={keyviewFileInputRef}
              onChange={onKeyviewUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => keyviewFileInputRef.current.click()}
              disabled={isUploadingKeyview}
              style={{
                position: 'absolute', bottom: 'var(--space-3)', right: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
                border: '1px solid rgba(255,255,255,0.4)', cursor: 'pointer',
                fontSize: 'var(--font-sm)', fontWeight: '500', backdropFilter: 'blur(8px)',
              }}
            >
              {isUploadingKeyview ? t('uploading') : t('changeKeyview')}
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 'var(--space-4)', textAlign: 'left' }}>
        <h1 style={{ fontSize: 'var(--font-3xl)', margin: '0 0 var(--space-2) 0' }}>{event.eventName}</h1>
        <p style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>{t('hostedBy')} {event.eventHostest}</p>
        <p style={{ fontSize: 'var(--font-md)', color: 'var(--accent)', fontWeight: '600', marginBottom: 'var(--space-3)' }}>
          {event.eventDateStart} to {event.eventDateEnd}
        </p>
        <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>{t('locationLabel')}</strong> {event.eventLocation}</p>
        <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>{t('setupLabel')}</strong> {event.setUpDate} | <strong>{t('cleanupLabel')}</strong> {event.CleanUpDate}</p>
        <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>{t('picLabel')}</strong> {event.PIC}</p>
        <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>{t('registeredLabel')}</strong> {displayRegisteredCount} / {event.attendees > 0 ? event.attendees : '∞'}</p>
        <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}><strong>{t('noteLabel')}</strong> {event.note}</p>

        <button
          onClick={onRegister}
          className={`btn ${isRegistered ? 'btn-danger' : 'btn-primary'}`}
          style={{ width: '100%', padding: 'var(--space-3)', fontSize: 'var(--font-md)' }}
        >
          {user ? (isRegistered ? t('unregisterFromEvent') : t('registerForEvent')) : t('loginToRegister')}
        </button>

        {/* Admin action buttons */}
        {canEdit && (
          <div className="btn-group" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
            <button onClick={onUpdate} className="btn btn-warning btn-flex">{t('updateEvent')}</button>
            <button onClick={onDelete} className="btn btn-danger btn-flex">{t('deleteEvent')}</button>
          </div>
        )}
      </div>
    </>
  );
}

export default EventInfoHeader;
