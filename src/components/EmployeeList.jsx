import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Employees, Audit } from '../services/db.js';
import { notifyTeam } from '../services/notify.js';
import { useAuth, canManageEmployees } from '../contexts/AuthContext.jsx';
import { startDateLabel, employeeStatusMeta } from '../services/format.js';
import ProgressBar from './ProgressBar.jsx';
import EmployeeFormModal from './EmployeeFormModal.jsx';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
];

export default function EmployeeList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const canManage = canManageEmployees(user);

  function refresh() {
    setRows(Employees.listWithProgress({ search, status }));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function handleCreate(data) {
    const { build_onboarding = true, notify_team = false, ...emp } = data;
    const id = await Employees.create({ ...emp, created_by: user.id }, { buildOnboarding: build_onboarding });
    Audit.log({
      user_id: user.id,
      username: user.username,
      action: 'employee_create',
      entity: 'employee',
      entity_id: id,
      details: `${emp.first_name} ${emp.last_name}`,
    });
    setShowForm(false);
    if (notify_team) {
      const res = notifyTeam({ kind: 'onboarding', employee: { ...emp, id } });
      if (!res.ok) alert(res.reason);
    }
    navigate(`/employees/${id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <div className="page-subtitle">{rows.length} shown — click anyone to open their checklist.</div>
        </div>
        {canManage && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add employee
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            className="input"
            placeholder="Search by name, position or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={'filter-tab' + (status === f.value ? ' active' : '')}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty-state">
            No employees here yet.{canManage ? ' Click “Add employee” to start one.' : ''}
          </div>
        ) : (
          <table className="table table-clickable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Start date</th>
                <th>Owner</th>
                <th>Status</th>
                <th style={{ width: 200 }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const meta = employeeStatusMeta(e.status);
                return (
                  <tr key={e.id} onClick={() => navigate(`/employees/${e.id}`)}>
                    <td>
                      <strong>{e.first_name} {e.last_name}</strong>
                    </td>
                    <td>{e.position || <span className="text-muted">—</span>}</td>
                    <td>{startDateLabel(e.start_date)}</td>
                    <td>{e.manager_name || <span className="text-muted">—</span>}</td>
                    <td>
                      <span className={'badge ' + meta.badge}>{meta.label}</span>
                      {e.offboarding_count > 0 && (
                        <span className="badge badge-warning" style={{ marginLeft: 4 }}>Offboarding</span>
                      )}
                    </td>
                    <td>
                      <ProgressBar percent={e.percent} />
                      <div className="text-xs text-muted">
                        {e.task_done}/{e.applicable} done
                        {e.task_pending > 0 ? ` · ${e.task_pending} open` : ''}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <EmployeeFormModal onClose={() => setShowForm(false)} onSubmit={handleCreate} />
      )}
    </div>
  );
}
