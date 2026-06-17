import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X, GripVertical } from 'lucide-react';
import { Template, Users, Audit } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function TemplateEditor() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [tasksBySection, setTasksBySection] = useState({});
  const [sectionModal, setSectionModal] = useState(null); // null | 'new' | section
  const [templateType, setTemplateType] = useState('onboarding');
  const assignees = Users.assignable();

  function refresh() {
    const secs = Template.sections(templateType);
    const tasks = Template.tasks(templateType);
    const grouped = {};
    for (const s of secs) grouped[s.id] = [];
    for (const t of tasks) (grouped[t.section_id] = grouped[t.section_id] || []).push(t);
    setSections(secs);
    setTasksBySection(grouped);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType]);

  function audit(action, details) {
    Audit.log({ user_id: user.id, username: user.username, action, entity: 'template', details });
  }

  async function saveSection(data) {
    if (data.id) {
      await Template.updateSection(data.id, data);
      audit('template_section_update', data.name);
    } else {
      await Template.addSection({ ...data, template_type: templateType });
      audit('template_section_add', data.name);
    }
    setSectionModal(null);
    refresh();
  }

  async function deleteSection(s) {
    if (!confirm(`Delete the “${s.name}” section and its tasks from the template?`)) return;
    await Template.removeSection(s.id);
    audit('template_section_delete', s.name);
    refresh();
  }

  async function addTask(sectionId, title) {
    if (!title.trim()) return;
    await Template.addTask({ section_id: sectionId, title: title.trim(), default_assignee_id: null });
    refresh();
  }

  async function updateTaskTitle(task, title) {
    if (!title.trim() || title === task.title) return;
    await Template.updateTask(task.id, { title: title.trim(), default_assignee_id: task.default_assignee_id });
    refresh();
  }

  async function updateTaskAssignee(task, assigneeId) {
    await Template.updateTask(task.id, { title: task.title, default_assignee_id: assigneeId ? Number(assigneeId) : null });
    refresh();
  }

  async function deleteTask(task) {
    await Template.removeTask(task.id);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Checklist Template</h1>
          <div className="page-subtitle">
            {templateType === 'offboarding'
              ? 'The offboarding checklist — applied when an admin starts offboarding for an employee.'
              : 'The onboarding checklist — applied automatically to every new employee.'}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setSectionModal('new')}>
            <Plus size={14} /> Add section
          </button>
        </div>
      </div>

      <div className="filter-tabs mb-4">
        <button
          className={'filter-tab' + (templateType === 'onboarding' ? ' active' : '')}
          onClick={() => setTemplateType('onboarding')}
        >
          Onboarding
        </button>
        <button
          className={'filter-tab' + (templateType === 'offboarding' ? ' active' : '')}
          onClick={() => setTemplateType('offboarding')}
        >
          Offboarding
        </button>
      </div>

      <div className="alert alert-info mb-4">
        Adding or removing a task here now also updates everyone who is <strong>currently</strong> on/offboarding —
        the task is added to (or removed from) their live checklist right away. People who have already finished keep
        their checklist as-is. Renaming a section or changing its business only affects people added afterward.
      </div>

      {sections.map((s) => (
        <div className="card" key={s.id}>
          <div className="section-head">
            <div>
              <h3 className="card-title">
                {s.name}
                {s.business ? <span className="badge badge-warning" style={{ marginLeft: 8 }}>{s.business} only</span> : null}
                {s.done_by_employee ? <span className="badge" style={{ marginLeft: 8 }}>Done by employee</span> : null}
              </h3>
              {s.description && <div className="text-xs text-muted">{s.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setSectionModal(s)}><Pencil size={12} /></button>
              <button className="btn btn-sm btn-danger" onClick={() => deleteSection(s)}><Trash2 size={12} /></button>
            </div>
          </div>

          <div className="task-table">
            {(tasksBySection[s.id] || []).map((t) => (
              <div className="template-task-row" key={t.id}>
                <GripVertical size={14} className="text-muted" />
                <input
                  className="input input-sm"
                  defaultValue={t.title}
                  onBlur={(e) => updateTaskTitle(t, e.target.value)}
                />
                <select
                  className="select select-sm"
                  value={t.default_assignee_id || ''}
                  onChange={(e) => updateTaskAssignee(t, e.target.value)}
                  disabled={s.done_by_employee}
                >
                  <option value="">{s.done_by_employee ? 'Employee' : 'Unassigned'}</option>
                  {assignees.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
                <button className="btn btn-sm btn-ghost" onClick={() => deleteTask(t)}><Trash2 size={12} /></button>
              </div>
            ))}
            <AddTaskRow onAdd={(title) => addTask(s.id, title)} />
          </div>
        </div>
      ))}

      {sectionModal && (
        <SectionModal
          target={sectionModal === 'new' ? null : sectionModal}
          onClose={() => setSectionModal(null)}
          onSubmit={saveSection}
        />
      )}
    </div>
  );
}

function AddTaskRow({ onAdd }) {
  const [title, setTitle] = useState('');
  function submit() {
    onAdd(title);
    setTitle('');
  }
  return (
    <div className="template-task-row add-task-row">
      <Plus size={14} className="text-muted" />
      <input
        className="input input-sm"
        placeholder="Add a task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="btn btn-sm" onClick={submit} disabled={!title.trim()}>Add</button>
    </div>
  );
}

function SectionModal({ target, onClose, onSubmit }) {
  const isEdit = !!target;
  const [form, setForm] = useState({
    id: target?.id,
    name: target?.name || '',
    description: target?.description || '',
    done_by_employee: target ? !!target.done_by_employee : false,
    business: target?.business || '',
  });
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Section name is required.');
      return;
    }
    onSubmit(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit section' : 'Add section'}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          <div className="field">
            <label className="label">Section name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label className="label">Description (optional)</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Applies to business</label>
            <select className="select" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })}>
              <option value="">Any business (everyone)</option>
              {['IBW', 'Neroli', 'SKNBar', 'Nala'].map((b) => (
                <option key={b} value={b}>{b} only</option>
              ))}
            </select>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              Pick a business to build this section only for employees in that business. “Any business” builds it for everyone.
            </div>
          </div>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.done_by_employee}
              onChange={(e) => setForm({ ...form, done_by_employee: e.target.checked })}
            />
            Tasks in this section are completed by the employee themselves
          </label>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save' : 'Add section'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
