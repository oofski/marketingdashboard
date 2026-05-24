import { useEffect, useState } from 'react';
import { UserPlus, Trash2, KeyRound, X } from 'lucide-react';
import { Users, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);

  function refresh() {
    setUsers(Users.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  if (user.role !== 'admin') {
    return (
      <div className="empty-state">
        Administrators only. Sign in as an admin to manage users.
      </div>
    );
  }

  async function handleCreate(data) {
    if (Users.findByUsername(data.username)) {
      throw new Error('Username already exists');
    }
    const id = await Users.create(data);
    Audit.log({ user_id: user.id, username: user.username, action: 'user_create', entity: 'user', entity_id: id });
    setShowForm(false);
    refresh();
  }

  function handleDelete(u) {
    if (u.id === user.id) return;
    if (!confirm(`Delete user ${u.username}?`)) return;
    Users.remove(u.id);
    Audit.log({ user_id: user.id, username: user.username, action: 'user_delete', entity: 'user', entity_id: u.id });
    refresh();
  }

  async function handleChangePassword(newPassword) {
    if (!passwordTarget) return;
    await Users.updatePassword(passwordTarget.id, newPassword);
    Audit.log({ user_id: user.id, username: user.username, action: 'user_password_reset', entity: 'user', entity_id: passwordTarget.id });
    setPasswordTarget(null);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <div className="page-subtitle">{users.length} active accounts</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <UserPlus size={14} /> Add User
          </button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.full_name}</td>
                <td><span className="badge badge-accent">{u.role}</span></td>
                <td className="text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm" onClick={() => setPasswordTarget(u)}>
                    <KeyRound size={12} /> Reset Password
                  </button>{' '}
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(u)}
                    disabled={u.id === user.id}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <UserFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}
      {passwordTarget && (
        <PasswordResetModal
          target={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSubmit={handleChangePassword}
        />
      )}
    </div>
  );
}

function UserFormModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role: 'doctor' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password.trim() || !form.full_name.trim()) {
      setError('All fields are required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add User</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          <div className="field">
            <label className="label">Full Name</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Username</label>
            <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Role</label>
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="doctor">Doctor</option>
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create User'}
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
          <h2 className="modal-title">Reset password for {target.username}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || password.length < 4}>
              {busy ? 'Saving…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
