import { useState } from 'react';
import { KeyRound, Check, RefreshCw, Download, Info } from 'lucide-react';
import { Users, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUpdateStatus, useAppVersion, describeUpdate } from '../services/updates.js';

export default function Account() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useAppVersion();
  const { status: appUpdate, checkForUpdates, installUpdate } = useUpdateStatus();
  const updateSummary = describeUpdate(appUpdate, version);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setDone(false);
    if (next.length < 6) {
      setError('Your new password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The new password and confirmation do not match.');
      return;
    }
    setBusy(true);
    const result = await Users.changeOwnPassword(user.id, current, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    Audit.log({ user_id: user.id, username: user.username, action: 'password_change_self' });
    setDone(true);
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Account</h1>
          <div className="page-subtitle">Signed in as {user.full_name} ({user.username})</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h3 className="card-title"><KeyRound size={15} /> Change my password</h3>
        <div className="card-subtitle mb-4">Choose something only you know, then sign in with it next time.</div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          {done && (
            <div className="alert alert-info mb-4" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> Password updated. Use it the next time you sign in.
            </div>
          )}
          <div className="field">
            <label className="label">Current password</label>
            <input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label className="label">New password</label>
            <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Confirm new password</label>
            <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h3 className="card-title"><Info size={15} /> App version &amp; updates</h3>
        <div className="data-path">
          <div className="text-xs text-muted">Installed version</div>
          <div className="path-value">Onboarding Tracker v{version}</div>
          <div className="text-xs text-muted mt-2">{updateSummary.label}</div>
        </div>
        {isElectron ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={checkForUpdates}>
              <RefreshCw size={14} /> Check for updates
            </button>
            {appUpdate.state === 'downloaded' && (
              <button className="btn btn-primary" onClick={installUpdate}>
                <Download size={14} /> Restart to apply update
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted mt-2">Updates apply automatically in the installed app.</div>
        )}
      </div>
    </div>
  );
}
