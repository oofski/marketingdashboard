// One-off runtime validation of the data layer against the real sql.js engine.
// Mirrors the SQL in src/services/db.js and seeds from the real template.
import initSqlJs from 'sql.js';
import { DEFAULT_SECTIONS, DEFAULT_STAFF } from '../src/services/checklistTemplate.js';

const SCHEMA = `
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, full_name TEXT, role TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE employees (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, position TEXT, department TEXT, location TEXT, start_date TEXT, email TEXT, phone TEXT, manager_id INTEGER, status TEXT DEFAULT 'onboarding', notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE sections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, sort_order INTEGER, done_by_employee INTEGER DEFAULT 0);
CREATE TABLE template_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER, title TEXT, description TEXT, default_assignee_id INTEGER, sort_order INTEGER, active INTEGER DEFAULT 1);
CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER, template_task_id INTEGER, section_name TEXT, section_order INTEGER, done_by_employee INTEGER, title TEXT, assignee_id INTEGER, status TEXT DEFAULT 'pending', notes TEXT, sort_order INTEGER, completed_at TEXT, completed_by INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
`;

const SQL = await initSqlJs();
const db = new SQL.Database();
db.exec(SCHEMA);

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function lastId() { return all('SELECT last_insert_rowid() AS id')[0].id; }
function assert(cond, msg) { if (!cond) { console.error('✗ FAIL:', msg); process.exit(1); } console.log('✓', msg); }

// Seed staff
const userByName = {};
for (const s of DEFAULT_STAFF) {
  db.run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)', [s.username, 'x', s.full_name, s.role]);
  userByName[s.full_name] = lastId();
}

// Seed template
let templateTaskCount = 0;
DEFAULT_SECTIONS.forEach((section, sIdx) => {
  db.run('INSERT INTO sections (name, description, sort_order, done_by_employee) VALUES (?,?,?,?)', [section.name, section.description || null, sIdx, section.doneByEmployee ? 1 : 0]);
  const sectionId = lastId();
  section.tasks.forEach((task, tIdx) => {
    const assigneeId = task.assignee ? userByName[task.assignee] ?? null : null;
    if (task.assignee) assert(assigneeId != null, `assignee "${task.assignee}" for "${task.title}" resolves to a known staff member`);
    db.run('INSERT INTO template_tasks (section_id, title, default_assignee_id, sort_order) VALUES (?,?,?,?)', [sectionId, task.title, assigneeId, tIdx]);
    templateTaskCount++;
  });
});
console.log(`\nSeeded ${DEFAULT_SECTIONS.length} sections, ${templateTaskCount} template tasks, ${DEFAULT_STAFF.length} staff.\n`);

// Create an employee + generate their checklist (mirrors seedTasksForEmployee)
db.run('INSERT INTO employees (first_name, last_name, position, start_date) VALUES (?,?,?,?)', ['Jonathan', 'Zator', 'Housekeeping', '2026-06-08']);
const empId = lastId();
const tmplRows = all(`SELECT s.name AS section_name, s.sort_order AS section_order, s.done_by_employee, tt.id AS template_task_id, tt.title, tt.default_assignee_id, tt.sort_order FROM template_tasks tt JOIN sections s ON s.id = tt.section_id WHERE tt.active = 1 ORDER BY s.sort_order, tt.sort_order`);
for (const r of tmplRows) {
  db.run(`INSERT INTO tasks (employee_id, template_task_id, section_name, section_order, done_by_employee, title, assignee_id, status, sort_order) VALUES (?,?,?,?,?,?,?, 'pending', ?)`,
    [empId, r.template_task_id, r.section_name, r.section_order, r.done_by_employee, r.title, r.default_assignee_id ?? null, r.sort_order]);
}

const empTasks = all('SELECT * FROM tasks WHERE employee_id = ?', [empId]);
assert(empTasks.length === templateTaskCount, `new employee got all ${templateTaskCount} checklist tasks (got ${empTasks.length})`);

// Mark a couple done / na to exercise progress math
db.run("UPDATE tasks SET status='done', completed_by=? WHERE employee_id=? AND title='W-4'", [userByName['Sandy Nguyen'] ?? null, empId]);
db.run("UPDATE tasks SET status='na' WHERE employee_id=? AND title='Noncompete'", [empId]);

// listWithProgress query
const prog = all(`SELECT e.*, COUNT(t.id) AS task_total,
  SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) AS task_done,
  SUM(CASE WHEN t.status='na' THEN 1 ELSE 0 END) AS task_na,
  SUM(CASE WHEN t.status='pending' THEN 1 ELSE 0 END) AS task_pending,
  u.full_name AS manager_name
  FROM employees e LEFT JOIN tasks t ON t.employee_id=e.id LEFT JOIN users u ON u.id=e.manager_id
  GROUP BY e.id`)[0];
assert(prog.task_total === templateTaskCount, `progress total = ${templateTaskCount}`);
assert(prog.task_done === 1, 'progress done = 1');
assert(prog.task_na === 1, 'progress na = 1');
const applicable = prog.task_total - prog.task_na;
const percent = Math.round((prog.task_done / applicable) * 100);
console.log(`  → ${prog.task_done}/${applicable} applicable = ${percent}%`);

// forEmployee (grouped/ordered) join to assignee names
const detail = all(`SELECT t.*, u.full_name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.employee_id=? ORDER BY t.section_order, t.sort_order, t.id`, [empId]);
assert(detail[0].section_name === 'New Hire Paperwork (NHP)', 'first section is NHP');
const bg = detail.find((t) => t.title === 'Background check');
assert(bg && bg.assignee_name === 'Jennifer Garcia', 'Background check assigned to Jennifer Garcia');

// forAssignee (My Tasks) for Sandy Nguyen
const sandy = userByName['Sandy Nguyen'];
const sandyTasks = all(`SELECT t.*, e.first_name, e.last_name FROM tasks t JOIN employees e ON e.id=t.employee_id WHERE t.assignee_id=? AND e.status='onboarding' ORDER BY (t.status!='pending'), t.section_order, t.sort_order`, [sandy]);
assert(sandyTasks.length > 0, `Sandy Nguyen has ${sandyTasks.length} assigned tasks`);
assert(sandyTasks[0].status === 'pending', 'My Tasks lists pending tasks first');

console.log('\nAll data-layer checks passed.');
db.close();
