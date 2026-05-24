import { useState } from 'react';
import { X } from 'lucide-react';
import { Patients, Audit } from '../services/db.js';
import { LANGUAGES } from '../services/translations.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const EMPTY = {
  first_name: '', last_name: '', date_of_birth: '', gender: '', phone: '', email: '',
  address: '', emergency_contact: '', emergency_phone: '', insurance_provider: '',
  insurance_id: '', medical_history: '', allergies: '', current_medications: '',
  language: 'en', notes: '',
};

export default function PatientFormModal({ patient, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(patient ? { ...EMPTY, ...patient } : EMPTY);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (patient) {
      Patients.update(patient.id, form);
      Audit.log({ user_id: user.id, username: user.username, action: 'patient_update', entity: 'patient', entity_id: patient.id });
      onSaved(patient.id);
    } else {
      const id = Patients.create(form);
      Audit.log({ user_id: user.id, username: user.username, action: 'patient_create', entity: 'patient', entity_id: id });
      onSaved(id);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{patient ? 'Edit Patient' : 'New Patient Registration'}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}

          <h4 style={{ marginTop: 0 }}>Basic Information</h4>
          <div className="field-row">
            <div className="field">
              <label className="label">First Name *</label>
              <input className="input" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Last Name *</label>
              <input className="input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
            </div>
          </div>
          <div className="field-row-3">
            <div className="field">
              <label className="label">Date of Birth</label>
              <input type="date" className="input" value={form.date_of_birth || ''} onChange={(e) => set('date_of_birth', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Gender</label>
              <select className="select" value={form.gender || ''} onChange={(e) => set('gender', e.target.value)}>
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Preferred Language</label>
              <select className="select" value={form.language || 'en'} onChange={(e) => set('language', e.target.value)}>
                {Object.entries(LANGUAGES).map(([code, lang]) => (
                  <option key={code} value={code}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>

          <h4>Contact</h4>
          <div className="field-row">
            <div className="field">
              <label className="label">Phone</label>
              <input className="input" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label">Address</label>
            <input className="input" value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Emergency Contact</label>
              <input className="input" value={form.emergency_contact || ''} onChange={(e) => set('emergency_contact', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Emergency Phone</label>
              <input className="input" value={form.emergency_phone || ''} onChange={(e) => set('emergency_phone', e.target.value)} />
            </div>
          </div>

          <h4>Insurance</h4>
          <div className="field-row">
            <div className="field">
              <label className="label">Provider</label>
              <input className="input" value={form.insurance_provider || ''} onChange={(e) => set('insurance_provider', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Member ID</label>
              <input className="input" value={form.insurance_id || ''} onChange={(e) => set('insurance_id', e.target.value)} />
            </div>
          </div>

          <h4>Medical</h4>
          <div className="field">
            <label className="label">Allergies (medications, latex, etc.)</label>
            <textarea className="textarea" value={form.allergies || ''} onChange={(e) => set('allergies', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Medical History (conditions, surgeries)</label>
            <textarea className="textarea" value={form.medical_history || ''} onChange={(e) => set('medical_history', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Current Medications</label>
            <textarea className="textarea" value={form.current_medications || ''} onChange={(e) => set('current_medications', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">General Notes</label>
            <textarea className="textarea" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {patient ? 'Save Changes' : 'Create Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
