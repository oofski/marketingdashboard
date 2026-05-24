import { useEffect, useState } from 'react';
import { Save, Download, Upload } from 'lucide-react';
import { Settings as S, exportDatabase, importDatabase, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { LANGUAGES } from '../services/translations.js';

const FIELDS = [
  { key: 'clinic_name', label: 'Clinic Name' },
  { key: 'clinic_address', label: 'Address' },
  { key: 'clinic_phone', label: 'Phone' },
  { key: 'clinic_email', label: 'Email' },
  { key: 'clinic_license', label: 'License Number' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(S.all());
  }, []);

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSave() {
    for (const f of FIELDS) {
      S.set(f.key, values[f.key] || '');
    }
    S.set('default_language', values.default_language || 'en');
    S.set('numbering_system', values.numbering_system || 'universal');
    Audit.log({ user_id: user.id, username: user.username, action: 'settings_update' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function backup() {
    const data = exportDatabase();
    if (!data) return;
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dental-clinic-backup-${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    Audit.log({ user_id: user.id, username: user.username, action: 'backup_export' });
  }

  function restore(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Restoring will replace ALL current data. Continue?')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const bytes = new Uint8Array(ev.target.result);
      await importDatabase(bytes);
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
          <div className="page-subtitle">Clinic information and application preferences</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3 className="card-title">Clinic Information</h3>
        <div className="card-subtitle mb-4">Shown in the header of all generated PDFs.</div>
        {FIELDS.map((f) => (
          <div key={f.key} className="field">
            <label className="label">{f.label}</label>
            <input
              className="input"
              value={values[f.key] || ''}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3 className="card-title">Preferences</h3>
        <div className="field-row">
          <div className="field">
            <label className="label">Default Form Language</label>
            <select
              className="select"
              value={values.default_language || 'en'}
              onChange={(e) => setField('default_language', e.target.value)}
            >
              {Object.entries(LANGUAGES).map(([code, lang]) => (
                <option key={code} value={code}>{lang.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Tooth Numbering System</label>
            <select
              className="select"
              value={values.numbering_system || 'universal'}
              onChange={(e) => setField('numbering_system', e.target.value)}
            >
              <option value="universal">Universal (1–32, US)</option>
              <option value="fdi">FDI (ISO 3950)</option>
              <option value="palmer">Palmer Notation</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={14} /> {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3 className="card-title">Backup & Restore</h3>
        <div className="card-subtitle mb-4">
          Export your full database to a file. Keep it safe — it contains all patient records.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={backup}>
            <Download size={14} /> Download Backup
          </button>
          <label className="btn">
            <Upload size={14} /> Restore from Backup
            <input type="file" accept=".db" onChange={restore} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    </div>
  );
}
