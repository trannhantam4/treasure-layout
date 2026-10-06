import { useState, useEffect, memo } from 'react';
import { uploadImageToImgBB } from './Event';
import BrandLogo from './components/BrandLogo';
import { modalOverlayStyle, modalCardStyle, modalCloseBtnStyle } from './Modal';

const EMPTY_FORM = {
  brandName: '',
  fieldOfWork: '',
  address: '',
  phone: '',
  companyEmail: '',
  logoUrl: '',
};

const BrandFormModal = memo(({ onClose, onSubmit, initial = null, prefill = null, saving }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) {
      setForm({
        brandName:    initial.brandName    || '',
        fieldOfWork:  initial.fieldOfWork  || '',
        address:      initial.address      || '',
        phone:        initial.phone        || '',
        companyEmail: initial.companyEmail || '',
        logoUrl:      initial.logoUrl      || '',
      });
    } else if (prefill) {
      setForm({
        ...EMPTY_FORM,
        brandName: prefill.company  || '',
        address:   prefill.address  || '',
        phone:     prefill.phone    || '',
      });
    }
  }, [initial, prefill]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    setError('');
    try {
      const url = await uploadImageToImgBB(file);
      setForm((prev) => ({ ...prev, logoUrl: url }));
    } catch (err) {
      setError(err.message || 'Logo upload failed.');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.brandName || !form.fieldOfWork) {
      setError('Brand Name and Field of Work are required.');
      return;
    }
    setError('');
    onSubmit(form);
  };

  return (
    <div style={modalOverlayStyle()} onClick={onClose}>
      <div style={modalCardStyle({ maxWidth: '520px' })} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>{initial ? 'Edit Brand' : 'Create New Brand'}</h2>
          <button onClick={onClose} style={modalCloseBtnStyle} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
            <BrandLogo url={form.logoUrl} name="logo" size={72} />
            <div style={{ flex: 1 }}>
              <label htmlFor="logoUpload" className="form-label form-label-bold">Logo Image</label>
              <input
                id="logoUpload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                style={{ display: 'block', marginTop: 'var(--space-1)', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}
              />
              {uploadingLogo && <span className="upload-status">Uploading...</span>}
            </div>
          </div>

          <div>
            <label htmlFor="brandName" className="form-label form-label-bold">Brand Name *</label>
            <input id="brandName" name="brandName" value={form.brandName} onChange={handleChange} className="input-style" style={{ margin: 0 }} placeholder="TechCo" required />
          </div>
          <div>
            <label htmlFor="fieldOfWork" className="form-label form-label-bold">Field of Work *</label>
            <input id="fieldOfWork" name="fieldOfWork" value={form.fieldOfWork} onChange={handleChange} className="input-style" style={{ margin: 0 }} placeholder="Electronics / Fashion / Food & Beverage" required />
          </div>
          <div>
            <label htmlFor="companyEmail" className="form-label form-label-bold">Company Email</label>
            <input id="companyEmail" type="email" name="companyEmail" value={form.companyEmail} onChange={handleChange} className="input-style" style={{ margin: 0 }} placeholder="info@techco.com" />
          </div>
          <div>
            <label htmlFor="phone" className="form-label form-label-bold">Phone</label>
            <input id="phone" type="tel" name="phone" value={form.phone} onChange={handleChange} className="input-style" style={{ margin: 0 }} placeholder="+84 91 234 5678" />
          </div>
          <div>
            <label htmlFor="address" className="form-label form-label-bold">Address</label>
            <input id="address" name="address" value={form.address} onChange={handleChange} className="input-style" style={{ margin: 0 }} placeholder="123 Le Loi, HCMC" />
          </div>

          {error && <p style={{ color: 'var(--danger)', margin: 0, fontSize: 'var(--font-sm)' }}>{error}</p>}

          <div className="btn-group" style={{ marginBottom: 0, marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-flex">Cancel</button>
            <button type="submit" disabled={saving || uploadingLogo} className="btn btn-primary btn-flex">
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default BrandFormModal;
