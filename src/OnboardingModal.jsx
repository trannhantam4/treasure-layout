import { useState, memo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generateUserDisplayId } from './Brand';
import { useBrands } from './hooks/useBrands';
import SearchableCompanyInput from './components/SearchableCompanyInput';
import { modalOverlayStyle, modalCardStyle } from './Modal';
import { useTranslation } from 'react-i18next';

function OnboardingModal({ user }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    fullName: user?.name || '',
    company: '',
    position: '',
    address: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { brands } = useBrands();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fullName, company, position, address, phone } = form;
    if (!fullName || !company || !position || !address || !phone) {
      setError(t('fillAllFields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const displayId = await generateUserDisplayId();
      const matchedBrand = brands.find(
        (b) => (b.brandName || '').trim().toLowerCase() === (company || '').trim().toLowerCase()
      );
      await updateDoc(doc(db, 'users', user.uid), {
        fullName,
        company,
        brandId: matchedBrand ? matchedBrand.brandId : '',
        position,
        address,
        phone,
        displayId,
        profileCompleted: true,
      });
    } catch (err) {
      console.error('Onboarding save error:', err);
      setError(t('profileFailed'));
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlayStyle({ zIndex: 9999, background: 'rgba(0,0,0,0.7)', blur: 'blur(8px)' })}>
      <div style={modalCardStyle({ maxWidth: '480px', padding: 'var(--space-8)' })}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>{t('welcomeBadge')}</div>
          <h1 style={{ margin: 'var(--space-2) 0 var(--space-1)', fontSize: 'var(--font-2xl)' }}>{t('completeProfileTitle')}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--font-sm)' }}>
            {t('completeProfileSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Field
            label={t('fullName')}
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Nguyen Van A"
          />
          <SearchableCompanyInput
            value={form.company}
            onChange={(val) => setForm(prev => ({ ...prev, company: val }))}
            brands={brands}
          />
          <Field
            label={t('position')}
            name="position"
            value={form.position}
            onChange={handleChange}
            placeholder="Marketing Manager"
          />
          <Field
            label={t('address')}
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="123 Le Loi, Ho Chi Minh City"
          />
          <Field
            label={t('phone')}
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="+84 91 234 5678"
            type="tel"
          />

          {error && (
            <p style={{ color: 'var(--danger)', margin: 0, fontSize: 'var(--font-sm)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', fontSize: 'var(--font-md)', fontWeight: '600' }}
          >
            {saving ? t('saving') : t('continueToApp')}
          </button>
        </form>
      </div>
    </div>
  );
}

const Field = memo(({ label, name, value, onChange, placeholder, type = 'text' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={name} className="form-label form-label-bold">{label}</label>
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        className="input-style"
        style={{ margin: 0 }}
      />
    </div>
  );
});

export default OnboardingModal;
