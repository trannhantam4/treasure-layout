import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Navigation from './Navigation'
import Home from './Home'
import Login from './Login'
import Events from './Events'
import EventDetail from './EventDetail'
import Profile from './Profile'
import Admin from './Admin'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        let role = 'visitor';
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            role = userSnap.data().role || 'visitor';
            await setDoc(userRef, {
              uid: currentUser.uid,
              name: currentUser.displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL
            }, { merge: true });
          } else {
            await setDoc(userRef, {
              uid: currentUser.uid,
              name: currentUser.displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL,
              role: 'visitor'
            });
          }
        } catch (error) {
          console.error("Error fetching/updating user role:", error);
        }
        setUser({ name: currentUser.displayName, email: currentUser.email, uid: currentUser.uid, photoURL: currentUser.photoURL, role });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  return (
    <Router>
      <Navigation user={user} />
      <main style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events user={user} />} />
          <Route path="/events/:id" element={<EventDetail user={user} />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin user={user} />} />
        </Routes>
      </main>
    </Router>
  )
}

export default App
