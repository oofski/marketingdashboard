import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  apiQuery, apiLogin, apiChangePassword, apiCreateUser, apiResetPassword, setToken,
} from './api.js';
import { SECTION_LIBRARY as DEFAULT_BLOCKS } from './sectionLibrary.js';

// Cloud-backed data layer.
//
// The single source of truth is the cloud database (Cloudflare Worker + D1).
// To avoid rewriting every screen, the app keeps a local in-memory SQLite
// "mirror" hydrated from the server, so all the existing read queries (joins,
// aggregates) keep working synchronously. Every WRITE goes to the server first,
// then the mirror is refreshed from the server — so the mirror always reflects
// authoritative data (including other people's changes) right after any action.

async function loadSqlJs() {
  const mod = await import('sql.js/dist/sql-wasm.js');
  return mod.default || mod;
}

let SQL = null;
let db = null; // in-memory mirror
let lastSignature = '';

// A cheap "fingerprint" of the data, so we can detect when someone on another
// computer changed something on the server and prompt a refresh.
const SIGNATURE_SQL = `SELECT
  (SELECT COUNT(*) FROM employees) AS ec,
  (SELECT COALESCE(MAX(updated_at), '') FROM employees) AS em,
  (SELECT COUNT(*) FROM tasks) AS tc,
  (SELECT COALESCE(MAX(updated_at), '') FROM tasks) AS tm,
  (SELECT COUNT(*) FROM users) AS uc`;
function dataSignature(row) {
  if (!row) return '';
  return [row.ec, row.em, row.tc, row.tm, row.uc].join('|');
}

// Mirror schema (password_hash is nullable here — the server never sends hashes).
const MIRROR_SCHEMA = `
CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT, full_name TEXT, role TEXT, email TEXT, active INTEGER, created_at TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, position TEXT, department TEXT, location TEXT, start_date TEXT, email TEXT, phone TEXT, employee_code TEXT, manager_id INTEGER, status TEXT, final_day TEXT, notes TEXT, created_by INTEGER, created_at TEXT, updated_at TEXT);
CREATE TABLE sections (id INTEGER PRIMARY KEY, name TEXT, description TEXT, sort_order INTEGER, done_by_employee INTEGER, template_type TEXT);
CREATE TABLE template_tasks (id INTEGER PRIMARY KEY, section_id INTEGER, title TEXT, description TEXT, default_assignee_id INTEGER, sort_order INTEGER, active INTEGER);
CREATE TABLE tasks (id INTEGER PRIMARY KEY, employee_id INTEGER, template_task_id INTEGER, section_name TEXT, section_order INTEGER, done_by_employee INTEGER, track TEXT, title TEXT, assignee_id INTEGER, status TEXT, notes TEXT, sort_order INTEGER, completed_at TEXT, completed_by INTEGER, created_at TEXT, updated_at TEXT);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
`;

// Tables to hydrate into the mirror. Users are fetched WITHOUT password_hash.
const MIRROR_FETCH = [
  ['settings', 'SELECT * FROM settings'],
  ['users', 'SELECT id, username, full_name, role, email, active, created_at FROM users'],
  ['sections', 'SELECT * FROM sections'],
  ['template_tasks', 'SELECT * FROM template_tasks'],
  ['employees', 'SELECT * FROM employees'],
  ['tasks', 'SELECT * FROM tasks'],
];

function insertRows(database, table, rows) {
  if (!rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const stmt = database.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  );
  try {
    for (const row of rows) {
      stmt.bind(cols.map((c) => (row[c] === undefined ? null : row[c])));
      stmt.step();
      stmt.reset();
    }
  } finally {
    stmt.free();
  }
}

