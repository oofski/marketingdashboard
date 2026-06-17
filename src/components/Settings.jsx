import { useEffect, useState } from 'react';
import { Save, Download, Info, RefreshCw } from 'lucide-react';
import { Settings as S, exportDatabase, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUpdateStatus, useAppVersion, describeUpdate } from '../services/updates.js';

const FIELDS = [
  { key: 'company_name', label: 'Company name' },
  { key: 'company_subtitle', label: 'Subtitle (shown under the logo)' },
  { key: 'company_address', label: 'Address' },
  { key: 'company_phone', label: 'Phone' },
  { key: 'company_email', label: 'Email' },
];

export default function Settings() {
  const { user } = useAuth();
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  const version = useAppVersion();
  const { status: appUpdate, checkForUpdates, installUpdate } = useUpdateStatus();
  const updateSummary = describeUpdate(appUpdate, version);

  useEffect(() => {
    setValues(S.all());
  }, []);

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave() {
    setBusy(true);
    try {
      for (const f of FIELDS) await S.set(f.key, values[f.key] || '');
      Audit.log({ user_id: user.id, username: user.username, action: 'settings_update' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  function backup() {
    const data = exportDatabase();
    if (!data) return;
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onboarding-backup-${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
    Audit.log({ user_id: user.id, username: user.username, action: 'backup_export' });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-subtitle">Company details, backups and updates.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 760 }}>
        <h3 className="card-title">Company information</h3>
        <div className="card-subtitle mb-4">Appears in the sidebar, on the sign-in screen and on exported PDFs.</div>
        {FIELDS.map((f) => (
          <div key={f.key} className="field">
            <label className="label">{f.label}</label>
            <input className="input" value={values[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />
          </div>
        ))}
        <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
          <Save size={14} /> {saved ? 'Saved!' : busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 760 }}>
        <h3 className="card-title">Backup</h3>
        <div className="card-subtitle mb-4">
          Download a snapshot of the current data (every employee record and checklist). Handy to keep
          a copy periodically.
        </div>
        <button className="btn" onClick={backup}><Download size={14} /> Download backup</button>
      </div>

      <div className="card" style={{ maxWidth: 760 }}>
        <h3 className="card-title"><Info size={15} /> About &amp; updates</h3>
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
          <div className="text-xs text-muted mt-2">
            Updates apply automatically in the installed desktop app.
          </div>
        )}
      </div>
    </div>
  );
}
