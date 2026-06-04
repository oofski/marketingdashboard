import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  DEFAULT_SECTIONS,
  DEFAULT_STAFF,
  DEFAULT_STAFF_PASSWORD,
} from './checklistTemplate.js';

async function loadSqlJs() {
  const mod = await import('sql.js/dist/sql-wasm.js');
  return mod.default || mod;
}

let SQL = null;
let db = null;
let saveTimeout = null;
let lastMtime = null;

const STORAGE_KEY = 'onboarding_tracker_db_v1';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  location TEXT,
  start_date TEXT,
  email TEXT,
  phone TEXT,
  manager_id INTEGER,
  status TEXT DEFAULT 'onboarding',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  done_by_employee INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS template_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  default_assignee_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  template_task_id INTEGER,
  section_name TEXT,
  section_order INTEGER DEFAULT 0,
  done_by_employee INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  assignee_id INTEGER,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  completed_at TEXT,
  completed_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

const DEFAULT_SETTINGS = {
  company_name: 'Neroli',
  company_subtitle: 'Onboarding Tracker',
  company_address: '',
  company_phone: '',
  company_email: '',
  theme: 'light',
};

export async function hashPassword(plain) {
  const enc = new TextEncoder().encode(plain + '::onboarding_salt_v1');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function loadPersisted() {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const data = await window.electronAPI.readDb();
    lastMtime = (await window.electronAPI.dbStat?.())?.mtimeMs ?? null;
    return data ? new Uint8Array(data) : null;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  const binStr = atob(stored);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

async function writePersisted(bytes) {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    await window.electronAPI.writeDb(bytes);
    lastMtime = (await window.electronAPI.dbStat?.())?.mtimeMs ?? lastMtime;
    return;
  }
  let binStr = '';
  for (let i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
  localStorage.setItem(STORAGE_KEY, btoa(binStr));
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!db) return;
    const data = db.export();
    await writePersisted(data);
  }, 200);
}

export async function initDatabase() {
  if (db) return db;
  if (!SQL) {
    const initSqlJs = await loadSqlJs();
    SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  }
  const existing = await loadPersisted();
  db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.exec(SCHEMA);
  await seedDefaults();
  if (!existing) {
    await forceSave();
  }
  return db;
}

async function seedDefaults() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = run('SELECT value FROM settings WHERE key = ?', [key]);
    if (existing.length === 0) {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  const userCount = run('SELECT COUNT(*) as c FROM users')[0]?.c ?? 0;
  if (userCount === 0) {
    const adminHash = await hashPassword('admin123');
    run(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      ['admin', adminHash, 'Administrator', 'admin']
    );
    const staffHash = await hashPassword(DEFAULT_STAFF_PASSWORD);
    for (const s of DEFAULT_STAFF) {
      run(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [s.username, staffHash, s.full_name, s.role]
      );
    }
  }

  const sectionCount = run('SELECT COUNT(*) as c FROM sections')[0]?.c ?? 0;
  if (sectionCount === 0) {
    seedTemplate();
  }
}

function seedTemplate() {
  const userByName = {};
  for (const u of run('SELECT id, full_name FROM users')) {
    userByName[u.full_name] = u.id;
  }
  DEFAULT_SECTIONS.forEach((section, sIdx) => {
    run(
      'INSERT INTO sections (name, description, sort_order, done_by_employee) VALUES (?, ?, ?, ?)',
      [section.name, section.description || null, sIdx, section.doneByEmployee ? 1 : 0]
    );
    const sectionId = lastInsertId();
    section.tasks.forEach((task, tIdx) => {
      const assigneeId = task.assignee ? userByName[task.assignee] ?? null : null;
      run(
        `INSERT INTO template_tasks (section_id, title, default_assignee_id, sort_order)
         VALUES (?, ?, ?, ?)`,
        [sectionId, task.title, assigneeId, tIdx]
      );
    });
  });
}

export function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
    if (/^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)/i.test(sql)) {
      scheduleSave();
    }
  }
}

