import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, FileCheck, Save, CheckCircle, AlertTriangle, Calendar,
} from 'lucide-react';
import {
  Patients, Visits, ToothFindings, Notes, Documents, Settings, Users, Audit,
} from '../services/db.js';
import {
  generateTreatmentReportPdf, savePdfAsBytes, pdfDataUrl,
} from '../services/pdf.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import ToothChart from './ToothChart.jsx';
import ClinicalNotesPanel from './ClinicalNotesPanel.jsx';
import ConsentFormModal from './ConsentFormModal.jsx';

export default function VisitScreen() {
  const { patientId, visitId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [visit, setVisit] = useState(null);
  const [tab, setTab] = useState('chart');
  const [reason, setReason] = useState('');
  const [nextAppointment, setNextAppointment] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);

  function refresh() {
    const p = Patients.get(Number(patientId));
    const v = Visits.get(Number(visitId));
    setPatient(p);
    setVisit(v);
    if (v) {
      setReason(v.reason || '');
      setNextAppointment(v.next_appointment || '');
    }
  }

  useEffect(() => {
    refresh();
  }, [patientId, visitId]);

  if (!patient || !visit) {
    return <div className="empty-state">Visit not found.</div>;
  }

  function saveVisitDetails() {
    Visits.update(visit.id, {
      reason,
      status: visit.status,
      next_appointment: nextAppointment || null,
    });
    refresh();
  }

  async function generateReport() {
    setSavingReport(true);
    try {
      const clinic = Settings.all();
      const findings = ToothFindings.forVisit(visit.id);
      const notes = Notes.forVisit(visit.id);
      const doctor = visit.doctor_id
        ? Users.list().find((u) => u.id === visit.doctor_id)
        : user;
      const refreshedVisit = { ...visit, reason, next_appointment: nextAppointment };
      const doc = generateTreatmentReportPdf({
        clinic, patient, visit: refreshedVisit, doctor, findings, notes,
      });
      const bytes = await savePdfAsBytes(doc);
      const filename = `report-${patient.id}-v${visit.id}-${Date.now()}.pdf`;
      if (window.electronAPI?.isElectron) {
        await window.electronAPI.saveDoc(filename, bytes);
      } else {
        localStorage.setItem('doc:' + filename, pdfDataUrl(doc));
      }
      const docId = Documents.create({
        patient_id: patient.id,
        visit_id: visit.id,
        doc_type: 'treatment_report',
        filename,
        signed: false,
      });
      Audit.log({
        user_id: user.id, username: user.username,
        action: 'report_generate', entity: 'document', entity_id: docId,
      });
      setReportUrl(pdfDataUrl(doc));
    } finally {
      setSavingReport(false);
    }
  }

  function completeVisit() {
    saveVisitDetails();
    Visits.update(visit.id, {
      reason,
      status: 'completed',
      next_appointment: nextAppointment || null,
    });
    Audit.log({ user_id: user.id, username: user.username, action: 'visit_complete', entity: 'visit', entity_id: visit.id });
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/patients/${patient.id}`)}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">Visit · {patient.first_name} {patient.last_name}</h1>
            <div className="page-subtitle">
              {new Date(visit.visit_date).toLocaleString()} · Visit #{visit.id} ·
              <span className={'badge ' + (visit.status === 'completed' ? 'badge-success' : 'badge-accent')} style={{ marginLeft: 6 }}>
                {visit.status}
              </span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setShowConsent(true)}>
            <FileText size={14} /> Consent Form
          </button>
          <button className="btn" onClick={generateReport} disabled={savingReport}>
            <FileCheck size={14} /> {savingReport ? 'Generating…' : 'Generate Report'}
          </button>
          {visit.status !== 'completed' && (
            <button className="btn btn-primary" onClick={completeVisit}>
              <CheckCircle size={14} /> Complete Visit
            </button>
          )}
        </div>
      </div>

      {/* Patient alerts banner */}
      {(patient.allergies || patient.medical_history) && (
        <div className="alert alert-warning">
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
          {patient.allergies && <strong>Allergies: {patient.allergies}</strong>}
          {patient.allergies && patient.medical_history && ' · '}
          {patient.medical_history && <span>Medical: {patient.medical_history}</span>}
        </div>
      )}

      <div className="tabs">
        <div className={'tab' + (tab === 'chart' ? ' active' : '')} onClick={() => setTab('chart')}>
          Tooth Chart
        </div>
        <div className={'tab' + (tab === 'notes' ? ' active' : '')} onClick={() => setTab('notes')}>
          Clinical Notes
        </div>
        <div className={'tab' + (tab === 'details' ? ' active' : '')} onClick={() => setTab('details')}>
          Visit Details
        </div>
        {reportUrl && (
          <div className={'tab' + (tab === 'report' ? ' active' : '')} onClick={() => setTab('report')}>
            Report Preview
          </div>
        )}
      </div>

      {tab === 'chart' && (
        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <ToothChart visitId={visit.id} />
          <ClinicalNotesPanel visitId={visit.id} />
        </div>
      )}

      {tab === 'notes' && (
        <ClinicalNotesPanel visitId={visit.id} />
      )}

      {tab === 'details' && (
        <div className="card" style={{ maxWidth: 700 }}>
          <h3 className="card-title">Visit Details</h3>
          <div className="field">
            <label className="label">Reason for Visit</label>
            <textarea
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Next Appointment</label>
            <input
              type="datetime-local"
              className="input"
              value={nextAppointment ? formatLocalDt(nextAppointment) : ''}
              onChange={(e) => setNextAppointment(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={saveVisitDetails}>
            <Save size={14} /> Save Details
          </button>
        </div>
      )}

      {tab === 'report' && reportUrl && (
        <div className="card">
          <h3 className="card-title">Treatment Report Preview</h3>
          <iframe src={reportUrl} className="pdf-preview" title="Treatment Report" />
        </div>
      )}

      {showConsent && (
        <ConsentFormModal
          patient={patient}
          visitId={visit.id}
          onClose={() => setShowConsent(false)}
          onSaved={() => setShowConsent(false)}
        />
      )}
    </div>
  );
}

function formatLocalDt(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
