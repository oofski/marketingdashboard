import { useEffect, useState } from 'react';
import { Save, Download, Upload, FolderOpen, HardDrive, RotateCcw, Info, RefreshCw } from 'lucide-react';
import { Settings as S, exportDatabase, importDatabase, Audit } from '../services/db.js';
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
  const [dbInfo, setDbInfo] = useState(null);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  const version = useAppVersion();
  const { status: appUpdate, checkForUpdates, installUpdate } = useUpdateStatus();
  const updateSummary = describeUpdate(appUpdate, version);

  useEffect(() => {
    setValues(S.all());
    if (isElectron) {
      window.electronAPI.dbInfo().then(setDbInfo);
    }
  }, [isElectron]);

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSave() {
    for (const f of FIELDS) S.set(f.key, values[f.key] || '');
    Audit.log({ user_id: user.id, username: user.username, action: 'settings_update' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changeFolder() {
    const res = await window.electronAPI.chooseDataFolder();
    if (res?.canceled) return;
    if (
      confirm(
        'Data folder updated. The app needs to reload to use the shared folder. Reload now?'
      )
    ) {
      window.location.reload();
    } else {
      setDbInfo(res.info);
    }
  }

  async function useDefault() {
    const info = await window.electronAPI.useDefaultFolder();
    setDbInfo(info);
    if (confirm('Reverted to this computer’s local database. Reload now?')) {
      window.location.reload();
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

  function restore(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Restoring will replace ALL current data on this database. Continue?')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await importDatabase(new Uint8Array(ev.target.result));
      Audit.log({ user_id: user.id, username: user.username, action: 'backup_restore' });
      window.location.reload();
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-subtitle">Company details, data location and backups.</div>
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
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={14} /> {saved ? 'Saved!' : 'Save settings'}
        </button>
      </div>

      {isElectron && (
        <div className="card" style={{ maxWidth: 760 }}>
          <h3 className="card-title"><HardDrive size={15} /> Data location</h3>
          <div className="card-subtitle mb-4">
            To let everyone see the same onboarding data, point each computer at the same shared
            network folder (e.g. <code>\\\\SERVER\\Onboarding</code>). The first computer you switch
            copies its current data into that folder; the rest just open it.
          </div>
          <div className="data-path">
            <div className="text-xs text-muted">Current database file</div>
            <div className="path-value">{dbInfo?.dbPath || '…'}</div>
            <div className="text-xs text-muted mt-2">
              {dbInfo?.isCustom ? 'Using a shared / custom folder.' : 'Using this computer’s local folder.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={changeFolder}>
              <FolderOpen size={14} /> Change data folder…
            </button>
            {dbInfo?.isCustom && (
              <button className="btn" onClick={useDefault}>
                <RotateCcw size={14} /> Use local folder
              </button>
            )}
          </div>
          <div className="alert alert-warning mt-4">
            For a single office this shared-file setup works well. If many people edit at the exact
            same moment, or you need access from home / multiple locations, that's the point to move
            to the hosted/cloud option.
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 760 }}>
        <h3 className="card-title">Backup &amp; restore</h3>
        <div className="card-subtitle mb-4">
          Download a snapshot of the whole database. Keep regular backups — it contains every
          employee record and checklist.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={backup}><Download size={14} /> Download backup</button>
          <label className="btn">
            <Upload size={14} /> Restore from backup
            <input type="file" accept=".db" onChange={restore} style={{ display: 'none' }} />
          </label>
        </div>
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
