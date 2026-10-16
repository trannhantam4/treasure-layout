import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import SearchInput from './SearchInput';
import { canManage } from './utils/auth';
import { useBrands } from './hooks/useBrands';
import EmptyState from './components/EmptyState';
import Pagination from './components/Pagination';
import { toast } from './utils/toast';
import { useTranslation } from 'react-i18next';

const ALL_ROLES = ['visitor', 'vip buyer', 'manager', 'admin'];

function UserRow({ user, onRoleChange, brands, onCompanyChange }) {
  const { t } = useTranslation();
  const currentCompany = user.company || '';
  const matchingBrand = brands.find(b => b.brandName.toLowerCase() === currentCompany.toLowerCase());
  const initialSelection = matchingBrand ? matchingBrand.brandId : (currentCompany ? 'other' : '');

  const [localSelection, setLocalSelection] = useState(initialSelection);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customVal, setCustomVal] = useState(currentCompany);

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
        <span style={{ fontWeight: '500', fontSize: 'var(--font-sm)' }}>{t('roleLabel')} </span>
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
          <span style={{ fontWeight: '500', fontSize: 'var(--font-sm)' }}>{t('companyLabel')} </span>
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
            <option value="">{t('noneUnknown')}</option>
            {brands.map(b => (
              <option key={b.brandId} value={b.brandId}>{b.brandName}</option>
            ))}
            <option value="other">{t('otherOption')}</option>
          </select>
        </div>

        {isEditingCustom && (
          <div style={{ display: 'flex', gap: '4px', marginTop: 'var(--space-1)', justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder={t('typeCompanyName')}
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
              {t('save')}
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
  const { t } = useTranslation();
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
      toast.success(t('userRoleUpdated', { role: newRole }));
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update user role.");
    }
  };

  const handleCompanyChange = async (targetUser, newCompany) => {
    try {
      const { doc: docRef, updateDoc, collection: colRef, addDoc } = await import('firebase/firestore');
      const oldCompany = targetUser.company || '';
      const matchedBrand = brands.find(
        (b) => (b.brandName || '').trim().toLowerCase() === (newCompany || '').trim().toLowerCase()
      );

      await updateDoc(docRef(db, 'users', targetUser.id), {
        company: newCompany,
        brandId: matchedBrand ? matchedBrand.brandId : '',
      });

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

      toast.success(t('userCompanyUpdated', { name: targetUser.name, company: newCompany }));
    } catch (error) {
      console.error("Error updating user company:", error);
      toast.error("Failed to update user company.");
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 10;

  const handleSearchChange = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const displayedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  return (
    <div className="mobile-container page-enter">
      <div className="scroll-view">
        <h1 style={{ fontSize: 'var(--font-2xl)' }}>{t('users')}</h1>
        <SearchInput searchTerm={searchTerm} setSearchTerm={handleSearchChange} placeholder={t('searchUsersPlaceholder')} />

        {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{t('loading')}</p>}

        {!loading && filteredUsers.length === 0 && (
          <EmptyState icon="👥" message={t('noUsersFound')} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {displayedUsers.map(u => (
            <MemoizedUserRow 
              key={u.id} 
              user={u} 
              onRoleChange={handleRoleChange} 
              brands={brands}
              onCompanyChange={handleCompanyChange}
            />
          ))}
        </div>

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredUsers.length}
            itemsPerPage={USERS_PER_PAGE}
            onPageChange={setCurrentPage}
            noun="users"
          />
        )}
      </div>
    </div>
  );
}

export default Admin;