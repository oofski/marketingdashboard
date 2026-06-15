import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Tasks, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { startDateLabel } from '../services/format.js';
import StatusControl from './StatusControl.jsx';

export default function MyTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  function refresh() {
    setTasks(Tasks.forAssignee(user.id, { includeCompletedEmployees: includeCompleted }));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, includeCompleted]);

  function setStatus(task, status) {
    Tasks.setStatus(task.id, status, user.id);
    Audit.log({
      user_id: user.id, username: user.username, action: 'task_status',
      entity: 'task', entity_id: task.id, details: `${task.title} → ${status}`,
    });
    refresh();
  }

  const visible = showDone ? tasks : tasks.filter((t) => t.status === 'pending');
  const openCount = tasks.filter((t) => t.status === 'pending').length;

  // Group by employee, preserving sort order.
  const groups = [];
  const byEmp = {};
  for (const t of visible) {
    if (!byEmp[t.employee_id]) {
      byEmp[t.employee_id] = {
        id: t.employee_id,
        name: `${t.first_name} ${t.last_name}`,
        position: t.position,
        start_date: t.start_date,
        tasks: [],
      };
      groups.push(byEmp[t.employee_id]);
    }
    byEmp[t.employee_id].tasks.push(t);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <div className="page-subtitle">
            {openCount} open {openCount === 1 ? 'task' : 'tasks'} assigned to you.
          </div>
        </div>
        <div className="page-actions">
          <label className="check-inline">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show completed
          </label>
          <label className="check-inline">
            <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
            Include finished employees
          </label>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="card">
          <div className="empty-state">
            {openCount === 0 ? 'Nothing assigned to you right now. 🎉' : 'No tasks match this filter.'}
          </div>
        </div>
      )}

      {groups.map((g) => (
        <div className="card" key={g.id}>
          <div className="section-head">
            <div>
              <h3 className="card-title">{g.name}</h3>
              <div className="text-xs text-muted">
                {g.position || 'No position'} · {startDateLabel(g.start_date)}
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => navigate(`/employees/${g.id}`)}>
              Open checklist <ExternalLink size={12} />
            </button>
          </div>

          <div className="task-table">
            {g.tasks.map((t) => (
              <div className={'task-row status-row-' + t.status} key={t.id}>
                <div className="task-main">
                  <div className="task-title">
                    {t.title}
                    {t.track === 'offboarding' && (
                      <span className="badge badge-warning" style={{ marginLeft: 8 }}>Offboarding</span>
                    )}
                  </div>
                  <div className="task-sub">{t.section_name}</div>
                </div>
                {t.notes ? <div className="task-notes-readonly text-sm text-muted">{t.notes}</div> : <div />}
                <StatusControl value={t.status} onChange={(s) => setStatus(t, s)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
