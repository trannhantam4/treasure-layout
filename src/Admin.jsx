import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

function Admin({ user }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client-side guard for the specific email address
    if (!user || user.email !== 'trannhantam4@gmail.com') {
      navigate('/');
      return;
    }

    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update role.");
    }
  };

  if (!user || user.email !== 'trannhantam4@gmail.com') {
    return null;
  }

  if (loading) {
    return <div id="center">Loading users...</div>;
  }

  return (
    <div className="mobile-container">
      <div className="scroll-view">
        <h2 className="slider-title" style={{ textAlign: 'center' }}>Account Manage</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {users.map(u => (
            <div key={u.id} className="touchable-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={u.photoURL || 'https://via.placeholder.com/50'} alt={u.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{u.name}</h3>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>{u.email}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>Role: </span>
                <select 
                  value={u.role || 'visitor'} 
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '0.9rem' }}
                >
                  <option value="visitor" style={{ color: '#000' }}>Visitor</option>
                  <option value="vip visitor" style={{ color: '#000' }}>VIP Visitor</option>
                  <option value="admin" style={{ color: '#000' }}>Admin</option>
                  <option value="manager" style={{ color: '#000' }}>Manager</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Admin;