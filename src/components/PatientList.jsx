import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, AlertTriangle } from 'lucide-react';
import { Patients } from '../services/db.js';
import PatientFormModal from './PatientFormModal.jsx';

export default function PatientList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [showForm, setShowForm] = useState(false);

  function refresh() {
    setPatients(Patients.list({ search }));
  }

  useEffect(() => {
    refresh();
  }, [search]);

  function handleCreated(id) {
    setShowForm(false);
    refresh();
    navigate(`/patients/${id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Patients</h1>
          <div className="page-subtitle">{patients.length} {patients.length === 1 ? 'patient' : 'patients'} found</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Patient
          </button>
        </div>
      </div>

      <div className="card">
        <div className="field" style={{ position: 'relative', marginBottom: 16 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search by name, phone, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {patients.length === 0 ? (
          <div className="empty-state">
            No patients yet. Click "New Patient" to register one.
          </div>
        ) : (
          <table className="table table-clickable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>DOB</th>
                <th>Phone</th>
                <th>Language</th>
                <th>Alerts</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/patients/${p.id}`)}>
                  <td><span className="badge">#{p.id}</span></td>
                  <td><strong>{p.last_name}, {p.first_name}</strong></td>
                  <td>{p.date_of_birth || '—'}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.language?.toUpperCase() || 'EN'}</td>
                  <td>
                    {p.allergies && (
                      <span className="badge badge-danger" title={p.allergies}>
                        <AlertTriangle size={11} style={{ marginRight: 4 }} /> Allergy
                      </span>
                    )}
                  </td>
                  <td className="text-muted">{new Date(p.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <PatientFormModal
          onClose={() => setShowForm(false)}
          onSaved={handleCreated}
        />
      )}
    </div>
  );
}
