import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

async function loadSqlJs() {
  const mod = await import('sql.js/dist/sql-wasm.js');
  return mod.default || mod;
}

let SQL = null;
let db = null;
let saveTimeout = null;

const STORAGE_KEY = 'dental_clinic_db_v1';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'doctor',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  insurance_provider TEXT,
  insurance_id TEXT,
  medical_history TEXT,
  allergies TEXT,
  current_medications TEXT,
  language TEXT DEFAULT 'en',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  visit_date TEXT DEFAULT (datetime('now')),
  doctor_id INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'open',
  next_appointment TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tooth_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL,
  tooth_number INTEGER NOT NULL,
  condition TEXT,
  surfaces TEXT,
  note TEXT,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clinical_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL,
  category TEXT,
  tooth_number INTEGER,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  visit_id INTEGER,
  doc_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  signed INTEGER DEFAULT 0,
  signed_at TEXT,
  language TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL
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
  clinic_name: 'Sunrise Dental Clinic',
  clinic_address: '123 Main Street, Anytown, State 12345',
  clinic_phone: '(555) 123-4567',
  clinic_email: 'contact@sunrisedental.example',
  clinic_license: 'LIC-12345',
  numbering_system: 'universal',
  default_language: 'en',
  theme: 'light',
};

// Simple synchronous SHA-256 via SubtleCrypto returns a promise; we keep
// password hashing small and tucked away here for the basic auth use case.
export async function hashPassword(plain) {
  const enc = new TextEncoder().encode(plain + '::dental_salt_v1');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function loadPersisted() {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const data = await window.electronAPI.readDb();
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
  }, 250);
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
  seedDefaults();
  if (!existing) {
    const data = db.export();
    await writePersisted(data);
  }
  return db;
}

function seedDefaults() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = run('SELECT value FROM settings WHERE key = ?', [key]);
    if (existing.length === 0) {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }
  const userCount = run('SELECT COUNT(*) as c FROM users')[0]?.c ?? 0;
  if (userCount === 0) {
    // Seed default admin: username=admin, password=admin123
    hashPassword('admin123').then((hash) => {
      run(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        ['admin', hash, 'Administrator', 'admin']
      );
      scheduleSave();
    });
  }
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

export function exec(sql, params = []) {
  return run(sql, params);
}

export function lastInsertId() {
  const res = run('SELECT last_insert_rowid() as id');
  return res[0]?.id ?? null;
}

// Convenience domain helpers ------------------------------------------------

