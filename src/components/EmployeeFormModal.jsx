import { useState } from 'react';
import { X } from 'lucide-react';
import { Users } from '../services/db.js';

const STATUS_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EmployeeFormModal({ employee, onClose, onSubmit }) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    position: employee?.position || '',
    department: employee?.department || '',
    location: employee?.location || '',
    start_date: employee?.start_date || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    manager_id: employee?.manager_id || '',
    status: employee?.status || 'onboarding',
    notes: employee?.notes || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const managers = Users.assignable();

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit employee' : 'Add employee'}</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          {!isEdit && (
            <div className="alert alert-info">
              The full onboarding checklist will be created automatically from your template.
            </div>
          )}
          <div className="field-row">
            <div className="field">
              <label className="label">First name *</label>
              <input className="input" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="label">Last name *</label>
              <input className="input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Position</label>
              <input className="input" value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="e.g. Housekeeping" />
            </div>
            <div className="field">
              <label className="label">Start date</label>
              <input type="date" className="input" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Onboarding owner</label>
              <select className="select" value={form.manager_id} onChange={(e) => set('manager_id', e.target.value)}>
                <option value="">— None —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div className="field">
                <label className="label">Status</label>
                <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="field">
            <label className="label">Notes</label>
            <textarea className="textarea" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee & build checklist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
