import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, ClipboardList, AlertTriangle, ArrowRight } from 'lucide-react';
import { Employees, Tasks } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatDate, startDateLabel } from '../services/format.js';
import ProgressBar from './ProgressBar.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { active, completedCount, myOpen, overdue, myTasks } = useMemo(() => {
    const all = Employees.listWithProgress();
    const activeList = all.filter((e) => e.status === 'onboarding');
    return {
      active: activeList,
      completedCount: all.filter((e) => e.status === 'completed').length,
      myOpen: Tasks.openCountForUser(user.id),
      overdue: Tasks.overdueCount(),
      myTasks: Tasks.forAssignee(user.id).filter((t) => t.status === 'pending').slice(0, 6),
    };
  }, [user.id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
            Welcome back, {user.full_name.split(' ')[0]} — here's where onboarding stands today.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 mb-4">
        <StatCard icon={<Users size={18} />} label="Active onboardings" value={active.length} />
        <StatCard icon={<CheckCircle2 size={18} />} label="Completed" value={completedCount} />
        <StatCard
          icon={<ClipboardList size={18} />}
          label="My open tasks"
          value={myOpen}
          accent="accent"
          onClick={() => navigate('/my-tasks')}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Overdue tasks"
          value={overdue}
          accent={overdue > 0 ? 'danger' : undefined}
        />
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">In progress</h3>
            <button className="btn btn-sm" onClick={() => navigate('/employees')}>
              View all <ArrowRight size={13} />
            </button>
          </div>
          {active.length === 0 && (
            <div className="empty-state">No active onboardings. Add an employee to begin.</div>
          )}
          {active.map((e) => (
            <div key={e.id} className="list-row" onClick={() => navigate(`/employees/${e.id}`)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="list-row-title">
                  {e.first_name} {e.last_name}
                </div>
                <div className="list-row-sub">
                  {e.position || 'No position'} · {startDateLabel(e.start_date)}
                </div>
              </div>
              <div style={{ width: 160 }}>
                <ProgressBar percent={e.percent} />
                <div className="text-xs text-muted text-right">
                  {e.task_done}/{e.applicable} done
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">My next tasks</h3>
            <button className="btn btn-sm" onClick={() => navigate('/my-tasks')}>
              My Tasks <ArrowRight size={13} />
            </button>
          </div>
          {myTasks.length === 0 && (
            <div className="empty-state">You're all caught up — no open tasks assigned to you.</div>
          )}
          {myTasks.map((t) => (
            <div key={t.id} className="list-row" onClick={() => navigate(`/employees/${t.employee_id}`)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="list-row-title">{t.title}</div>
                <div className="list-row-sub">
                  {t.first_name} {t.last_name} · {t.section_name}
                </div>
              </div>
              <div className="text-xs text-muted">{formatDate(t.start_date)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent, onClick }) {
  return (
    <div className={'stat-card' + (onClick ? ' stat-card-clickable' : '')} onClick={onClick}>
      <div className={'stat-icon' + (accent ? ' stat-icon-' + accent : '')}>{icon}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
}
