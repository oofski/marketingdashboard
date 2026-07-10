import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, FileDown, Mail, Phone, MapPin, Calendar, User, Building2,
  UserMinus, X, Hash,
} from 'lucide-react';
import {
  Employees, Tasks, Users, Settings as S, Audit, normalizeProgress,
} from '../services/db.js';
import { notifyTeam } from '../services/notify.js';
import { useAuth, canManageEmployees } from '../contexts/AuthContext.jsx';
import {
  formatDate, startDateLabel, employeeStatusMeta,
} from '../services/format.js';
import { generateChecklistPdf, savePdf } from '../services/pdf.js';
import ProgressBar from './ProgressBar.jsx';
import StatusControl from './StatusControl.jsx';
import EmployeeFormModal from './EmployeeFormModal.jsx';

export default function EmployeeDetail() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageEmployees(user);

  const [employee, setEmployee] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(false);
  const [offboardModal, setOffboardModal] = useState(false);
  const assignees = useMemo(() => Users.assignable(), []);

  function refresh() {
    const emp = Employees.get(employeeId);
    setEmployee(emp);
    setTasks(Tasks.forEmployee(employeeId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  if (!employee) {
    return (
      <div>
        <button className="btn btn-sm mb-4" onClick={() => navigate('/employees')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="empty-state">Employee not found.</div>
      </div>
    );
  }

  const progress = normalizeProgress({
    task_total: tasks.length,
    task_done: tasks.filter((t) => t.status === 'done').length,
    task_na: tasks.filter((t) => t.status === 'na').length,
    task_pending: tasks.filter((t) => t.status === 'pending').length,
  });
  const meta = employeeStatusMeta(employee.status);

  // Group tasks into their sections, preserving order (onboarding first, then
  // offboarding). Keyed by track + name so the two tracks never merge together.
  const sections = [];
  const byKey = {};
  for (const t of tasks) {
    const track = t.track || 'onboarding';
    const key = track + '::' + t.section_name;
    if (!byKey[key]) {
      byKey[key] = { name: t.section_name, track, done_by_employee: t.done_by_employee, tasks: [] };
      sections.push(byKey[key]);
    }
    byKey[key].tasks.push(t);
  }
  const hasOffboardingTasks = sections.some((s) => s.track === 'offboarding');
  const bothTracks = hasOffboardingTasks && sections.some((s) => s.track === 'onboarding');

  async function setStatus(task, status) {
    await Tasks.setStatus(task.id, status, user.id);
    Audit.log({
      user_id: user.id, username: user.username, action: 'task_status',
      entity: 'task', entity_id: task.id, details: `${task.title} → ${status}`,
    });
    refresh();
  }

  async function setAssignee(task, assigneeId) {
    await Tasks.setAssignee(task.id, assigneeId ? Number(assigneeId) : null);
    refresh();
  }

  async function setNotes(task, notes) {
    await Tasks.setNotes(task.id, notes);
    // No full refresh needed for notes; update local copy to avoid cursor jumps.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, notes } : t)));
  }

  async function deleteTask(task) {
    if (!confirm(`Delete the task “${task.title}” from this checklist? This cannot be undone.`)) return;
    await Tasks.remove(task.id);
    Audit.log({
      user_id: user.id, username: user.username, action: 'task_delete',
      entity: 'task', entity_id: task.id, details: task.title,
    });
    refresh();
  }

  async function handleEdit(data) {
    await Employees.update(employeeId, data);
    Audit.log({
      user_id: user.id, username: user.username, action: 'employee_update',
      entity: 'employee', entity_id: employeeId,
    });
    setEditing(false);
    refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${employee.first_name} ${employee.last_name} and their checklist? This cannot be undone.`)) return;
    await Employees.remove(employeeId);
    Audit.log({
      user_id: user.id, username: user.username, action: 'employee_delete',
      entity: 'employee', entity_id: employeeId,
      details: `${employee.first_name} ${employee.last_name}`,
    });
    navigate('/employees');
  }

  async function changeEmployeeStatus(status) {
    await Employees.setStatus(employeeId, status);
    refresh();
  }

  function emailTeam() {
    const kind = employee.final_day || hasOffboardingTasks ? 'offboarding' : 'onboarding';
    const res = notifyTeam({ kind, employee });
    if (!res.ok) alert(res.reason);
  }

  async function handleStartOffboarding({ final_day, notify_team }) {
    await Employees.startOffboarding(employeeId, final_day || null);
    Audit.log({
      user_id: user.id, username: user.username, action: 'employee_offboarding_start',
      entity: 'employee', entity_id: employeeId,
      details: `${employee.first_name} ${employee.last_name}`,
    });
    setOffboardModal(false);
    refresh();
    if (notify_team) {
      const res = notifyTeam({
        kind: 'offboarding',
        employee: { ...employee, final_day: final_day || employee.final_day },
      });
      if (!res.ok) alert(res.reason);
    }
  }

  async function exportPdf() {
    const company = S.all();
    const doc = generateChecklistPdf({ company, employee, tasks, progress });
    await savePdf(doc, `Onboarding-${employee.last_name}-${employee.first_name}.pdf`);
  }

  return (
    <div>
      <button className="btn btn-sm mb-4" onClick={() => navigate('/employees')}>
        <ArrowLeft size={14} /> All employees
      </button>

      <div className={'detail-banner' + (hasOffboardingTasks ? ' offboarding' : '')}>
        <div>
          <div className="detail-banner-name">
            {employee.first_name} {employee.last_name}
            <span className={'badge ' + meta.badge} style={{ marginLeft: 10, verticalAlign: 'middle' }}>
              {meta.label}
            </span>
          </div>
          <div className="detail-banner-meta">
            {employee.position || 'No position set'}
            {employee.department ? ` · ${employee.department}` : ''}
          </div>
          <div className="detail-chips">
            {employee.employee_code && <span className="detail-chip"><Hash size={12} /> ID: {employee.employee_code}</span>}
            <span className="detail-chip"><Calendar size={12} /> {startDateLabel(employee.start_date)}</span>
            {employee.location && <span className="detail-chip"><MapPin size={12} /> {employee.location}</span>}
            {employee.manager_name && <span className="detail-chip"><User size={12} /> Owner: {employee.manager_name}</span>}
            {employee.email && <span className="detail-chip"><Mail size={12} /> {employee.email}</span>}
            {employee.phone && <span className="detail-chip"><Phone size={12} /> {employee.phone}</span>}
          </div>
        </div>
        <div className="detail-banner-side">
          <div className="detail-progress-num">{progress.percent}%</div>
          <div className="text-xs" style={{ opacity: 0.9 }}>
            {progress.done}/{progress.applicable} done
            {progress.na > 0 ? ` · ${progress.na} N/A` : ''}
          </div>
          <ProgressBar percent={progress.percent} showLabel={false} />
          <div className="detail-banner-actions">
            <button className="btn btn-sm" onClick={exportPdf} title="Export checklist as PDF">
              <FileDown size={13} /> PDF
            </button>
            {canManage && (
              <>
                <button className="btn btn-sm" onClick={emailTeam} title="Email the team about this employee">
                  <Mail size={13} /> Email team
                </button>
                <button className="btn btn-sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={handleDelete}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <div className="status-switch mb-4">
          <span className="text-xs text-muted" style={{ marginRight: 4 }}>Onboarding status:</span>
          {['onboarding', 'on_hold', 'completed', 'cancelled'].map((st) => (
            <button
              key={st}
              className={'filter-tab' + (employee.status === st ? ' active' : '')}
              onClick={() => changeEmployeeStatus(st)}
            >
              {employeeStatusMeta(st).label}
            </button>
          ))}
        </div>
      )}

      {canManage && (
        <div className="status-switch mb-4">
          {hasOffboardingTasks ? (
            <span className="badge badge-warning">
              <UserMinus size={12} /> Offboarding{employee.final_day ? ` · final day ${formatDate(employee.final_day)}` : ''}
            </span>
          ) : (
            <button className="btn btn-sm" onClick={() => setOffboardModal(true)}>
              <UserMinus size={14} /> Start offboarding
            </button>
          )}
        </div>
      )}

      {employee.notes && (
        <div className="alert alert-info mb-4" style={{ whiteSpace: 'pre-wrap' }}>
          <strong>Notes:</strong> {employee.notes}
        </div>
      )}

      {sections.map((section, idx) => {
        const sp = normalizeProgress({
          task_total: section.tasks.length,
          task_done: section.tasks.filter((t) => t.status === 'done').length,
          task_na: section.tasks.filter((t) => t.status === 'na').length,
        });
        const prevTrack = idx > 0 ? sections[idx - 1].track : null;
        const showHeading = bothTracks && section.track !== prevTrack;
        return (
          <div key={section.track + '::' + section.name}>
            {showHeading && (
              <h2 className="track-heading">
                {section.track === 'offboarding'
                  ? <><UserMinus size={16} /> Offboarding</>
                  : <><User size={16} /> Onboarding</>}
              </h2>
            )}
            <div className="card">
              <div className="section-head">
                <div>
                  <h3 className="card-title">
                    {section.name}
                    {section.done_by_employee ? (
                      <span className="badge" style={{ marginLeft: 8 }}><Building2 size={11} /> Done by employee</span>
                    ) : null}
                  </h3>
                  <div className="text-xs text-muted">{sp.done}/{sp.applicable} complete</div>
                </div>
                <div style={{ width: 120 }}><ProgressBar percent={sp.percent} /></div>
              </div>

              <div className="task-table">
                {section.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    assignees={assignees}
                    canReassign={canManage && !section.done_by_employee}
                    onStatus={(s) => setStatus(task, s)}
                    onAssignee={(a) => setAssignee(task, a)}
                    onNotes={(n) => setNotes(task, n)}
                    onDelete={canManage ? () => deleteTask(task) : null}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {editing && (
        <EmployeeFormModal employee={employee} onClose={() => setEditing(false)} onSubmit={handleEdit} />
      )}
      {offboardModal && (
        <OffboardingModal
          employee={employee}
          onClose={() => setOffboardModal(false)}
          onSubmit={handleStartOffboarding}
        />
      )}
    </div>
  );
}

function OffboardingModal({ employee, onClose, onSubmit }) {
  const [finalDay, setFinalDay] = useState(employee.final_day || '');
  const [notify, setNotify] = useState(false);

  function submit(e) {
    e.preventDefault();
    onSubmit({ final_day: finalDay, notify_team: notify });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Start offboarding — {employee.first_name} {employee.last_name}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="alert alert-info">
            This builds the offboarding checklist from your Offboarding template and assigns its tasks.
            It won't change any onboarding tasks.
          </div>
          <div className="field">
            <label className="label">Final day</label>
            <input type="date" className="input" value={finalDay} onChange={(e) => setFinalDay(e.target.value)} autoFocus />
          </div>
          <label className="check-inline">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Email the team a heads-up
          </label>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              <UserMinus size={14} /> Start offboarding
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskRow({ task, assignees, canReassign, onStatus, onAssignee, onNotes, onDelete }) {
  const [notes, setNotesLocal] = useState(task.notes || '');

  useEffect(() => {
    setNotesLocal(task.notes || '');
  }, [task.id, task.notes]);

  return (
    <div className={'task-row status-row-' + task.status}>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {task.status === 'done' && task.completed_by_name && (
          <div className="task-sub">
            Done by {task.completed_by_name} · {formatDate(task.completed_at)}
          </div>
        )}
      </div>

      <div className="task-assignee">
        {canReassign ? (
          <select
            className="select select-sm"
            value={task.assignee_id || ''}
            onChange={(e) => onAssignee(e.target.value)}
          >
            <option value="">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted">{task.assignee_name || '—'}</span>
        )}
      </div>

      <input
        className="input input-sm task-notes"
        placeholder="Notes…"
        value={notes}
        onChange={(e) => setNotesLocal(e.target.value)}
        onBlur={() => notes !== (task.notes || '') && onNotes(notes)}
      />

      <StatusControl value={task.status} onChange={onStatus} />
      {onDelete && (
        <button className="btn btn-sm btn-ghost" onClick={onDelete} title="Delete this task">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
