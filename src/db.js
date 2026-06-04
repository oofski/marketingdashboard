import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS } from './defaults.js';

// Local dev uses a SQLite file. Production points at a free Turso database
// via DATABASE_URL / DATABASE_AUTH_TOKEN so bookings persist across restarts.
const url = process.env.DATABASE_URL || 'file:./data/booking.db';
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

// For a local file database, make sure the containing folder exists.
if (url.startsWith('file:') && !url.includes(':memory:')) {
  const filePath = url.slice('file:'.length);
  const dir = path.dirname(filePath);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
}

export const db = createClient({ url, authToken });

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      nights INTEGER NOT NULL,
      booker_first TEXT NOT NULL,
      booker_last TEXT NOT NULL,
      booker_email TEXT NOT NULL,
      booker_phone TEXT NOT NULL,
      boating INTEGER NOT NULL DEFAULT 0,
      base_price REAL NOT NULL,
      gas_fee REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL,
      agreement_text TEXT NOT NULL,
      signed_name TEXT NOT NULL,
      signature_data TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      admin_notes TEXT DEFAULT ''
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      is_booker INTEGER NOT NULL DEFAULT 0,
      dl_data TEXT,
      dl_mime TEXT,
      voter_data TEXT,
      voter_mime TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS time_off (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);

  // Seed any missing default settings without overwriting edited ones.
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      args: [key, value],
    });
  }
}

export async function getSettings() {
  const res = await db.execute('SELECT key, value FROM settings');
  const out = {};
  for (const row of res.rows) out[row.key] = row.value;
  return out;
}

export async function updateSettings(updates) {
  for (const [key, value] of Object.entries(updates)) {
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [key, String(value)],
    });
  }
}
