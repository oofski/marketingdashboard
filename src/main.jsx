import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { DatabaseProvider } from './contexts/DatabaseContext.jsx';
import './styles/global.css';

// Catches any render error and shows it, instead of a blank white window —
// makes problems visible (and reportable) rather than silent.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="boot-screen">
          <h2>Something went wrong</h2>
          <pre style={{ maxWidth: 640, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <DatabaseProvider>
          <AuthProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </AuthProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
