import { useState, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useBrands } from './hooks/useBrands';
import { clearUserSessionStorage } from './storage';
import { canManage } from './utils/auth';
import SearchableCompanyInput from './components/SearchableCompanyInput';
import { useTranslation } from 'react-i18next';

function Profile({ user, setUser }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName:  user?.fullName  || '',
    company:   user?.company   || '',
    position:  user?.position  || '',
    address:   user?.address   || '',
    phone:     user?.phone     || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const { brands } = useBrands();

  const matchedBrand = useMemo(() => {
    if (!user || !brands || brands.length === 0) return null;
    if (user.brandId) {
      const byId = brands.find((b) => String(b.brandId) === String(user.brandId));
      if (byId) return byId;
    }
    const company = (user.company || '').trim().toLowerCase();
    if (!company) return null;
    return brands.find((b) => (b.brandName || '').trim().toLowerCase() === company) || null;
  }, [user, brands]);

  if (!user) {
    return (
      <section id="center">
        <h2>{t('notLoggedIn')}</h2>
        <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>{t('goToLogin')}</button>
      </section>
    );
  }

  const handleLogout = async () => {
    try {
      await clearUserSessionStorage();
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const matching = brands.find(
        (b) => (b.brandName || '').trim().toLowerCase() === (form.company || '').trim().toLowerCase()
      );
      await updateDoc(doc(db, 'users', user.uid), {
        fullName:  form.fullName,
        company:   form.company,
        brandId:   matching ? matching.brandId : '',
        position:  form.position,
        address:   form.address,
        phone:     form.phone,
      });
      setSaveMsg(t('profileUpdated'));
      setEditing(false);
    } catch {
      setSaveMsg(t('profileFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mobile-container page-enter">
      <div className="scroll-view">
        {/* User Card Header */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-6)', background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)'
        }}>
          {user.photoURL && (
            <img src={user.photoURL} alt={user.name} loading="lazy"
              style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }}
            />
          )}
          <h1 style={{ margin: 0, fontSize: 'var(--font-2xl)' }}>{user.fullName || user.name}</h1>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{user.email}</span>
          {(matchedBrand || user.brandId || user.company?.trim() || canManage(user)) && (
            <button
              type="button"
              onClick={() => navigate('/brand-visitors')}
              className="btn btn-primary btn-sm"
              style={{ marginTop: 'var(--space-2)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>👥</span>
              <span>
                {matchedBrand
                  ? t('viewMyBrandVisitorsBtn', { brand: matchedBrand.brandName, defaultValue: `View ${matchedBrand.brandName} Booth Visitors` })
                  : user.company?.trim()
                    ? t('viewMyBrandVisitorsBtn', { brand: user.company.trim(), defaultValue: `View ${user.company.trim()} Booth Visitors` })
                    : t('brandVisitorsTitle', 'Brand Booth Visitors')}
              </span>
            </button>
          )}
        </div>

        {/* Profile Details or Edit Form */}
        {!editing ? (
          <div className="touchable-card" style={{ flexDirection: 'column', padding: 'var(--space-6)', gap: 'var(--space-3)', cursor: 'default' }}>
            <InfoRow label={t('fullName')}  value={user.fullName  || '—'} />
            <InfoRow label={t('company')}   value={user.company   || '—'} />
            <InfoRow label={t('position')}  value={user.position  || '—'} />
            <InfoRow label={t('address')}   value={user.address   || '—'} />
            <InfoRow label={t('phone')}     value={user.phone     || '—'} />
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
              <button onClick={() => setEditing(true)} className="btn btn-primary" style={{ flex: 1 }}>
                {t('editProfile')}
              </button>
              {(matchedBrand || user.brandId || user.company?.trim() || canManage(user)) && (
                <button
                  type="button"
                  onClick={() => navigate('/brand-visitors')}
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>👥</span>
                  <span>{t('brandVisitorsNav', 'Brand Visitors')}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--bg-card)', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
            {[
              { label: t('fullName'), name: 'fullName' },
              { label: t('company'),  name: 'company'  },
              { label: t('position'), name: 'position' },
              { label: t('address'),  name: 'address'  },
              { label: t('phone'),    name: 'phone'    },
            ].map(({ label, name }) => {
              if (name === 'company') {
                return (
                  <SearchableCompanyInput
                    key={name}
                    value={form.company}
                    onChange={(val) => setForm(prev => ({ ...prev, company: val }))}
                    brands={brands}
                  />
                );
              }
              return (
                <div key={name}>
                  <label htmlFor={name} className="form-label form-label-bold">{label}</label>
                  <input
                    id={name}
                    name={name}
                    value={form[name]}
                    onChange={handleChange}
                    className="input-style"
                    style={{ margin: 0 }}
                  />
                </div>
              );
            })}
            {saveMsg && <p style={{ color: saveMsg.includes('!') ? 'var(--success)' : 'var(--danger)', margin: 0, fontSize: 'var(--font-sm)' }}>{saveMsg}</p>}
            <div className="btn-group" style={{ marginBottom: 0 }}>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary btn-flex">{t('cancel')}</button>
              <button type="submit" disabled={saving} className="btn btn-primary btn-flex">
                {saving ? t('saving') : t('saveChanges')}
              </button>
            </div>
          </form>
        )}

        <button onClick={handleLogout} className="btn btn-danger" style={{ marginTop: 'var(--space-2)' }}>
          {t('logOut')}
        </button>
      </div>
    </div>
  );
}

const InfoRow = memo(({ label, value }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: '500', color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
});

export default Profile;