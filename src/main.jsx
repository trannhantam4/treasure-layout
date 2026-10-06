import { Component } from 'react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'

/**
 * ErrorBoundary — catches any uncaught React render errors and shows a
 * friendly fallback instead of a blank white screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '32px',
          textAlign: 'center',
          gap: '16px',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, maxWidth: '400px' }}>
            An unexpected error occurred. Try refreshing the page. If the problem persists, contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#646cff',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Refresh Page
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '16px',
              textAlign: 'left',
              background: '#1a1a1a',
              color: '#ff6b6b',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              maxWidth: '600px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
