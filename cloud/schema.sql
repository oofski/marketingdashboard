-- EBG Onboarding Tracker — D1 (SQLite) schema.
-- Run this once against your D1 database to create the tables. It matches the
-- desktop app's schema exactly, so existing data migrates in cleanly.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  email TEXT,
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
  employee_code TEXT,
  manager_id INTEGER,
  status TEXT DEFAULT 'onboarding',
  final_day TEXT,
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
  done_by_employee INTEGER DEFAULT 0,
  template_type TEXT DEFAULT 'onboarding'
);

CREATE TABLE IF NOT EXISTS template_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  default_assignee_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  template_task_id INTEGER,
  section_name TEXT,
  section_order INTEGER DEFAULT 0,
  done_by_employee INTEGER DEFAULT 0,
  track TEXT DEFAULT 'onboarding',
  title TEXT NOT NULL,
  assignee_id INTEGER,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  completed_at TEXT,
  completed_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
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
