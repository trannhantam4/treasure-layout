import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useBrands } from './hooks/useBrands';
import SearchableCompanyInput from './components/SearchableCompanyInput';

function Profile({ user, setUser }) {
  const navigate = useNavigate();
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

  if (!user) {
    return (
      <section id="center">
        <h2>You are not logged in.</h2>
        <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>Go to Login</button>
      </section>
    );
  }

  const handleLogout = async () => {
    try {
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
      await updateDoc(doc(db, 'users', user.uid), {
        fullName:  form.fullName,
        company:   form.company,
        position:  form.position,
        address:   form.address,
        phone:     form.phone,
      });
      setSaveMsg('Profile updated!');
      setEditing(false);
    } catch {
      setSaveMsg('Failed to save. Please try again.');
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
        </div>

        {/* Profile Details or Edit Form */}
        {!editing ? (
          <div className="touchable-card" style={{ flexDirection: 'column', padding: 'var(--space-6)', gap: 'var(--space-3)', cursor: 'default' }}>
            <InfoRow label="Full Name"  value={user.fullName  || '—'} />
            <InfoRow label="Company"    value={user.company   || '—'} />
            <InfoRow label="Position"   value={user.position  || '—'} />
            <InfoRow label="Address"    value={user.address   || '—'} />
            <InfoRow label="Phone"      value={user.phone     || '—'} />
            <button onClick={() => setEditing(true)} className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
              Edit Profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--bg-card)', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
            {[
              { label: 'Full Name',           name: 'fullName' },
              { label: 'Company',             name: 'company'  },
              { label: 'Position in Company', name: 'position' },
              { label: 'Address',             name: 'address'  },
              { label: 'Phone',               name: 'phone'    },
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
              <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary btn-flex">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary btn-flex">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        <button onClick={handleLogout} className="btn btn-danger" style={{ marginTop: 'var(--space-2)' }}>
          Log Out
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
}
);
function roleColor(role) {
  const map = { admin: 'var(--role-admin)', manager: 'var(--role-manager)', 'vip buyer': 'var(--role-vip)', visitor: 'var(--role-visitor)' };
  return map[role] || 'var(--accent)';
}

export default Profile;