export function lastInsertId() {
  const res = run('SELECT last_insert_rowid() as id');
  return res[0]?.id ?? null;
}

// --- Shared-folder freshness ------------------------------------------------
// Returns true if the database file on disk is newer than what we loaded,
// meaning another computer saved changes we don't have yet.
export async function hasExternalUpdate() {
  if (typeof window === 'undefined' || !window.electronAPI?.isElectron) return false;
  const stat = await window.electronAPI.dbStat?.();
  if (!stat || stat.mtimeMs == null || lastMtime == null) return false;
  // Allow small clock jitter (50ms) before flagging an update.
  return stat.mtimeMs > lastMtime + 50;
}

// --- Domain helpers ---------------------------------------------------------

export const Users = {
  list() {
    return run(
      'SELECT id, username, full_name, role, active, created_at FROM users ORDER BY full_name'
    );
  },
  assignable() {
    return run(
      "SELECT id, full_name, role FROM users WHERE active = 1 ORDER BY full_name"
    );
  },
  get(id) {
    return run('SELECT id, username, full_name, role, active FROM users WHERE id = ?', [id])[0] ?? null;
  },
  findByUsername(username) {
    return run('SELECT * FROM users WHERE username = ?', [username])[0] ?? null;
  },
  async create({ username, password, full_name, role = 'staff' }) {
    const hash = await hashPassword(password);
    run(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hash, full_name, role]
    );
    return lastInsertId();
  },
  update(id, { full_name, role, active }) {
    run('UPDATE users SET full_name = ?, role = ?, active = ? WHERE id = ?', [
      full_name,
      role,
      active ? 1 : 0,
      id,
    ]);
  },
  async updatePassword(id, password) {
    const hash = await hashPassword(password);
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  },
  remove(id) {
    // Keep historical assignments readable: null them out rather than orphan.
    run('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [id]);
    run('UPDATE template_tasks SET default_assignee_id = NULL WHERE default_assignee_id = ?', [id]);
    run('DELETE FROM users WHERE id = ?', [id]);
  },
};

