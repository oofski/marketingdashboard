import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Download } from 'lucide-react';
import { Documents, run } from '../services/db.js';

export default function ArchiveView() {
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  function refresh() {
    let sql = `SELECT d.*, p.first_name, p.last_name
               FROM documents d JOIN patients p ON p.id = d.patient_id
               WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ` AND (LOWER(p.first_name) LIKE ? OR LOWER(p.last_name) LIKE ?
               OR LOWER(d.doc_type) LIKE ?)`;
      const term = `%${search.toLowerCase()}%`;
      params.push(term, term, term);
    }
    if (typeFilter) {
      sql += ' AND d.doc_type = ?';
      params.push(typeFilter);
    }
    if (dateFilter) {
      sql += " AND date(d.created_at) = date(?)";
      params.push(dateFilter);
    }
    sql += ' ORDER BY d.created_at DESC LIMIT 500';
    setDocs(run(sql, params));
  }

  useEffect(() => {
    refresh();
  }, [search, typeFilter, dateFilter]);

  async function viewDoc(d) {
    if (window.electronAPI?.isElectron) {
      const bytes = await window.electronAPI.readDoc(d.filename);
      if (!bytes) return;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } else {
      const stored = localStorage.getItem('doc:' + d.filename);
      if (stored) window.open(stored, '_blank');
    }
  }

  async function exportDoc(d) {
    if (window.electronAPI?.isElectron) {
      const bytes = await window.electronAPI.readDoc(d.filename);
      if (!bytes) return;
      await window.electronAPI.exportDoc(d.filename, bytes);
    } else {
      const stored = localStorage.getItem('doc:' + d.filename);
      if (!stored) return;
      const a = document.createElement('a');
      a.href = stored;
      a.download = d.filename;
      a.click();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Document Archive</h1>
          <div className="page-subtitle">{docs.length} document{docs.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="card">
        <div className="field-row-3">
          <div className="field" style={{ position: 'relative' }}>
            <label className="label">Search</label>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 33, color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 30 }}
              placeholder="Patient name or document type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Type</label>
            <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="consent_form">Consent form</option>
              <option value="treatment_report">Treatment report</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Date</label>
            <input type="date" className="input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="empty-state">No documents match your filters.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Type</th>
                <th>Status</th>
                <th>Language</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link to={`/patients/${d.patient_id}`}>
                      <strong>{d.last_name}, {d.first_name}</strong>
                    </Link>
                  </td>
                  <td><span className="badge badge-accent">{d.doc_type.replace('_', ' ')}</span></td>
                  <td>
                    {d.signed ? <span className="badge badge-success">Signed</span> : <span className="badge">Unsigned</span>}
                  </td>
                  <td>{d.language?.toUpperCase() || '—'}</td>
                  <td className="text-muted">{new Date(d.created_at).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm" onClick={() => viewDoc(d)}>
                      <ExternalLink size={12} /> View
                    </button>{' '}
                    <button className="btn btn-sm" onClick={() => exportDoc(d)}>
                      <Download size={12} /> Export
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
