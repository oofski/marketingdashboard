import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Settings as S } from '../services/db.js';
import { useUpdateStatus } from '../services/updates.js';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState(() => localStorage.getItem('ebg_remember_username') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => !!localStorage.getItem('ebg_remember_username'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const company = S.get('company_name') || 'EBG';
  const { status: appUpdate, installUpdate } = useUpdateStatus();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result = await login(username, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (remember) localStorage.setItem('ebg_remember_username', username.trim());
    else localStorage.removeItem('ebg_remember_username');
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand">{company} Onboarding</div>
          <div className="login-sub">Sign in to track new hire onboarding</div>
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
          <label className="check-inline" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember my username
          </label>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {appUpdate.state === 'downloaded' && (
          <div className="update-banner" style={{ marginTop: 16 }}>
            <span>A new version is ready.</span>
            <button className="btn btn-sm btn-primary" onClick={installUpdate}>Restart to update</button>
          </div>
        )}
      </div>
    </div>
  );
}
