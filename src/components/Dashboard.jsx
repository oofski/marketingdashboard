import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, ClipboardList, AlertTriangle, ArrowRight, UserMinus } from 'lucide-react';
import { Employees, Tasks } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatDate, startDateLabel } from '../services/format.js';
import ProgressBar from './ProgressBar.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    active, offboardingCount, completedCount, myOpen, overdue, myTasks,
    overallPct, totalDone, totalRemaining,
  } = useMemo(() => {
    const all = Employees.listWithProgress();
    // Someone who's being offboarded shows as offboarding only — never counted
    // (or listed) as an active onboarding, so one person can't show both states.
    const offboarding = all.filter((e) => e.offboarding_count > 0);
    const activeList = all.filter((e) => e.status === 'onboarding' && !e.offboarding_count);
    const done = activeList.reduce((s, e) => s + (e.done || 0), 0);
    const applicable = activeList.reduce((s, e) => s + (e.applicable || 0), 0);
    return {
      active: activeList,
      offboardingCount: offboarding.length,
      completedCount: all.filter((e) => e.status === 'completed').length,
      myOpen: Tasks.openCountForUser(user.id),
      overdue: Tasks.overdueCount(),
      myTasks: Tasks.forAssignee(user.id).filter((t) => t.status === 'pending').slice(0, 6),
      overallPct: applicable > 0 ? Math.round((done / applicable) * 100) : 0,
      totalDone: done,
      totalRemaining: Math.max(0, applicable - done),
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

      <div className="dash-tiles">
        <Tile
          variant="accent" icon={<Users size={18} />}
          label="Active onboardings" value={active.length}
          onClick={() => navigate('/employees')}
        />
        <Tile variant="amber" icon={<UserMinus size={18} />} label="Offboarding" value={offboardingCount} />
        <Tile
          variant="teal" icon={<ClipboardList size={18} />}
          label="My open tasks" value={myOpen}
          onClick={() => navigate('/my-tasks')}
        />
        <Tile
          variant={overdue > 0 ? 'red' : 'slate'} icon={<AlertTriangle size={18} />}
          label="Overdue tasks" value={overdue}
          onClick={() => navigate('/overdue')}
        />
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Onboarding progress</h3>
          </div>
          <div className="ring-card">
            <ProgressRing percent={overallPct} />
            <div className="ring-legend">
              <div className="ring-legend-item">
                <span className="ring-dot" style={{ background: 'var(--accent)' }} />
                Tasks done <span className="ring-legend-num">{totalDone}</span>
              </div>
              <div className="ring-legend-item">
                <span className="ring-dot" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-strong)' }} />
                Remaining <span className="ring-legend-num">{totalRemaining}</span>
              </div>
              <div className="ring-legend-sep" />
              <div className="ring-legend-item">
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                Completed onboardings <span className="ring-legend-num">{completedCount}</span>
              </div>
            </div>
          </div>
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
    </div>
  );
}

function Tile({ variant, icon, label, value, onClick }) {
  return (
    <div
      className={'dash-tile dash-tile-' + variant + (onClick ? ' dash-tile-clickable' : '')}
      onClick={onClick}
    >
      <div className="dash-tile-top">
        <span className="dash-tile-label">{label}</span>
        <span className="dash-tile-ico">{icon}</span>
      </div>
      <div className="dash-tile-value">{value}</div>
    </div>
  );
}

// A simple SVG donut for overall onboarding completion. One accent arc on a
// recessive track — a single-value meter, so no legend box is needed here.
function ProgressRing({ percent }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, percent || 0));
  const offset = circ * (1 - pct / 100);
  return (
    <div className="ring">
      <svg width="132" height="132" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--bg-elev-2)" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="12"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-pct">{pct}%</div>
        <div className="ring-pct-sub">complete</div>
      </div>
    </div>
  );
}
