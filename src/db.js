import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

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

// Default agreement. Fully editable from the admin portal. This is a general
// template — have it reviewed by a lawyer before relying on it.
const DEFAULT_AGREEMENT = `SHORT-TERM STAY & EQUIPMENT USE AGREEMENT

This Agreement is entered into between the Property Owner ("Owner") and the
person submitting this booking ("Guest").

1. BOOKING. The Guest is reserving the property for the dates and number of
   nights selected at booking. Maximum stay is 3 nights / 4 days. Maximum
   occupancy is 7 people total, including the person who booked. All guests
   must be listed at the time of booking with their full name and age.

2. PAYMENT. The base price for the stay is shown at checkout. If the Guest
   selects boating and/or the use of any gas-powered equipment, an additional
   gas charge applies. Final gas charges may be adjusted to actual usage.
   Payment is due as instructed after booking.

3. CONDUCT & CARE. The Guest agrees to treat the property and all equipment
   with care, to follow all posted rules, and to leave the property in the
   condition in which it was found. The Guest is responsible for the conduct
   of every person in their party.

4. BOATING & EQUIPMENT. Use of boats, watercraft, and any gas-powered or
   motorized equipment is entirely at the Guest's own risk. The Guest affirms
   that anyone operating such equipment is competent and legally permitted to
   do so, and will use all required safety equipment (including life jackets).

5. ASSUMPTION OF RISK & LIABILITY. The Guest understands that use of the
   property, the water, and the equipment involves inherent risks, including
   serious injury. To the fullest extent permitted by law, the Guest assumes
   these risks and releases the Owner from liability for injury, loss, or
   damage, except where caused by the Owner's gross negligence or willful
   misconduct.

6. DAMAGE. The Guest agrees to be responsible for any loss or damage to the
   property or equipment caused during the stay, beyond normal wear and tear.

7. IDENTIFICATION. The Guest agrees that identification provided (such as a
   driver's license or voter ID) is true and accurate.

8. CANCELLATION. Cancellations and changes are subject to the Owner's
   approval.

By signing below, the Guest confirms they have read, understood, and agree to
all of the terms above, and that they are at least 18 years of age and
authorized to make this booking on behalf of their entire party.`;

const DEFAULT_SETTINGS = {
  property_name: 'The Lake House',
  base_price: '300',
  gas_fee: '150',
  max_nights: '3',
  max_guests: '7',
  payment_link: '',
  contact_email: '',
  contact_phone: '',
  agreement_text: DEFAULT_AGREEMENT,
};

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
