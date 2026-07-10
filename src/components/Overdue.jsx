import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Tasks, Audit } from '../services/db.js';
import { useAuth, isAdmin } from '../contexts/AuthContext.jsx';
import { startDateLabel } from '../services/format.js';

export default function Overdue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const admin = isAdmin(user);

  function refresh() {
    setRows(Tasks.overdue());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function del(t) {
    if (!confirm(`Delete the task “${t.title}” for ${t.first_name} ${t.last_name}? This cannot be undone.`)) return;
    await Tasks.remove(t.id);
    Audit.log({
      user_id: user.id, username: user.username, action: 'task_delete',
      entity: 'task', entity_id: t.id, details: t.title,
    });
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"><AlertTriangle size={18} /> Overdue tasks</h1>
          <div className="page-subtitle">
            {rows.length} pending {rows.length === 1 ? 'task' : 'tasks'} for employees whose start date has already passed.
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty-state">Nothing overdue — everyone's on track. 🎉</div>
        ) : (
          <table className="table table-clickable">
            <thead>
              <tr>
                <th>Task</th>
                <th>Employee</th>
                <th>Started</th>
                <th>Assigned to</th>
                {admin && <th style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td onClick={() => navigate(`/employees/${t.employee_id}`)}>
                    <strong>{t.title}</strong>
                    <div className="text-xs text-muted">{t.section_name}</div>
                  </td>
                  <td onClick={() => navigate(`/employees/${t.employee_id}`)}>{t.first_name} {t.last_name}</td>
                  <td onClick={() => navigate(`/employees/${t.employee_id}`)}>{startDateLabel(t.start_date)}</td>
                  <td onClick={() => navigate(`/employees/${t.employee_id}`)}>
                    {t.assignee_name || <span className="text-muted">—</span>}
                  </td>
                  {admin && (
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-danger" onClick={() => del(t)} title="Delete this task">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
