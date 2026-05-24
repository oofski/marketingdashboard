import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result = await login(username, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand">Dental Clinic Manager</div>
          <div className="login-sub">Sign in to access patient records</div>
        </div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          <div className="field">
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="login-hint">
          Default credentials: <strong>admin</strong> / <strong>admin123</strong>
        </div>
      </div>
    </div>
  );
}