export const Patients = {
  list({ search = '', limit = 200 } = {}) {
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      return run(
        `SELECT * FROM patients
         WHERE LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?
            OR LOWER(phone) LIKE ? OR LOWER(email) LIKE ?
            OR CAST(id AS TEXT) = ?
         ORDER BY updated_at DESC LIMIT ?`,
        [term, term, term, term, search, limit]
      );
    }
    return run('SELECT * FROM patients ORDER BY updated_at DESC LIMIT ?', [limit]);
  },
  get(id) {
    return run('SELECT * FROM patients WHERE id = ?', [id])[0] ?? null;
  },
  create(data) {
    run(
      `INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, email,
        address, emergency_contact, emergency_phone, insurance_provider, insurance_id,
        medical_history, allergies, current_medications, language, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.first_name, data.last_name, data.date_of_birth || null, data.gender || null,
        data.phone || null, data.email || null, data.address || null,
        data.emergency_contact || null, data.emergency_phone || null,
        data.insurance_provider || null, data.insurance_id || null,
        data.medical_history || null, data.allergies || null,
        data.current_medications || null, data.language || 'en', data.notes || null,
      ]
    );
    return lastInsertId();
  },
  update(id, data) {
    run(
      `UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, gender=?, phone=?,
        email=?, address=?, emergency_contact=?, emergency_phone=?, insurance_provider=?,
        insurance_id=?, medical_history=?, allergies=?, current_medications=?, language=?,
        notes=?, updated_at=datetime('now') WHERE id=?`,
      [
        data.first_name, data.last_name, data.date_of_birth || null, data.gender || null,
        data.phone || null, data.email || null, data.address || null,
        data.emergency_contact || null, data.emergency_phone || null,
        data.insurance_provider || null, data.insurance_id || null,
        data.medical_history || null, data.allergies || null,
        data.current_medications || null, data.language || 'en', data.notes || null, id,
      ]
    );
  },
  remove(id) {
    run('DELETE FROM patients WHERE id = ?', [id]);
  },
};

export const Visits = {
  listForPatient(patientId) {
    return run(
      `SELECT v.*, u.full_name AS doctor_name
       FROM visits v LEFT JOIN users u ON u.id = v.doctor_id
       WHERE v.patient_id = ? ORDER BY v.visit_date DESC`,
      [patientId]
    );
  },
  todayQueue() {
    return run(
      `SELECT v.*, p.first_name, p.last_name, p.allergies, p.medical_history
       FROM visits v JOIN patients p ON p.id = v.patient_id
       WHERE date(v.visit_date) = date('now')
       ORDER BY v.visit_date DESC`
    );
  },
  get(id) {
    return run('SELECT * FROM visits WHERE id = ?', [id])[0] ?? null;
  },
  create(patientId, doctorId, reason = '') {
    run(
      'INSERT INTO visits (patient_id, doctor_id, reason) VALUES (?, ?, ?)',
      [patientId, doctorId || null, reason]
    );
    return lastInsertId();
  },
  update(id, data) {
    run(
      `UPDATE visits SET reason=?, status=?, next_appointment=? WHERE id=?`,
      [data.reason || null, data.status || 'open', data.next_appointment || null, id]
    );
  },
  remove(id) {
    run('DELETE FROM visits WHERE id = ?', [id]);
  },
};

export const ToothFindings = {
  forVisit(visitId) {
    return run(
      'SELECT * FROM tooth_findings WHERE visit_id = ? ORDER BY tooth_number',
      [visitId]
    );
  },
  upsert(visitId, toothNumber, data) {
    const existing = run(
      'SELECT id FROM tooth_findings WHERE visit_id = ? AND tooth_number = ?',
      [visitId, toothNumber]
    );
    if (existing.length) {
      run(
        `UPDATE tooth_findings SET condition=?, surfaces=?, note=?, color=? WHERE id=?`,
        [data.condition || null, data.surfaces || null, data.note || null, data.color || null, existing[0].id]
      );
      return existing[0].id;
    }
    run(
      `INSERT INTO tooth_findings (visit_id, tooth_number, condition, surfaces, note, color)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [visitId, toothNumber, data.condition || null, data.surfaces || null, data.note || null, data.color || null]
    );
    return lastInsertId();
  },
  remove(visitId, toothNumber) {
    run('DELETE FROM tooth_findings WHERE visit_id = ? AND tooth_number = ?', [visitId, toothNumber]);
  },
};

export const Notes = {
  forVisit(visitId) {
    return run(
      'SELECT * FROM clinical_notes WHERE visit_id = ? ORDER BY created_at DESC',
      [visitId]
    );
  },
  create(visitId, data) {
    run(
      `INSERT INTO clinical_notes (visit_id, category, tooth_number, content)
       VALUES (?, ?, ?, ?)`,
      [visitId, data.category || 'general', data.tooth_number || null, data.content]
    );
    return lastInsertId();
  },
  remove(id) {
    run('DELETE FROM clinical_notes WHERE id = ?', [id]);
  },
};

export const Documents = {
  forPatient(patientId) {
    return run(
      'SELECT * FROM documents WHERE patient_id = ? ORDER BY created_at DESC',
      [patientId]
    );
  },
  recent(limit = 50) {
    return run(
      `SELECT d.*, p.first_name, p.last_name
       FROM documents d JOIN patients p ON p.id = d.patient_id
       ORDER BY d.created_at DESC LIMIT ?`,
      [limit]
    );
  },
  create(data) {
    run(
      `INSERT INTO documents (patient_id, visit_id, doc_type, filename, signed, signed_at, language, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.patient_id, data.visit_id || null, data.doc_type, data.filename,
        data.signed ? 1 : 0, data.signed_at || null, data.language || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
    return lastInsertId();
  },
  remove(id) {
    run('DELETE FROM documents WHERE id = ?', [id]);
  },
};

export const Users = {
  list() {
    return run('SELECT id, username, full_name, role, created_at FROM users ORDER BY username');
  },
  findByUsername(username) {
    return run('SELECT * FROM users WHERE username = ?', [username])[0] ?? null;
  },
  async create({ username, password, full_name, role = 'doctor' }) {
    const hash = await hashPassword(password);
    run(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hash, full_name, role]
    );
    return lastInsertId();
  },
  remove(id) {
    run('DELETE FROM users WHERE id = ?', [id]);
  },
  async updatePassword(id, password) {
    const hash = await hashPassword(password);
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
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
    const rows = run('SELECT value FROM settings WHERE key = ?', [key]);
    return rows[0]?.value ?? null;
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
