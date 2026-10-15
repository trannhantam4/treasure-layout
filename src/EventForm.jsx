import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const EventForm = memo(({
  formData,
  onFormChange,
  onKeyviewUpload,
  onLayoutUpload,
  removeLayoutImage,
  isUploadingKeyview,
  isUploadingLayout,
  onSubmit,
  onCancel,
  isSaving,
  submitText,
  cancelText,
}) => {
  const { t } = useTranslation();
  const effectiveSubmitText = submitText || t('save');
  const effectiveCancelText = cancelText || t('cancel');

  return (
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-column">
        <input name="eventName" placeholder={t('eventNamePlaceholder')} value={formData.eventName} onChange={onFormChange} className="input-style" />
        <input name="eventHostest" placeholder={t('hostPlaceholder')} value={formData.eventHostest} onChange={onFormChange} className="input-style" />
        <label className="form-label">{t('setupDate')}</label>
        <input name="setUpDate" type="date" value={formData.setUpDate} onChange={onFormChange} className="input-style" />
        <label className="form-label">{t('startDate')}</label>
        <input name="eventDateStart" type="date" value={formData.eventDateStart} onChange={onFormChange} className="input-style" />
        <label className="form-label">{t('endDate')}</label>
        <input name="eventDateEnd" type="date" value={formData.eventDateEnd} onChange={onFormChange} className="input-style" />
        <label className="form-label">{t('cleanupDate')}</label>
        <input name="CleanUpDate" type="date" value={formData.CleanUpDate} onChange={onFormChange} className="input-style" />
        <input name="eventLocation" placeholder={t('locationPlaceholder')} value={formData.eventLocation} onChange={onFormChange} className="input-style" />
        <input name="PIC" placeholder={t('picPlaceholder')} value={formData.PIC} onChange={onFormChange} className="input-style" />
        <input name="attendees" type="number" placeholder={t('attendeesPlaceholder')} value={formData.attendees} onChange={onFormChange} className="input-style" />
        <textarea name="note" placeholder={t('notesPlaceholder')} value={formData.note} onChange={onFormChange} className="input-style" style={{ minHeight: '80px', resize: 'vertical' }} />
      </div>
      <div className="form-column">
        <label className="form-label form-label-bold">{t('keyviewImage')}</label>
        {formData.imageLink && <img src={formData.imageLink} alt="Keyview Preview" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />}
        <input type="file" accept="image/*" onChange={onKeyviewUpload} className="input-style" disabled={isUploadingKeyview} />
        {isUploadingKeyview && <span className="upload-status">{t('uploadingKeyview')}</span>}

        <label className="form-label form-label-bold">{t('layoutImages')}</label>
        {formData.layoutImages && formData.layoutImages.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {formData.layoutImages.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', width: 'calc(50% - 4px)', paddingTop: 'calc((50% - 4px) * 9 / 16)', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={typeof img === 'object' ? img.url : img} alt={`Layout Preview ${idx}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => removeLayoutImage(idx)} className="btn-icon-delete">✕</button>
              </div>
            ))}
          </div>
        )}
        <input type="file" accept="image/*" onChange={onLayoutUpload} className="input-style" disabled={isUploadingLayout} />
        {isUploadingLayout && <span className="upload-status">{t('uploadingLayout')}</span>}
      </div>
      <div className="form-full-width">
        <div className="btn-group">
          <button type="button" onClick={onCancel} className="btn btn-danger btn-flex">{effectiveCancelText}</button>
          <button type="submit" disabled={isSaving} className="btn btn-success btn-flex">{isSaving ? t('saving') : effectiveSubmitText}</button>
        </div>
      </div>
    </form>
  );
});

export default EventForm;