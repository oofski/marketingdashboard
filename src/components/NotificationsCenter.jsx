import { useState } from 'react';
import { Mail, Send, Users as UsersIcon } from 'lucide-react';
import { Employees, Tasks, Users, Audit } from '../services/db.js';
import { remindEveryone, emailEmployeeTasks } from '../services/notify.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function NotificationsCenter() {
  const { user } = useAuth();
  const employees = Employees.listWithProgress();
  const staff = Users.list().filter((u) => u.active && u.email);
  const teamCount = staff.length;
  const [empId, setEmpId] = useState('');
  const [recipients, setRecipients] = useState(() => staff.map((u) => u.email));
  const [msg, setMsg] = useState('');

  const allSelected = teamCount > 0 && recipients.length === teamCount;

  function toggleRecipient(email) {
    setRecipients((r) => (r.includes(email) ? r.filter((x) => x !== email) : [...r, email]));
  }
  function toggleAll() {
    setRecipients(allSelected ? [] : staff.map((u) => u.email));
  }

  function sendReminder() {
    const res = remindEveryone();
    if (!res.ok) { setMsg(res.reason); return; }
    Audit.log({ user_id: user.id, username: user.username, action: 'email_remind_all' });
    setMsg(`Opened an email to all ${res.count} staff — review it in your mail app and hit Send.`);
  }

  function sendEmployeeTasks() {
    if (!empId || recipients.length === 0) return;
    const emp = Employees.get(Number(empId));
    const tasks = Tasks.forEmployee(Number(empId));
    const res = emailEmployeeTasks(emp, tasks, recipients);
    if (!res.ok) { setMsg(res.reason); return; }
    Audit.log({
      user_id: user.id, username: user.username, action: 'email_employee_tasks',
      entity: 'employee', entity_id: Number(empId),
    });
    setMsg(`Opened an email listing ${res.taskCount} open task(s) for ${emp.first_name} ${emp.last_name} to ${res.count} recipient(s).`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"><Mail size={18} /> Notifications</h1>
          <div className="page-subtitle">
            Send the team email reminders. {teamCount} staff have an email on file.
          </div>
        </div>
      </div>

      {msg && <div className="alert alert-info mb-4">{msg}</div>}
      {teamCount === 0 && (
        <div className="alert alert-warning mb-4">
          No staff have an email address yet — add them in Admin → Staff so notifications can reach people.
        </div>
      )}

      <div className="card" style={{ maxWidth: 760 }}>
        <h3 className="card-title"><UsersIcon size={15} /> Remind everyone</h3>
        <div className="card-subtitle mb-4">
          Emails the whole team a nudge to open the app and complete their assigned tasks.
        </div>
        <button className="btn btn-primary" onClick={sendReminder} disabled={teamCount === 0}>
          <Send size={14} /> Email all staff a reminder
        </button>
      </div>

      <div className="card" style={{ maxWidth: 760 }}>
        <h3 className="card-title">Email an employee's task list</h3>
        <div className="card-subtitle mb-4">
          Pick a new hire (or someone offboarding), choose who should get it, and email out their list of open tasks.
        </div>
        <div className="field">
          <label className="label">Employee</label>
          <select className="select" value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">— Choose an employee —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name}{e.business ? ` · ${e.business}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Send to</label>
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto',
              border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
            }}
          >
            {teamCount === 0 ? (
              <span className="text-xs text-muted">No staff with an email address on file yet.</span>
            ) : (
              <>
                <label className="check-inline">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  <strong>All staff</strong>
                </label>
                {staff.map((u) => (
                  <label className="check-inline" key={u.id}>
                    <input
                      type="checkbox"
                      checked={recipients.includes(u.email)}
                      onChange={() => toggleRecipient(u.email)}
                    />
                    {u.full_name} <span className="text-muted">({u.email})</span>
                  </label>
                ))}
              </>
            )}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
            {recipients.length} of {teamCount} staff selected.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={sendEmployeeTasks}
          disabled={!empId || recipients.length === 0}
        >
          <Send size={14} /> Email their open tasks
        </button>
      </div>
    </div>
  );
}
