import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

function Profile({ user, setUser }) {
  const navigate = useNavigate();

  if (!user) {
    return (
      <section id="center">
        <h2>You are not logged in.</h2>
        <button onClick={() => navigate('/login')} className="counter">Go to Login</button>
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

  return (
    <section id="center">
      <h1>Profile</h1>
      <p>Welcome, {user.name}!</p>
      <p style={{ marginBottom: '20px' }}>Email: {user.email}</p>
      <button onClick={handleLogout} className="counter">Log Out</button>
    </section>
  );
}

export default Profile;