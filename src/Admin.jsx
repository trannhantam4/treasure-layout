import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import SearchInput from './SearchInput';
import { canManage } from './utils/auth';
import { useBrands } from './hooks/useBrands';
import EmptyState from './components/EmptyState';
import { toast } from './utils/toast';

const ALL_ROLES = ['visitor', 'vip buyer', 'manager', 'admin'];

function UserRow({ user, onRoleChange, brands, onCompanyChange }) {
  const [localSelection, setLocalSelection] = useState('');
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customVal, setCustomVal] = useState(user.company || '');

  useEffect(() => {
    const currentCompany = user.company || '';
    const matchingBrand = brands.find(b => b.brandName.toLowerCase() === currentCompany.toLowerCase());
    if (matchingBrand) {
      setLocalSelection(matchingBrand.brandId);
      setIsEditingCustom(false);
    } else if (currentCompany) {
      setLocalSelection('other');
      setCustomVal(currentCompany);
    } else {
      setLocalSelection('');
      setIsEditingCustom(false);
    }
  }, [user.company, brands]);

  return (
    <div className="touchable-card" style={{ padding: 'var(--space-4)', flexDirection: 'column', gap: 'var(--space-2)', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <img src={user.photoURL || 'https://via.placeholder.com/50'} alt={user.name} loading="lazy" decoding="async" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--font-md)' }}>{user.name}</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>{user.email}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)' }}>
        <span style={{ fontWeight: '500', fontSize: 'var(--font-sm)' }}>Role: </span>
        <select
          aria-label={`Role for ${user.name}`}
          value={user.role || 'visitor'}
          onChange={(e) => onRoleChange(user.id, e.target.value, user.role)}
          disabled={!user.canChangeRole}
          style={{ padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}
        >
          {user.availableRoles.map(role => (
            <option key={role} value={role} style={{ background: 'var(--bg-card-solid)', color: 'var(--text-primary)' }}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '500', fontSize: 'var(--font-sm)' }}>Company: </span>
          <select
            value={localSelection}
            onChange={(e) => {
              const val = e.target.value;
              setLocalSelection(val);
              if (val === 'other') {
                setIsEditingCustom(true);
              } else if (val === '') {
                onCompanyChange(user, '');
                setIsEditingCustom(false);
              } else {
                const brandObj = brands.find(b => String(b.brandId) === String(val));
                onCompanyChange(user, brandObj ? brandObj.brandName : '');
                setIsEditingCustom(false);
              }
            }}
            style={{ padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}
          >
            <option value="">None / Unknown</option>
            {brands.map(b => (
              <option key={b.brandId} value={b.brandId}>{b.brandName}</option>
            ))}
            <option value="other">Other...</option>
          </select>
        </div>

        {isEditingCustom && (
          <div style={{ display: 'flex', gap: '4px', marginTop: 'var(--space-1)', justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder="Type company name..."
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-xs)', width: '160px' }}
            />
            <button 
              type="button" 
              onClick={() => {
                if (customVal.trim()) {
                  onCompanyChange(user, customVal.trim());
                  setIsEditingCustom(false);
                }
              }} 
              className="btn btn-primary"
              style={{ padding: '2px 8px', fontSize: 'var(--font-xs)' }}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const MemoizedUserRow = memo(UserRow);

function Admin({ user }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { brands } = useBrands();

  useEffect(() => {
    if (!user || !canManage(user)) {
      navigate('/');
      return;
    }

    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).map(u => {
        let availableRoles = ALL_ROLES;
        let canChangeRole = true;

        if (user.role === 'manager') {
          availableRoles = ALL_ROLES.filter(r => r !== 'manager' && r !== 'admin');
          if (u.role === 'manager' || u.role === 'admin') {
            availableRoles = [u.role];
            canChangeRole = false;
          }
        }

        if (u.id === user.uid) {
          canChangeRole = false;
        }

        return { ...u, availableRoles, canChangeRole };
      });
      setUsers(userList.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      await updateDoc(docRef(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update user role.");
    }
  };

  const handleCompanyChange = async (targetUser, newCompany) => {
    try {
      const { doc: docRef, updateDoc, collection: colRef, addDoc } = await import('firebase/firestore');
      const oldCompany = targetUser.company || '';

      await updateDoc(docRef(db, 'users', targetUser.id), { company: newCompany });

      // Log the change
      await addDoc(colRef(db, 'logs'), {
        changerUid: user.uid,
        changerName: user.fullName || user.name || 'Admin/Manager',
        targetUserUid: targetUser.id,
        targetUserName: targetUser.name || targetUser.fullName || '',
        oldCompany,
        newCompany,
        timestamp: new Date().toISOString(),
        action: 'change_user_brand'
      });

      toast.success(`Successfully changed company of ${targetUser.name} to "${newCompany}".`);
    } catch (error) {
      console.error("Error updating user company:", error);
      toast.error("Failed to update user company.");
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mobile-container page-enter">
      <div className="scroll-view">
        <h1 style={{ fontSize: 'var(--font-2xl)' }}>User Manager</h1>
        <SearchInput searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search users..." />

        {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading users...</p>}

        {!loading && filteredUsers.length === 0 && (
          <EmptyState icon="👥" message="No users found." />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filteredUsers.map(u => (
            <MemoizedUserRow 
              key={u.id} 
              user={u} 
              onRoleChange={handleRoleChange} 
              brands={brands}
              onCompanyChange={handleCompanyChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Admin;