// Pull the whole dataset from the server and rebuild the local mirror.
export async function reloadMirror() {
  if (!SQL) {
    const initSqlJs = await loadSqlJs();
    SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  }
  const results = await Promise.all(MIRROR_FETCH.map(([, sql]) => apiQuery(sql)));
  const fresh = new SQL.Database();
  fresh.exec(MIRROR_SCHEMA);
  MIRROR_FETCH.forEach(([table], i) => insertRows(fresh, table, results[i].rows));
  if (db) { try { db.free(); } catch { /* ignore */ } }
  db = fresh;
  try { lastSignature = dataSignature(run(SIGNATURE_SQL)[0]); } catch { /* ignore */ }
}

export function isLoaded() { return !!db; }
export function clearMirror() {
  if (db) { try { db.free(); } catch { /* ignore */ } }
  db = null;
}

// Synchronous read against the local mirror (used by every query helper below).
function run(sql, params = []) {
  // Before sign-in the mirror isn't loaded yet, so reads (e.g. the login
  // screen's company name) return empty instead of throwing — otherwise the
  // login screen would crash to a blank window.
  if (!db) return [];
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

// Send a mutation to the server (source of truth). Returns { lastInsertId, changes }.
async function apiExec(sql, params = []) {
  const res = await apiQuery(sql, params);
  return { lastInsertId: res.lastInsertId ?? null, changes: res.changes ?? 0 };
}

// --- Auth -------------------------------------------------------------------
export async function login(username, password) {
  const res = await apiLogin(username, password);
  setToken(res.token);
  await reloadMirror();
  return res.user;
}

// --- Domain helpers ---------------------------------------------------------

export const Users = {
  list() {
    return run('SELECT id, username, full_name, role, email, active, created_at FROM users ORDER BY full_name');
  },
  teamEmails() {
    return run("SELECT email FROM users WHERE active = 1 AND email IS NOT NULL AND email != '' ORDER BY full_name").map((r) => r.email);
  },
  assignable() {
    return run('SELECT id, full_name, role FROM users WHERE active = 1 ORDER BY full_name');
  },
  get(id) {
    return run('SELECT id, username, full_name, role, email, active FROM users WHERE id = ?', [id])[0] ?? null;
  },
  findByUsername(username) {
    return run('SELECT id, username, full_name, role, active FROM users WHERE username = ?', [username])[0] ?? null;
  },
  async create({ username, password, full_name, role = 'staff', email = null }) {
    const res = await apiCreateUser({ username, password, full_name, role, email });
    await reloadMirror();
    return res.id;
  },
  async update(id, { full_name, role, active, email }) {
    await apiExec('UPDATE users SET full_name = ?, role = ?, active = ?, email = ? WHERE id = ?', [
      full_name, role, active ? 1 : 0, email || null, id,
    ]);
    await reloadMirror();
  },
  async updatePassword(id, password) {
    await apiResetPassword(id, password);
  },
  // Self-service password change: verified server-side against the logged-in user.
  async changeOwnPassword(_id, currentPlain, newPlain) {
    try {
      await apiChangePassword(currentPlain, newPlain);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  async remove(id) {
    await apiExec('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [id]);
    await apiExec('UPDATE template_tasks SET default_assignee_id = NULL WHERE default_assignee_id = ?', [id]);
    await apiExec('DELETE FROM users WHERE id = ?', [id]);
    await reloadMirror();
  },
};

async function seedTasksForEmployee(employeeId, track = 'onboarding') {
  const rows = run(
    `SELECT s.name AS section_name, s.sort_order AS section_order, s.done_by_employee,
            tt.id AS template_task_id, tt.title, tt.default_assignee_id, tt.sort_order
     FROM template_tasks tt
     JOIN sections s ON s.id = tt.section_id
     WHERE tt.active = 1 AND s.template_type = ?
     ORDER BY s.sort_order, tt.sort_order`,
    [track]
  );
  if (rows.length === 0) return;
  const tuple = "(?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)";
  // Cloudflare D1 allows at most 100 bound variables per query; at 9 per row
  // that's ~11 rows, so insert in batches of 10 to stay safely under the limit.
  const CHUNK = 10;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const params = [];
    for (const r of slice) {
      params.push(
        employeeId, r.template_task_id, r.section_name, r.section_order,
        r.done_by_employee, track, r.title, r.default_assignee_id ?? null, r.sort_order
      );
    }
    await apiExec(
      `INSERT INTO tasks
        (employee_id, template_task_id, section_name, section_order, done_by_employee,
         track, title, assignee_id, status, sort_order)
       VALUES ${slice.map(() => tuple).join(', ')}`,
      params
    );
  }
}

// The UKG-generated employee ID lives in employees.employee_code, a column
// added by a one-time D1 migration (see cloud/schema.sql). Writing it is a
// best-effort separate statement so that — until that column exists on the
// server — creating or editing an employee still succeeds; the code just isn't
// stored yet (and starts saving the moment the migration is run).
async function setEmployeeCodeSafe(id, code) {
  try {
    await apiExec('UPDATE employees SET employee_code = ? WHERE id = ?', [code || null, id]);
  } catch { /* employee_code column not present yet — ignore until migration runs */ }
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
              u.full_name AS manager_name,
              (SELECT COUNT(*) FROM tasks o WHERE o.employee_id = e.id AND o.track = 'offboarding') AS offboarding_count
       FROM employees e
       LEFT JOIN tasks t ON t.employee_id = e.id
       LEFT JOIN users u ON u.id = e.manager_id
       ${whereSql}
       GROUP BY e.id
       ORDER BY (e.status != 'onboarding'), e.start_date IS NULL, e.start_date ASC, e.created_at DESC`,
      params
    );
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
    const row = run(`SELECT ${PROGRESS_SELECT} FROM tasks t WHERE t.employee_id = ?`, [id])[0] ?? {};
    return normalizeProgress(row);
  },
  async create(data, { buildOnboarding = true } = {}) {
    const res = await apiExec(
      `INSERT INTO employees
        (first_name, last_name, position, department, location, start_date,
         email, phone, manager_id, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.first_name, data.last_name, data.position || null, data.department || null,
        data.location || null, data.start_date || null, data.email || null, data.phone || null,
        data.manager_id || null, data.status || 'onboarding', data.notes || null, data.created_by || null,
      ]
    );
    const id = res.lastInsertId;
    if (data.employee_code) await setEmployeeCodeSafe(id, data.employee_code);
    if (buildOnboarding) await seedTasksForEmployee(id, 'onboarding');
    await reloadMirror();
    return id;
  },
  hasOffboarding(id) {
    return (run("SELECT COUNT(*) AS c FROM tasks WHERE employee_id = ? AND track = 'offboarding'", [id])[0]?.c ?? 0) > 0;
  },
  async startOffboarding(id, finalDay) {
    const already = this.hasOffboarding(id);
    await apiExec("UPDATE employees SET final_day = ?, updated_at = datetime('now') WHERE id = ?", [finalDay || null, id]);
    if (!already) await seedTasksForEmployee(id, 'offboarding');
    await reloadMirror();
  },
  async update(id, data) {
    await apiExec(
      `UPDATE employees SET first_name = ?, last_name = ?, position = ?, department = ?,
        location = ?, start_date = ?, email = ?, phone = ?, manager_id = ?, status = ?,
        notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        data.first_name, data.last_name, data.position || null, data.department || null,
        data.location || null, data.start_date || null, data.email || null, data.phone || null,
        data.manager_id || null, data.status || 'onboarding', data.notes || null, id,
      ]
    );
    if (data.employee_code !== undefined) await setEmployeeCodeSafe(id, data.employee_code);
    await reloadMirror();
  },
  async setStatus(id, status) {
    await apiExec("UPDATE employees SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
    await reloadMirror();
  },
  async remove(id) {
    await apiExec('DELETE FROM tasks WHERE employee_id = ?', [id]);
    await apiExec('DELETE FROM employees WHERE id = ?', [id]);
    await reloadMirror();
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
       ORDER BY (t.track = 'offboarding'), t.section_order, t.sort_order, t.id`,
      [employeeId]
    );
  },
  forAssignee(userId, { includeCompletedEmployees = false } = {}) {
    return run(
      `SELECT t.*, e.first_name, e.last_name, e.position, e.start_date, e.final_day,
              e.status AS employee_status
       FROM tasks t
       JOIN employees e ON e.id = t.employee_id
       WHERE t.assignee_id = ?
         AND ( ? = 1
               OR t.track = 'offboarding'
               OR (t.track = 'onboarding' AND e.status = 'onboarding') )
       ORDER BY (t.status != 'pending'), e.start_date IS NULL, e.start_date ASC,
                (t.track = 'offboarding'), t.section_order, t.sort_order`,
      [userId, includeCompletedEmployees ? 1 : 0]
    );
  },
  async setStatus(id, status, userId) {
    if (status === 'done') {
      await apiExec(
        `UPDATE tasks SET status = 'done', completed_at = datetime('now'),
          completed_by = ?, updated_at = datetime('now') WHERE id = ?`,
        [userId || null, id]
      );
    } else {
      await apiExec(
        `UPDATE tasks SET status = ?, completed_at = NULL, completed_by = NULL,
          updated_at = datetime('now') WHERE id = ?`,
        [status, id]
      );
    }
    await reloadMirror();
  },
  async setAssignee(id, assigneeId) {
    await apiExec("UPDATE tasks SET assignee_id = ?, updated_at = datetime('now') WHERE id = ?", [assigneeId || null, id]);
    await reloadMirror();
  },
  async setNotes(id, notes) {
    await apiExec("UPDATE tasks SET notes = ?, updated_at = datetime('now') WHERE id = ?", [notes || null, id]);
    await reloadMirror();
  },
  openCountForUser(userId) {
    return run(
      `SELECT COUNT(*) AS c FROM tasks t JOIN employees e ON e.id = t.employee_id
       WHERE t.assignee_id = ? AND t.status = 'pending'
         AND ( t.track = 'offboarding' OR e.status = 'onboarding' )`,
      [userId]
    )[0]?.c ?? 0;
  },
  // Overdue = pending onboarding tasks for someone whose start date has passed.
  overdue() {
    return run(
      `SELECT t.*, e.first_name, e.last_name, e.position, e.start_date,
              u.full_name AS assignee_name
       FROM tasks t
       JOIN employees e ON e.id = t.employee_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.status = 'pending' AND e.status = 'onboarding'
         AND e.start_date IS NOT NULL AND date(e.start_date) < date('now')
       ORDER BY e.start_date ASC, e.last_name`
    );
  },
  overdueCount() {
    return run(
      `SELECT COUNT(*) AS c FROM tasks t JOIN employees e ON e.id = t.employee_id
       WHERE t.status = 'pending' AND e.status = 'onboarding'
         AND e.start_date IS NOT NULL AND date(e.start_date) < date('now')`
    )[0]?.c ?? 0;
  },
  async remove(id) {
    await apiExec('DELETE FROM tasks WHERE id = ?', [id]);
    await reloadMirror();
  },
};

export const Template = {
  sections(type = 'onboarding') {
    return run('SELECT * FROM sections WHERE template_type = ? ORDER BY sort_order, id', [type]);
  },
  tasks(type = 'onboarding') {
    return run(
      `SELECT tt.*, u.full_name AS default_assignee_name
       FROM template_tasks tt
       JOIN sections s ON s.id = tt.section_id
       LEFT JOIN users u ON u.id = tt.default_assignee_id
       WHERE tt.active = 1 AND s.template_type = ?
       ORDER BY tt.sort_order, tt.id`,
      [type]
    );
  },
  async addSection({ name, description, done_by_employee, template_type = 'onboarding' }) {
    const max = run('SELECT MAX(sort_order) AS m FROM sections WHERE template_type = ?', [template_type])[0]?.m ?? -1;
    const res = await apiExec(
      'INSERT INTO sections (name, description, sort_order, done_by_employee, template_type) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, max + 1, done_by_employee ? 1 : 0, template_type]
    );
    await reloadMirror();
    return res.lastInsertId;
  },
  async updateSection(id, { name, description, done_by_employee }) {
    await apiExec('UPDATE sections SET name = ?, description = ?, done_by_employee = ? WHERE id = ?', [
      name, description || null, done_by_employee ? 1 : 0, id,
    ]);
    await reloadMirror();
  },
  async removeSection(id) {
    await apiExec('DELETE FROM template_tasks WHERE section_id = ?', [id]);
    await apiExec('DELETE FROM sections WHERE id = ?', [id]);
    await reloadMirror();
  },
  async addTask({ section_id, title, default_assignee_id }) {
    const max = run('SELECT MAX(sort_order) AS m FROM template_tasks WHERE section_id = ?', [section_id])[0]?.m ?? -1;
    const res = await apiExec(
      'INSERT INTO template_tasks (section_id, title, default_assignee_id, sort_order) VALUES (?, ?, ?, ?)',
      [section_id, title, default_assignee_id || null, max + 1]
    );
    await reloadMirror();
    return res.lastInsertId;
  },
  async updateTask(id, { title, default_assignee_id }) {
    await apiExec('UPDATE template_tasks SET title = ?, default_assignee_id = ? WHERE id = ?', [
      title, default_assignee_id || null, id,
    ]);
    await reloadMirror();
  },
  async removeTask(id) {
    await apiExec('DELETE FROM template_tasks WHERE id = ?', [id]);
    await reloadMirror();
  },
};

export const Audit = {
  // Fire-and-forget; audit rows aren't shown in the UI, so no mirror refresh.
  log({ user_id, username, action, entity, entity_id, details }) {
    apiQuery(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id || null, username || null, action, entity || null, entity_id || null, details || null]
    ).catch(() => { /* non-critical */ });
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
  async set(key, value) {
    const exists = run('SELECT key FROM settings WHERE key = ?', [key]).length > 0;
    if (exists) await apiExec('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
    else await apiExec('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    await reloadMirror();
  },
};

// --- Pre-built section "blocks" library -------------------------------------
// Admin-managed library of ready-made checklist sections. Stored as one JSON
// blob in the existing `settings` table (key 'section_library'), so it's shared
// across all computers and needs NO database schema change. Until an admin
// saves anything, we fall back to the built-in default seed (sectionLibrary.js).
const LIBRARY_KEY = 'section_library';

function readBlocks() {
  const raw = run('SELECT value FROM settings WHERE key = ?', [LIBRARY_KEY])[0]?.value;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch { /* corrupt value — fall back to the seed below */ }
  }
  return DEFAULT_BLOCKS;
}

export const BlockLibrary = {
  all() {
    return readBlocks();
  },
  async saveAll(blocks) {
    await Settings.set(LIBRARY_KEY, JSON.stringify(blocks));
  },
  async add(block) {
    const withId = { ...block, id: block.id || `blk_${Date.now()}` };
    await this.saveAll([...readBlocks(), withId]);
    return withId.id;
  },
  async update(id, patch) {
    await this.saveAll(readBlocks().map((b) => (b.id === id ? { ...b, ...patch, id } : b)));
  },
  async remove(id) {
    await this.saveAll(readBlocks().filter((b) => b.id !== id));
  },
};

// Export the current mirror as a .db file for backups.
export function exportDatabase() {
  if (!db) return null;
  return db.export();
}

// True if the server's data changed since we last loaded the mirror — i.e.
// someone on another computer added/edited/removed something. Drives the
// "Refresh" prompt so people see others' changes without logging out.
export async function hasExternalUpdate() {
  if (!lastSignature) return false;
  try {
    const res = await apiQuery(SIGNATURE_SQL);
    return dataSignature(res.rows[0]) !== lastSignature;
  } catch {
    return false;
  }
}
