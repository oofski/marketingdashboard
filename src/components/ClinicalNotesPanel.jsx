import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Notes, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const CATEGORIES = [
  { value: 'exam', label: 'Examination' },
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'treatment_plan', label: 'Treatment Plan' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'general', label: 'General' },
];

const QUICK_TEMPLATES = [
  { category: 'exam', text: 'Routine cleaning completed. No significant findings.' },
  { category: 'exam', text: 'Mild gingival inflammation noted. Recommended improved oral hygiene.' },
  { category: 'exam', text: 'Patient reports sensitivity to cold beverages.' },
  { category: 'treatment_plan', text: 'Schedule composite filling at next visit.' },
  { category: 'treatment_plan', text: 'Refer to orthodontist for consultation.' },
  { category: 'treatment_plan', text: 'Recommend night guard for bruxism.' },
  { category: 'follow_up', text: 'Recall in 6 months for routine cleaning and exam.' },
  { category: 'follow_up', text: 'Follow up in 2 weeks to assess healing.' },
];

export default function ClinicalNotesPanel({ visitId, selectedTooth }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [category, setCategory] = useState('exam');
  const [content, setContent] = useState('');
  const [linkToTooth, setLinkToTooth] = useState(true);

  function refresh() {
    setNotes(Notes.forVisit(visitId));
  }

  useEffect(() => {
    refresh();
  }, [visitId]);

  function addNote(text = content, cat = category) {
    const body = text.trim();
    if (!body) return;
    const id = Notes.create(visitId, {
      category: cat,
      tooth_number: linkToTooth && selectedTooth ? selectedTooth : null,
      content: body,
    });
    Audit.log({ user_id: user.id, username: user.username, action: 'note_add', entity: 'note', entity_id: id });
    setContent('');
    refresh();
  }

  function removeNote(id) {
    Notes.remove(id);
    refresh();
  }

  return (
    <div>
      <div className="card">
        <h3 className="card-title">Add Clinical Note</h3>
        <div className="field-row">
          <div className="field">
            <label className="label">Category</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={linkToTooth}
                onChange={(e) => setLinkToTooth(e.target.checked)}
              />
              Link to selected tooth {selectedTooth ? `#${selectedTooth}` : '(none)'}
            </label>
          </div>
        </div>
        <div className="field">
          <textarea
            className="textarea"
            rows={3}
            placeholder="Type a note, or pick a quick template below…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {QUICK_TEMPLATES.filter((t) => t.category === category).slice(0, 4).map((t, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-sm"
                onClick={() => addNote(t.text, t.category)}
                title="Quick add"
              >
                + {t.text.slice(0, 36)}{t.text.length > 36 ? '…' : ''}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => addNote()}>
            <Plus size={14} /> Add Note
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Clinical Notes</h3>
          <span className="badge">{notes.length}</span>
        </div>
        {notes.length === 0 ? (
          <div className="empty-state">No notes yet. Add one above.</div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="note-item">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="note-meta">
                  <span className="badge badge-accent">
                    {CATEGORIES.find((c) => c.value === n.category)?.label || n.category}
                  </span>
                  {n.tooth_number && <span className="badge">Tooth #{n.tooth_number}</span>}
                  <span>· {new Date(n.created_at).toLocaleString()}</span>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => removeNote(n.id)} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="note-content">{n.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
