import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, CalendarDays, FileText, ClipboardList, AlertTriangle, Plus } from 'lucide-react';
import { Patients, Visits, Documents, Audit, run } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ patients: 0, todayVisits: 0, openVisits: 0, docs: 0 });
  const [queue, setQueue] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);

  useEffect(() => {
    const patients = run('SELECT COUNT(*) as c FROM patients')[0]?.c || 0;
    const todayVisits = run("SELECT COUNT(*) as c FROM visits WHERE date(visit_date) = date('now')")[0]?.c || 0;
    const openVisits = run("SELECT COUNT(*) as c FROM visits WHERE status = 'open'")[0]?.c || 0;
    const docs = run('SELECT COUNT(*) as c FROM documents')[0]?.c || 0;
    setStats({ patients, todayVisits, openVisits, docs });
    setQueue(Visits.todayQueue());
    setRecentDocs(Documents.recent(6));
  }, []);

  function openVisit(v) {
    navigate(`/patients/${v.patient_id}/visits/${v.id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, Dr. {user.full_name}</h1>
          <div className="page-subtitle">Here's what's happening at the clinic today.</div>
        </div>
        <div className="page-actions">
          <Link to="/patients" className="btn btn-primary">
            <Plus size={16} /> New Patient Visit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 mb-4">
        <StatCard icon={<Users size={18} />} label="Total Patients" value={stats.patients} />
        <StatCard icon={<CalendarDays size={18} />} label="Today's Visits" value={stats.todayVisits} />
        <StatCard icon={<ClipboardList size={18} />} label="Open Visits" value={stats.openVisits} />
        <StatCard icon={<FileText size={18} />} label="Documents Archived" value={stats.docs} />
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Today's Patient Queue</h3>
              <div className="card-subtitle">{queue.length} visits scheduled or in progress</div>
            </div>
          </div>
          {queue.length === 0 ? (
            <div className="empty-state">No visits today. Use the Patients page to start one.</div>
          ) : (
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Alerts</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((v) => (
                  <tr key={v.id} onClick={() => openVisit(v)}>
                    <td><strong>{v.first_name} {v.last_name}</strong></td>
                    <td>{new Date(v.visit_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className={'badge ' + (v.status === 'completed' ? 'badge-success' : 'badge-accent')}>
                        {v.status}
                      </span>
                    </td>
                    <td>
                      {v.allergies && (
                        <span className="badge badge-danger" title={v.allergies}>
                          <AlertTriangle size={11} style={{ marginRight: 4 }} /> Allergies
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recent Documents</h3>
              <div className="card-subtitle">Latest generated reports and forms</div>
            </div>
            <Link to="/archive" className="btn btn-sm">View all</Link>
          </div>
          {recentDocs.length === 0 ? (
            <div className="empty-state">No documents generated yet.</div>
          ) : (
            <div>
              {recentDocs.map((d) => (
                <div key={d.id} className="note-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.first_name} {d.last_name}</div>
                    <div className="note-meta">
                      <span className="badge">{d.doc_type}</span>
                      {d.signed ? <span className="badge badge-success">Signed</span> : null}
                      <span>{new Date(d.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <Link to={`/patients/${d.patient_id}`} className="btn btn-sm">Open</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="stat-label">{label}</div>
        <div style={{ color: 'var(--accent)' }}>{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
