import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { toast } from './utils/toast';

function Login() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome back! Successfully logged in.");
      navigate('/profile');
    } catch (error) {
      console.error("Error during Google Login:", error);
      toast.error("Failed to login with Google. Please try again.");
    }
  };

  return (
    <section id="center" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Decorative gradient orbs */}
      <div style={{
        position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        opacity: 0.08, top: '-80px', right: '-60px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: '200px', height: '200px', borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-light) 0%, transparent 70%)',
        opacity: 0.06, bottom: '-40px', left: '-40px', pointerEvents: 'none',
      }} />

      <div style={{
        background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-9) var(--space-8)', maxWidth: '420px', width: '100%',
        textAlign: 'center', boxShadow: 'var(--shadow-lg)',
        animation: 'fadeIn var(--duration-normal) var(--ease-out) both',
      }}>
        <div style={{
          display: 'inline-flex', padding: '4px 14px', borderRadius: 'var(--radius-full)',
          background: 'var(--accent-bg)', color: 'var(--accent)',
          fontSize: 'var(--font-xs)', fontWeight: '700', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 'var(--space-4)',
        }}>
          Welcome
        </div>
        <h1 style={{ fontSize: 'var(--font-3xl)', marginBottom: 'var(--space-2)' }}>Sign In</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-7)' }}>
          Log in to manage events, brands, and your treasure hunt journey.
        </p>
        <button onClick={handleGoogleLogin} className="google-btn" style={{ width: '100%', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </section>
  );
}

export default Login;