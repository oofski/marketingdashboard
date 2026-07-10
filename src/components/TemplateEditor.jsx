import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X, GripVertical, LayoutGrid, Check } from 'lucide-react';
import { Template, Users, Audit, BlockLibrary } from '../services/db.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function TemplateEditor() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [tasksBySection, setTasksBySection] = useState({});
  const [sectionModal, setSectionModal] = useState(null); // null | 'new' | section
  const [showLibrary, setShowLibrary] = useState(false);
  const [blockEditor, setBlockEditor] = useState(null); // null | 'new' | block
  const [blocks, setBlocks] = useState([]);
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

  function loadBlocks() {
    setBlocks(BlockLibrary.all());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType]);

  useEffect(() => {
    loadBlocks();
  }, []);

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

  // Drop a pre-built block into the current template: create its section, then
  // add each of its tasks (assigned to the block's named person if we can match
  // one). Behaves exactly like building the section by hand.
  async function addBlock(block) {
    const assignee = block.assignee ? assignees.find((a) => a.full_name === block.assignee) : null;
    const sectionId = await Template.addSection({
      name: block.name,
      description: block.description,
      done_by_employee: block.done_by_employee,
      template_type: templateType,
    });
    for (const t of block.tasks) {
      await Template.addTask({ section_id: sectionId, title: t.title, default_assignee_id: assignee?.id ?? null });
    }
    audit('template_block_add', `${block.company}: ${block.name}`);
    refresh();
  }

  // Create or update a block in the shared library (stored in the cloud).
  async function saveBlock(data) {
    if (data.id) {
      await BlockLibrary.update(data.id, data);
      audit('block_update', `${data.company}: ${data.name}`);
    } else {
      await BlockLibrary.add(data);
      audit('block_create', `${data.company}: ${data.name}`);
    }
    setBlockEditor(null);
    loadBlocks();
  }

  async function deleteBlock(block) {
    if (!confirm(
      `Delete the pre-built block “${block.name}”? This only removes it from the library — `
      + `any template you already added it to stays exactly as it is.`
    )) return;
    await BlockLibrary.remove(block.id);
    audit('block_delete', `${block.company}: ${block.name}`);
    loadBlocks();
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
          <button className="btn" onClick={() => setShowLibrary(true)}>
            <LayoutGrid size={14} /> Pre-built sections
          </button>
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

      <div className="alert alert-warning mb-4">
        Editing the template only affects employees added <strong>after</strong> the change. People already in the
        system keep the checklist they were created with.
      </div>

      {sections.map((s) => (
        <div className="card" key={s.id}>
          <div className="section-head">
            <div>
              <h3 className="card-title">
                {s.name}
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

      {showLibrary && (
        <BlockLibraryModal
          templateType={templateType}
          blocks={blocks}
          existingNames={sections.map((s) => (s.name || '').toLowerCase())}
          onClose={() => setShowLibrary(false)}
          onAdd={addBlock}
          onNew={() => setBlockEditor('new')}
          onEdit={(b) => setBlockEditor(b)}
          onDelete={deleteBlock}
        />
      )}

      {blockEditor && (
        <BlockEditorModal
          target={blockEditor === 'new' ? null : blockEditor}
          defaultType={templateType}
          assignees={assignees}
          onClose={() => setBlockEditor(null)}
          onSave={saveBlock}
        />
      )}
    </div>
  );
}

// A picker + manager of pre-built sections ("building blocks"), grouped by
// company and filtered to the template (onboarding/offboarding) being edited.
// Admins can Add a block to the template, or create/edit/delete blocks in the
// shared library. Stays open after adding so several can be dropped in at once.
function BlockLibraryModal({ templateType, blocks, existingNames, onClose, onAdd, onNew, onEdit, onDelete }) {
  const [busyId, setBusyId] = useState(null);
  const forType = blocks.filter((b) => b.template_type === templateType);
  const companies = [];
  for (const b of forType) if (!companies.includes(b.company)) companies.push(b.company);

  async function handleAdd(block) {
    setBusyId(block.id);
    try {
      await onAdd(block);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Pre-built {templateType} sections</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-subtitle mb-4">
          Ready-made sections you can drop into your {templateType} template with one click. Create your own with
          <strong> New block</strong> — they’re saved for the whole team.
        </div>

        <div className="mb-4">
          <button className="btn btn-primary btn-sm" onClick={onNew}>
            <Plus size={13} /> New block
          </button>
        </div>

        {forType.length === 0 ? (
          <div className="empty-state">
            No pre-built {templateType} sections yet. Click <strong>New block</strong> to create one.
          </div>
        ) : (
          companies.map((company) => (
            <div key={company} style={{ marginBottom: 14 }}>
              <div className="label" style={{ marginBottom: 6 }}>{company}</div>
              {forType.filter((b) => b.company === company).map((b) => {
                const already = existingNames.includes((b.name || '').toLowerCase());
                return (
                  <div className="card" key={b.id} style={{ marginBottom: 8 }}>
                    <div className="section-head">
                      <div>
                        <h3 className="card-title">{b.name}</h3>
                        {b.description && <div className="text-xs text-muted">{b.description}</div>}
                        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                          {b.tasks.length} task{b.tasks.length === 1 ? '' : 's'}
                          {b.assignee ? ` · assigned to ${b.assignee}` : ''}: {b.tasks.map((t) => t.title).join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={already || busyId === b.id}
                          onClick={() => handleAdd(b)}
                        >
                          {already ? <><Check size={12} /> Added</> : busyId === b.id ? 'Adding…' : <><Plus size={12} /> Add</>}
                        </button>
                        <button className="btn btn-sm" title="Edit block" onClick={() => onEdit(b)}><Pencil size={12} /></button>
                        <button className="btn btn-sm btn-danger" title="Delete block" onClick={() => onDelete(b)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// Create / edit a single pre-built block: company, which template it belongs to,
// section name, an optional "assign every task to" person, and the task list.
function BlockEditorModal({ target, defaultType, assignees, onClose, onSave }) {
  const isEdit = !!target;
  const [form, setForm] = useState({
    company: target?.company || '',
    template_type: target?.template_type || defaultType,
    name: target?.name || '',
    description: target?.description || '',
    done_by_employee: target ? !!target.done_by_employee : false,
    assignee: target?.assignee || '',
    tasks: target?.tasks ? target.tasks.map((t) => t.title) : [],
  });
  const [newTask, setNewTask] = useState('');
  const [error, setError] = useState('');

  function addTaskLine() {
    const t = newTask.trim();
    if (!t) return;
    setForm((f) => ({ ...f, tasks: [...f.tasks, t] }));
    setNewTask('');
  }
  function updateTaskLine(idx, value) {
    setForm((f) => ({ ...f, tasks: f.tasks.map((t, i) => (i === idx ? value : t)) }));
  }
  function removeTaskLine(idx) {
    setForm((f) => ({ ...f, tasks: f.tasks.filter((_, i) => i !== idx) }));
  }

  function submit(e) {
    e.preventDefault();
    const tasks = form.tasks.map((t) => t.trim()).filter(Boolean);
    if (!form.company.trim()) { setError('Company / group is required.'); return; }
    if (!form.name.trim()) { setError('Section name is required.'); return; }
    if (tasks.length === 0) { setError('Add at least one task.'); return; }
    onSave({
      ...(target?.id ? { id: target.id } : {}),
      company: form.company.trim(),
      template_type: form.template_type,
      name: form.name.trim(),
      description: form.description.trim(),
      done_by_employee: form.done_by_employee,
      assignee: form.assignee,
      tasks: tasks.map((title) => ({ title })),
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit block' : 'New block'}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          <div className="field-row">
            <div className="field">
              <label className="label">Company / group</label>
              <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. IBW" autoFocus />
            </div>
            <div className="field">
              <label className="label">Template</label>
              <select className="select" value={form.template_type} onChange={(e) => setForm({ ...form, template_type: e.target.value })}>
                <option value="onboarding">Onboarding</option>
                <option value="offboarding">Offboarding</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Section name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Institute Only" />
          </div>
          <div className="field">
            <label className="label">Description (optional)</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Assign every task to (optional)</label>
            <select className="select" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
              <option value="">— Unassigned —</option>
              {assignees.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
            </select>
          </div>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.done_by_employee}
              onChange={(e) => setForm({ ...form, done_by_employee: e.target.checked })}
            />
            Tasks in this section are completed by the employee themselves
          </label>

          <div className="field" style={{ marginTop: 12 }}>
            <label className="label">Tasks</label>
            {form.tasks.length === 0 && <div className="text-xs text-muted mb-2">No tasks yet — add them below.</div>}
            {form.tasks.map((t, idx) => (
              <div className="template-task-row" key={idx}>
                <GripVertical size={14} className="text-muted" />
                <input className="input input-sm" value={t} onChange={(e) => updateTaskLine(idx, e.target.value)} />
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeTaskLine(idx)}><Trash2 size={12} /></button>
              </div>
            ))}
            <div className="template-task-row add-task-row">
              <Plus size={14} className="text-muted" />
              <input
                className="input input-sm"
                placeholder="Add a task…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTaskLine(); } }}
              />
              <button type="button" className="btn btn-sm" onClick={addTaskLine} disabled={!newTask.trim()}>Add</button>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save block' : 'Create block'}</button>
          </div>
        </form>
      </div>
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
