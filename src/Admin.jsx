import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

import SearchInput from './SearchInput';

const ALL_ROLES = ['visitor', 'vip buyer', 'manager', 'admin'];

function UserRow({ user, onRoleChange }) {
  return (
    <div className="touchable-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={user.photoURL || 'https://via.placeholder.com/50'} alt={user.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{user.name}</h3>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>{user.email}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
        <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>Role: </span>
        <select
          value={user.role || 'visitor'}
          onChange={(e) => onRoleChange(user.id, e.target.value, user.role)}
          disabled={!user.canChangeRole}
          style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '0.9rem' }}
        >
          {user.availableRoles.map(role => (
            <option key={role} value={role} style={{ color: '#000' }}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Admin({ user }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const canAccess = user?.role === 'admin' || user?.role === 'manager';
    if (!user || !canAccess) {
      navigate('/');
      return;
    }

    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).map(u => {
        let availableRoles = ALL_ROLES;
        if (user.role === 'manager') {
          // Managers can't assign 'manager' or 'admin' roles.
          availableRoles = ALL_ROLES.filter(r => r !== 'manager' && r !== 'admin');
          // If the user being edited is already a manager or admin, keep that role in the list so it can be displayed.
          if (u.role === 'manager' || u.role === 'admin') {
            availableRoles = [u.role];
          }
        }
        return { ...u, availableRoles };
      });
      setUsers(userList.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const handleRoleChange = async (userId, newRole, oldRole) => {
    if (user.role === 'manager' && (oldRole === 'manager' || oldRole === 'admin')) {
      alert("You do not have permission to change the role of a manager or admin.");
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update role.");
    }
  };

  const canAccess = user?.role === 'admin' || user?.role === 'manager';
  if (!user || !canAccess) {
    return null;
  }

  if (loading) {
    return <div id="center">Loading users...</div>;
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mobile-container">
      <div className="scroll-view">
        <h2 className="slider-title" style={{ textAlign: 'center' }}>User Manager</h2>
        <SearchInput searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search users by name or email..." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredUsers.map(u => (
            <UserRow key={u.id} user={u} onRoleChange={handleRoleChange} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Admin;