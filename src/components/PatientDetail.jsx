import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit, AlertTriangle, FileText, Plus, ClipboardPlus, Pill,
  Phone, Mail, Calendar, Shield,
} from 'lucide-react';
import { Patients, Visits, Documents, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import PatientFormModal from './PatientFormModal.jsx';
import ConsentFormModal from './ConsentFormModal.jsx';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  function refresh() {
    const pid = Number(id);
    setPatient(Patients.get(pid));
    setVisits(Visits.listForPatient(pid));
    setDocuments(Documents.forPatient(pid));
  }

  useEffect(() => {
    refresh();
  }, [id]);

  if (!patient) {
    return <div className="empty-state">Patient not found.</div>;
  }

  function startVisit() {
    const visitId = Visits.create(patient.id, user.id, 'Routine examination');
    Audit.log({ user_id: user.id, username: user.username, action: 'visit_start', entity: 'visit', entity_id: visitId });
    navigate(`/patients/${patient.id}/visits/${visitId}`);
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">{patient.first_name} {patient.last_name}</h1>
            <div className="page-subtitle">Patient #{patient.id} · Registered {new Date(patient.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setShowEdit(true)}><Edit size={14} /> Edit</button>
          <button className="btn" onClick={() => setShowConsent(true)}><FileText size={14} /> Consent Form</button>
          <button className="btn btn-primary" onClick={startVisit}><Plus size={14} /> Start Visit</button>
        </div>
      </div>

      {/* Alerts */}
      {(patient.allergies || patient.medical_history || patient.current_medications) && (
        <div className="alerts-bar">
          {patient.allergies && (
            <div className="alert-chip" style={{ background: 'rgba(201,59,59,0.12)', borderColor: 'rgba(201,59,59,0.4)', color: 'var(--danger)' }}>
              <AlertTriangle size={12} /> Allergies: {patient.allergies}
            </div>
          )}
          {patient.medical_history && (
            <div className="alert-chip">
              <ClipboardPlus size={12} /> Medical: {patient.medical_history.substring(0, 80)}{patient.medical_history.length > 80 ? '…' : ''}
            </div>
          )}
          {patient.current_medications && (
            <div className="alert-chip">
              <Pill size={12} /> Medications: {patient.current_medications.substring(0, 80)}{patient.current_medications.length > 80 ? '…' : ''}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2">
        <div>
          {/* Patient details */}
          <div className="card">
            <h3 className="card-title mb-2">Patient Information</h3>
            <DetailRow icon={<Calendar size={14} />} label="Date of Birth" value={patient.date_of_birth} />
            <DetailRow label="Gender" value={patient.gender} />
            <DetailRow icon={<Phone size={14} />} label="Phone" value={patient.phone} />
            <DetailRow icon={<Mail size={14} />} label="Email" value={patient.email} />
            <DetailRow label="Address" value={patient.address} />
            <DetailRow label="Emergency Contact" value={patient.emergency_contact ? `${patient.emergency_contact} · ${patient.emergency_phone || ''}` : null} />
            <DetailRow icon={<Shield size={14} />} label="Insurance"
              value={patient.insurance_provider ? `${patient.insurance_provider} · ${patient.insurance_id || ''}` : null} />
            <DetailRow label="Preferred Language" value={patient.language?.toUpperCase()} />
            {patient.notes && (
              <div className="mt-4">
                <div className="label">Notes</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{patient.notes}</div>
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Documents & Forms</h3>
              <span className="badge">{documents.length}</span>
            </div>
            {documents.length === 0 ? (
              <div className="empty-state">No documents yet.</div>
            ) : (
              documents.map((d) => (
                <div key={d.id} className="note-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.doc_type.replace('_', ' ')}</div>
                    <div className="note-meta">
                      {d.signed ? <span className="badge badge-success">Signed</span> : <span className="badge">Unsigned</span>}
                      {d.language && <span>· {d.language.toUpperCase()}</span>}
                      <span>· {new Date(d.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => viewDocument(d)}>View</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          {/* Visits */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Visit History</h3>
              <button className="btn btn-sm btn-primary" onClick={startVisit}>
                <Plus size={12} /> New Visit
              </button>
            </div>
            {visits.length === 0 ? (
              <div className="empty-state">No visits recorded yet.</div>
            ) : (
              visits.map((v) => (
                <Link to={`/patients/${patient.id}/visits/${v.id}`} key={v.id}
                  className="note-item" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{new Date(v.visit_date).toLocaleString()}</div>
                      <div className="note-meta">
                        <span className={'badge ' + (v.status === 'completed' ? 'badge-success' : 'badge-accent')}>{v.status}</span>
                        {v.doctor_name && <span>· Dr. {v.doctor_name}</span>}
                        {v.reason && <span>· {v.reason}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <PatientFormModal
          patient={patient}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); refresh(); }}
        />
      )}
      {showConsent && (
        <ConsentFormModal
          patient={patient}
          onClose={() => setShowConsent(false)}
          onSaved={() => { setShowConsent(false); refresh(); }}
        />
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 130, color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {label}
      </div>
      <div style={{ flex: 1, fontSize: 13 }}>{value}</div>
    </div>
  );
}

async function viewDocument(d) {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const bytes = await window.electronAPI.readDoc(d.filename);
    if (!bytes) return;
    const blob = new Blob([bytes], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob), '_blank');
  } else {
    const stored = localStorage.getItem('doc:' + d.filename);
    if (stored) window.open(stored, '_blank');
  }
}
