import { useEffect, useState } from 'react';
import { UserPlus, Trash2, KeyRound, Pencil, X } from 'lucide-react';
import { Users, Audit, forceSave } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const ROLES = [
  { value: 'staff', label: 'Staff', hint: 'Works their own tasks; can view everyone.' },
  { value: 'manager', label: 'Manager', hint: 'Can add & edit employees and reassign tasks.' },
  { value: 'admin', label: 'Administrator', hint: 'Full access incl. settings, staff & template.' },
];

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [formTarget, setFormTarget] = useState(null); // null | 'new' | userObj
  const [passwordTarget, setPasswordTarget] = useState(null);

  function refresh() {
    setUsers(Users.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(data) {
    if (data.id) {
      Users.update(data.id, data);
      Audit.log({ user_id: user.id, username: user.username, action: 'user_update', entity: 'user', entity_id: data.id });
    } else {
      if (Users.findByUsername(data.username)) throw new Error('That username already exists.');
      const id = await Users.create(data);
      Audit.log({ user_id: user.id, username: user.username, action: 'user_create', entity: 'user', entity_id: id });
    }
    // Write to disk right away so a new/edited account can't be lost if the app
    // is closed or refreshes before the debounced save fires.
    await forceSave();
    setFormTarget(null);
    refresh();
  }

  async function handleDelete(u) {
    if (u.id === user.id) return;
    if (!confirm(`Remove ${u.full_name}? Their task assignments will become unassigned.`)) return;
    Users.remove(u.id);
    Audit.log({ user_id: user.id, username: user.username, action: 'user_delete', entity: 'user', entity_id: u.id });
    await forceSave();
    refresh();
  }

  async function handleChangePassword(newPassword) {
    if (!passwordTarget) return;
    await Users.updatePassword(passwordTarget.id, newPassword);
    Audit.log({ user_id: user.id, username: user.username, action: 'user_password_reset', entity: 'user', entity_id: passwordTarget.id });
    await forceSave();
    setPasswordTarget(null);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff</h1>
          <div className="page-subtitle">{users.length} accounts — these are the people tasks can be assigned to.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setFormTarget('new')}>
            <UserPlus size={14} /> Add staff
          </button>
        </div>
      </div>

      <div className="alert alert-info mb-4">
        New staff accounts start with the password <strong>welcome123</strong>. Ask each person to sign in and change it.
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.full_name}</strong></td>
                <td className="text-muted">{u.username}</td>
                <td className="text-muted">{u.email || '—'}</td>
                <td><span className="badge badge-accent">{u.role}</span></td>
                <td>
                  {u.active ? <span className="badge badge-success">Active</span> : <span className="badge">Inactive</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" onClick={() => setFormTarget(u)}><Pencil size={12} /></button>{' '}
                  <button className="btn btn-sm" onClick={() => setPasswordTarget(u)}><KeyRound size={12} /> Password</button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)} disabled={u.id === user.id}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formTarget && (
        <UserFormModal
          target={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSubmit={handleSubmit}
        />
      )}
      {passwordTarget && (
        <PasswordResetModal target={passwordTarget} onClose={() => setPasswordTarget(null)} onSubmit={handleChangePassword} />
      )}
    </div>
  );
}

function UserFormModal({ target, onClose, onSubmit }) {
  const isEdit = !!target;
  const [form, setForm] = useState({
    id: target?.id,
    username: target?.username || '',
    full_name: target?.full_name || '',
    email: target?.email || '',
    password: 'welcome123',
    role: target?.role || 'staff',
    active: target ? !!target.active : true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim() || (!isEdit && !form.username.trim())) {
      setError('Name and username are required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit staff member' : 'Add staff member'}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          <div className="field">
            <label className="label">Full name</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
          </div>
          {!isEdit && (
            <div className="field">
              <label className="label">Username</label>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} />
            </div>
          )}
          <div className="field">
            <label className="label">Role</label>
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <div className="text-xs text-muted mt-2">{ROLES.find((r) => r.value === form.role)?.hint}</div>
          </div>
          <div className="field">
            <label className="label">Company email</label>
            <input
              className="input"
              type="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}
            />
            <div className="text-xs text-muted mt-2">Used for the “email the team” notifications when someone is onboarded or offboarded.</div>
          </div>
          {isEdit && (
            <label className="check-inline">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active (can sign in)
            </label>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordResetModal({ target, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 4) return;
    setBusy(true);
    await onSubmit(password);
    setBusy(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Reset password — {target.full_name}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label className="label">New password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || password.length < 4}>
              {busy ? 'Saving…' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
