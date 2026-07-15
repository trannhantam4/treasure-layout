import React from 'react';

function EventForm({
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
  submitText = 'Save',
  cancelText = 'Cancel',
}) {
  return (
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-column">
        <input name="eventName" placeholder="Event Name" value={formData.eventName} onChange={onFormChange} className="input-style" />
        <input name="eventHostest" placeholder="Host" value={formData.eventHostest} onChange={onFormChange} className="input-style" />
        <label className="form-label">Setup Date</label>
        <input name="setUpDate" type="date" value={formData.setUpDate} onChange={onFormChange} className="input-style" />
        <label className="form-label">Start Date</label>
        <input name="eventDateStart" type="date" value={formData.eventDateStart} onChange={onFormChange} className="input-style" />
        <label className="form-label">End Date</label>
        <input name="eventDateEnd" type="date" value={formData.eventDateEnd} onChange={onFormChange} className="input-style" />
        <label className="form-label">Cleanup Date</label>
        <input name="CleanUpDate" type="date" value={formData.CleanUpDate} onChange={onFormChange} className="input-style" />
        <input name="eventLocation" placeholder="Location" value={formData.eventLocation} onChange={onFormChange} className="input-style" />
        <input name="PIC" placeholder="PIC (Person in Charge)" value={formData.PIC} onChange={onFormChange} className="input-style" />
        <input name="attendees" type="number" placeholder="Attendees" value={formData.attendees} onChange={onFormChange} className="input-style" />
        <textarea name="note" placeholder="Notes" value={formData.note} onChange={onFormChange} className="input-style" style={{ minHeight: '80px', resize: 'vertical' }} />
      </div>
      <div className="form-column">
        <label className="form-label form-label-bold">Keyview Image</label>
        {formData.imageLink && <img src={formData.imageLink} alt="Keyview Preview" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />}
        <input type="file" accept="image/*" onChange={onKeyviewUpload} className="input-style" disabled={isUploadingKeyview} />
        {isUploadingKeyview && <span className="upload-status">Uploading Keyview...</span>}

        <label className="form-label form-label-bold">Layout Images</label>
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
        {isUploadingLayout && <span className="upload-status">Uploading Layout...</span>}
      </div>
      <div className="form-full-width">
        <div className="btn-group">
          <button type="button" onClick={onCancel} className="btn btn-danger btn-flex">{cancelText}</button>
          <button type="submit" disabled={isSaving} className="btn btn-success btn-flex">{isSaving ? 'Saving...' : submitText}</button>
        </div>
      </div>
    </form>
  );
}

export default EventForm;