function seedTasksForEmployee(employeeId) {
  const rows = run(
    `SELECT s.name AS section_name, s.sort_order AS section_order, s.done_by_employee,
            tt.id AS template_task_id, tt.title, tt.default_assignee_id, tt.sort_order
     FROM template_tasks tt
     JOIN sections s ON s.id = tt.section_id
     WHERE tt.active = 1
     ORDER BY s.sort_order, tt.sort_order`
  );
  for (const r of rows) {
    run(
      `INSERT INTO tasks
        (employee_id, template_task_id, section_name, section_order, done_by_employee,
         title, assignee_id, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        employeeId,
        r.template_task_id,
        r.section_name,
        r.section_order,
        r.done_by_employee,
        r.title,
        r.default_assignee_id ?? null,
        r.sort_order,
      ]
    );
  }
}

const PROGRESS_SELECT = `
  COUNT(t.id) AS task_total,
  SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS task_done,
  SUM(CASE WHEN t.status = 'na' THEN 1 ELSE 0 END) AS task_na,
  SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS task_pending
`;

export const Employees = {
  listWithProgress({ search = '', status = 'all' } = {}) {
    const where = [];
    const params = [];
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      where.push(
        `(LOWER(e.first_name) LIKE ? OR LOWER(e.last_name) LIKE ?
          OR LOWER(e.position) LIKE ? OR LOWER(e.department) LIKE ?)`
      );
      params.push(term, term, term, term);
    }
    if (status && status !== 'all') {
      where.push('e.status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = run(
      `SELECT e.*, ${PROGRESS_SELECT},
              u.full_name AS manager_name
       FROM employees e
       LEFT JOIN tasks t ON t.employee_id = e.id
       LEFT JOIN users u ON u.id = e.manager_id
       ${whereSql}
       GROUP BY e.id
       ORDER BY (e.status != 'onboarding'), e.start_date IS NULL, e.start_date ASC, e.created_at DESC`,
      params
    );
    // Attach computed percent / applicable so callers can read them directly.
    return rows.map((e) => ({ ...e, ...normalizeProgress(e) }));
  },
  get(id) {
    return run(
      `SELECT e.*, u.full_name AS manager_name
       FROM employees e LEFT JOIN users u ON u.id = e.manager_id
       WHERE e.id = ?`,
      [id]
    )[0] ?? null;
  },
  progress(id) {
    const row = run(
      `SELECT ${PROGRESS_SELECT} FROM tasks t WHERE t.employee_id = ?`,
      [id]
    )[0] ?? {};
    return normalizeProgress(row);
  },
  create(data) {
    run(
      `INSERT INTO employees
        (first_name, last_name, position, department, location, start_date,
         email, phone, manager_id, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.first_name,
        data.last_name,
        data.position || null,
        data.department || null,
        data.location || null,
        data.start_date || null,
        data.email || null,
        data.phone || null,
        data.manager_id || null,
        data.status || 'onboarding',
        data.notes || null,
        data.created_by || null,
      ]
    );
    const id = lastInsertId();
    seedTasksForEmployee(id);
    return id;
  },
  update(id, data) {
    run(
      `UPDATE employees SET first_name = ?, last_name = ?, position = ?, department = ?,
        location = ?, start_date = ?, email = ?, phone = ?, manager_id = ?, status = ?,
        notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        data.first_name,
        data.last_name,
        data.position || null,
        data.department || null,
        data.location || null,
        data.start_date || null,
        data.email || null,
        data.phone || null,
        data.manager_id || null,
        data.status || 'onboarding',
        data.notes || null,
        id,
      ]
    );
  },
  setStatus(id, status) {
    run("UPDATE employees SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
  },
  remove(id) {
    run('DELETE FROM tasks WHERE employee_id = ?', [id]);
    run('DELETE FROM employees WHERE id = ?', [id]);
  },
};

function normalizeProgress(row) {
  const total = row.task_total ?? 0;
  const done = row.task_done ?? 0;
  const na = row.task_na ?? 0;
  const pending = row.task_pending ?? 0;
  const applicable = total - na;
  const percent = applicable > 0 ? Math.round((done / applicable) * 100) : (total > 0 ? 100 : 0);
  return { total, done, na, pending, applicable, percent };
}

export { normalizeProgress };

export const Tasks = {
  forEmployee(employeeId) {
    return run(
      `SELECT t.*, u.full_name AS assignee_name, c.full_name AS completed_by_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users c ON c.id = t.completed_by
       WHERE t.employee_id = ?
       ORDER BY t.section_order, t.sort_order, t.id`,
      [employeeId]
    );
  },
  forAssignee(userId, { includeCompletedEmployees = false } = {}) {
    const empFilter = includeCompletedEmployees ? '' : "AND e.status = 'onboarding'";
    return run(
      `SELECT t.*, e.first_name, e.last_name, e.position, e.start_date,
              e.status AS employee_status
       FROM tasks t
       JOIN employees e ON e.id = t.employee_id
       WHERE t.assignee_id = ? ${empFilter}
       ORDER BY (t.status != 'pending'), e.start_date IS NULL, e.start_date ASC,
                t.section_order, t.sort_order`,
      [userId]
    );
  },
  setStatus(id, status, userId) {
    if (status === 'done') {
      run(
        `UPDATE tasks SET status = 'done', completed_at = datetime('now'),
          completed_by = ?, updated_at = datetime('now') WHERE id = ?`,
        [userId || null, id]
      );
    } else {
      run(
        `UPDATE tasks SET status = ?, completed_at = NULL, completed_by = NULL,
          updated_at = datetime('now') WHERE id = ?`,
        [status, id]
      );
    }
  },
  setAssignee(id, assigneeId) {
    run("UPDATE tasks SET assignee_id = ?, updated_at = datetime('now') WHERE id = ?", [
      assigneeId || null,
      id,
    ]);
  },
  setNotes(id, notes) {
    run("UPDATE tasks SET notes = ?, updated_at = datetime('now') WHERE id = ?", [notes || null, id]);
  },
  openCountForUser(userId) {
    return run(
      `SELECT COUNT(*) AS c FROM tasks t JOIN employees e ON e.id = t.employee_id
       WHERE t.assignee_id = ? AND t.status = 'pending' AND e.status = 'onboarding'`,
      [userId]
    )[0]?.c ?? 0;
  },
  overdueCount() {
    return run(
      `SELECT COUNT(*) AS c FROM tasks t JOIN employees e ON e.id = t.employee_id
       WHERE t.status = 'pending' AND e.status = 'onboarding'
         AND e.start_date IS NOT NULL AND date(e.start_date) < date('now')`
    )[0]?.c ?? 0;
  },
};

// Master checklist template editing (Admin → Checklist Template).
export const Template = {
  sections() {
    return run('SELECT * FROM sections ORDER BY sort_order, id');
  },
  tasks() {
    return run(
      `SELECT tt.*, u.full_name AS default_assignee_name
       FROM template_tasks tt
       LEFT JOIN users u ON u.id = tt.default_assignee_id
       WHERE tt.active = 1
       ORDER BY tt.sort_order, tt.id`
    );
  },
  addSection({ name, description, done_by_employee }) {
    const max = run('SELECT MAX(sort_order) AS m FROM sections')[0]?.m ?? -1;
    run(
      'INSERT INTO sections (name, description, sort_order, done_by_employee) VALUES (?, ?, ?, ?)',
      [name, description || null, max + 1, done_by_employee ? 1 : 0]
    );
    return lastInsertId();
  },
  updateSection(id, { name, description, done_by_employee }) {
    run('UPDATE sections SET name = ?, description = ?, done_by_employee = ? WHERE id = ?', [
      name,
      description || null,
      done_by_employee ? 1 : 0,
      id,
    ]);
  },
  removeSection(id) {
    run('DELETE FROM template_tasks WHERE section_id = ?', [id]);
    run('DELETE FROM sections WHERE id = ?', [id]);
  },
  addTask({ section_id, title, default_assignee_id }) {
    const max =
      run('SELECT MAX(sort_order) AS m FROM template_tasks WHERE section_id = ?', [section_id])[0]
        ?.m ?? -1;
    run(
      `INSERT INTO template_tasks (section_id, title, default_assignee_id, sort_order)
       VALUES (?, ?, ?, ?)`,
      [section_id, title, default_assignee_id || null, max + 1]
    );
    return lastInsertId();
  },
  updateTask(id, { title, default_assignee_id }) {
    run('UPDATE template_tasks SET title = ?, default_assignee_id = ? WHERE id = ?', [
      title,
      default_assignee_id || null,
      id,
    ]);
  },
  removeTask(id) {
    run('DELETE FROM template_tasks WHERE id = ?', [id]);
  },
};

export const Audit = {
  log({ user_id, username, action, entity, entity_id, details }) {
    run(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id || null, username || null, action, entity || null, entity_id || null, details || null]
    );
  },
  recent(limit = 100) {
    return run('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?', [limit]);
  },
};

export const Settings = {
  all() {
    const rows = run('SELECT key, value FROM settings');
    const map = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  },
  get(key) {
    return run('SELECT value FROM settings WHERE key = ?', [key])[0]?.value ?? null;
  },
  set(key, value) {
    const existing = run('SELECT key FROM settings WHERE key = ?', [key]);
    if (existing.length) {
      run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
    } else {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  },
};

export function exportDatabase() {
  if (!db) return null;
  return db.export();
}

export async function importDatabase(bytes) {
  if (!SQL) {
    const initSqlJs = await loadSqlJs();
    SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  }
  db = new SQL.Database(bytes);
  db.exec(SCHEMA);
  await writePersisted(db.export());
}

export async function forceSave() {
  if (!db) return;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  await writePersisted(db.export());
}
