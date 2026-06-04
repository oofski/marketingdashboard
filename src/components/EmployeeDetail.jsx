import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, FileDown, Mail, Phone, MapPin, Calendar, User, Building2,
} from 'lucide-react';
import {
  Employees, Tasks, Users, Settings as S, Audit, normalizeProgress,
} from '../services/db.js';
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

  // Group tasks into their sections, preserving order.
  const sections = [];
  const byName = {};
  for (const t of tasks) {
    if (!byName[t.section_name]) {
      byName[t.section_name] = { name: t.section_name, done_by_employee: t.done_by_employee, tasks: [] };
      sections.push(byName[t.section_name]);
    }
    byName[t.section_name].tasks.push(t);
  }

  function setStatus(task, status) {
    Tasks.setStatus(task.id, status, user.id);
    Audit.log({
      user_id: user.id, username: user.username, action: 'task_status',
      entity: 'task', entity_id: task.id, details: `${task.title} → ${status}`,
    });
    refresh();
  }

  function setAssignee(task, assigneeId) {
    Tasks.setAssignee(task.id, assigneeId ? Number(assigneeId) : null);
    refresh();
  }

  function setNotes(task, notes) {
    Tasks.setNotes(task.id, notes);
    // No full refresh needed for notes; update local copy to avoid cursor jumps.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, notes } : t)));
  }

  function handleEdit(data) {
    Employees.update(employeeId, data);
    Audit.log({
      user_id: user.id, username: user.username, action: 'employee_update',
      entity: 'employee', entity_id: employeeId,
    });
    setEditing(false);
    refresh();
  }

  function handleDelete() {
    if (!confirm(`Delete ${employee.first_name} ${employee.last_name} and their checklist? This cannot be undone.`)) return;
    Employees.remove(employeeId);
    Audit.log({
      user_id: user.id, username: user.username, action: 'employee_delete',
      entity: 'employee', entity_id: employeeId,
      details: `${employee.first_name} ${employee.last_name}`,
    });
    navigate('/employees');
  }

  function changeEmployeeStatus(status) {
    Employees.setStatus(employeeId, status);
    refresh();
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

      <div className="detail-banner">
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

      {employee.notes && (
        <div className="alert alert-info mb-4" style={{ whiteSpace: 'pre-wrap' }}>
          <strong>Notes:</strong> {employee.notes}
        </div>
      )}

      {sections.map((section) => {
        const sp = normalizeProgress({
          task_total: section.tasks.length,
          task_done: section.tasks.filter((t) => t.status === 'done').length,
          task_na: section.tasks.filter((t) => t.status === 'na').length,
        });
        return (
          <div className="card" key={section.name}>
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
                />
              ))}
            </div>
          </div>
        );
      })}

      {editing && (
        <EmployeeFormModal employee={employee} onClose={() => setEditing(false)} onSubmit={handleEdit} />
      )}
    </div>
  );
}

function TaskRow({ task, assignees, canReassign, onStatus, onAssignee, onNotes }) {
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
    </div>
  );
}
