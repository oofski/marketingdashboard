import { useRef, useState } from 'react';
import { X, FileCheck, Download } from 'lucide-react';
import { Documents, Settings, Audit } from '../services/db.js';
import { CONSENT_TEMPLATES, LANGUAGES } from '../services/translations.js';
import { generateConsentPdf, savePdfAsBytes, pdfDataUrl } from '../services/pdf.js';
import SignaturePad from './SignaturePad.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ConsentFormModal({ patient, visitId, onClose, onSaved }) {
  const { user } = useAuth();
  const [language, setLanguage] = useState(patient.language || 'en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sigRef = useRef(null);

  const template = CONSENT_TEMPLATES[language] || CONSENT_TEMPLATES.en;

  async function handleSign() {
    setError('');
    if (sigRef.current?.isEmpty()) {
      setError('Please capture the patient signature before saving.');
      return;
    }
    setBusy(true);
    try {
      const signatureDataUrl = sigRef.current.toDataURL();
      const signedAt = new Date().toISOString();
      const clinic = Settings.all();
      const doc = generateConsentPdf({
        clinic, patient, language, signatureDataUrl, signedAt,
      });
      const bytes = await savePdfAsBytes(doc);
      const filename = `consent-${patient.id}-${Date.now()}.pdf`;

      if (window.electronAPI?.isElectron) {
        await window.electronAPI.saveDoc(filename, bytes);
      } else {
        // Web fallback: store PDF data url in localStorage by filename.
        localStorage.setItem('doc:' + filename, pdfDataUrl(doc));
      }

      const docId = Documents.create({
        patient_id: patient.id,
        visit_id: visitId || null,
        doc_type: 'consent_form',
        filename,
        signed: true,
        signed_at: signedAt,
        language,
        metadata: { signed_by_name: `${patient.first_name} ${patient.last_name}` },
      });

      Audit.log({
        user_id: user.id, username: user.username,
        action: 'consent_signed', entity: 'document', entity_id: docId,
        details: `Patient ${patient.id} signed consent in ${language}`,
      });
      onSaved?.(docId);
    } catch (e) {
      console.error(e);
      setError('Failed to save consent form: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function previewPdf() {
    const clinic = Settings.all();
    const doc = generateConsentPdf({ clinic, patient, language });
    window.open(pdfDataUrl(doc), '_blank');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Consent Form for {patient.first_name} {patient.last_name}</h2>
            <div className="card-subtitle">Patient #{patient.id}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="field" style={{ maxWidth: 240 }}>
          <label className="label">Language</label>
          <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {Object.entries(LANGUAGES).map(([code, lang]) => (
              <option key={code} value={code}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto', padding: 14, background: 'var(--bg-elev-2)', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 16 }}>
          <h3 style={{ textAlign: 'center', marginTop: 0 }}>{template.title}</h3>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{template.intro}</p>
          {template.sections.map((s) => (
            <div key={s.heading} style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 13 }}>{s.heading}</strong>
              <p style={{ fontSize: 12, lineHeight: 1.5, margin: '4px 0 0', color: 'var(--text-muted)' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <SignaturePad ref={sigRef} label="Patient signature" />

        <div className="modal-footer">
          <button type="button" className="btn" onClick={previewPdf}>
            <Download size={14} /> Preview PDF
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSign} disabled={busy}>
            <FileCheck size={14} /> {busy ? 'Saving…' : 'Sign & Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}
