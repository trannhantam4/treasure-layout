import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import Navigation from './Navigation';
import Home from './Home';
import { canManage } from './utils/auth';
import ToastContainer from './components/Toast';
import ConfirmDialogContainer from './components/ConfirmDialog';
import { crashlytics } from './utils/analytics';
import './App.css';

/**
 * RouteTracker automatically logs page views to Firebase Analytics on navigation.
 */
function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    crashlytics.logPageView(location.pathname + location.search);
  }, [location]);

  return null;
}

// Lazy-loaded components
const Login = lazy(() => import('./Login'));
const Events = lazy(() => import('./Events'));
const EventDetail = lazy(() => import('./EventDetail'));
const Profile = lazy(() => import('./Profile'));
const Admin = lazy(() => import('./Admin'));
const BrandManager = lazy(() => import('./BrandManager'));
const BrandVisitors = lazy(() => import('./BrandVisitors'));
const OnboardingModal = lazy(() => import('./OnboardingModal'));

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Holds the Firestore onSnapshot unsubscribe for the current user doc
  const userDocUnsubscribeRef = useRef(null)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Clean up any previous user's Firestore listener
      if (userDocUnsubscribeRef.current) {
        userDocUnsubscribeRef.current();
        userDocUnsubscribeRef.current = null;
      }

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);

        // Subscribe to the user doc for real-time profile and role updates.
        userDocUnsubscribeRef.current = onSnapshot(userRef, (snap) => {
          if (!snap.exists()) {
            // New user: initialize profile document in Firestore
            setDoc(userRef, {
              uid: currentUser.uid,
              name: currentUser.displayName || '',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || '',
              role: 'visitor',
              profileCompleted: false,
            }, { merge: true }).catch((err) => console.error("Error creating user doc:", err));

            setUser({
              uid: currentUser.uid,
              name: currentUser.displayName || '',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || '',
              role: 'visitor',
              profileCompleted: false,
              displayId: '', fullName: '', company: '', brandId: '', position: '', address: '', phone: '',
            });
          } else {
            // Existing user: load full profile data directly
            const data = snap.data() || {};
            const profile = {
              uid: currentUser.uid,
              name: currentUser.displayName || data.name || '',
              email: currentUser.email || data.email || '',
              photoURL: currentUser.photoURL || data.photoURL || '',
              role: data.role || 'visitor',
              profileCompleted: !!data.profileCompleted,
              displayId:  data.displayId  || '',
              fullName:   data.fullName   || '',
              company:    data.company    || '',
              brandId:    data.brandId    || '',
              position:   data.position   || '',
              address:    data.address    || '',
              phone:      data.phone      || '',
            };
            setUser(profile);
            crashlytics.setUserId(currentUser.uid);
            crashlytics.setUserProperties({
              role: profile.role,
              company: profile.company || 'unassigned',
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user doc:", error);
          crashlytics.recordError(error, false, { context: 'user_doc_listener' });
          setLoading(false);
        });
      } else {
        setUser(null);
        crashlytics.setUserId(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (userDocUnsubscribeRef.current) userDocUnsubscribeRef.current();
    };
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  return (
    <Router>
      <RouteTracker />
      <ToastContainer />
      <ConfirmDialogContainer />
      {/* Onboarding: shown for any logged-in user who hasn't completed their profile */}
      {user && !user.profileCompleted && (
        <Suspense fallback={<div>Loading Onboarding...</div>}>
          <OnboardingModal user={user} />
        </Suspense>
      )}
      <Navigation user={user} />
      <main style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/events" element={<Events user={user} />} />
            <Route path="/events/:id" element={<EventDetail user={user} />} />
            <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/brand-visitors" element={
              user
                ? <BrandVisitors user={user} />
                : <Navigate to="/login" replace />
            } />
            <Route path="/admin" element={
              canManage(user)
                ? <Admin user={user} />
                : <Navigate to="/" replace />
            } />
            <Route path="/brands" element={
              canManage(user)
                ? <BrandManager user={user} />
                : <Navigate to="/" replace />
            } />
          </Routes>
        </Suspense>
      </main>
    </Router>
  )
}

export default App
