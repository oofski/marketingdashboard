import { db } from './db.js';

// All date math is done on plain YYYY-MM-DD strings in UTC to avoid
// timezone off-by-one issues. A booking occupies one "night" per date from
// check-in up to (but not including) check-out.

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The set of night-dates a stay occupies: check_in, check_in+1, ... (count nights)
export function nightsForStay(checkIn, nights) {
  const out = [];
  for (let i = 0; i < nights; i++) out.push(addDays(checkIn, i));
  return out;
}

// Inclusive range of dates (used for admin time-off blocks).
export function datesInclusive(start, end) {
  const out = [];
  let cur = start;
  // guard against reversed ranges / runaway loops
  for (let i = 0; i < 3660 && cur <= end; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

// Returns a Set of all night-dates that are unavailable because of an
// existing confirmed booking or an admin time-off block.
export async function getBlockedNights() {
  const blocked = new Set();

  const bookings = await db.execute(
    "SELECT check_in, nights FROM bookings WHERE status = 'confirmed'"
  );
  for (const b of bookings.rows) {
    for (const d of nightsForStay(b.check_in, Number(b.nights))) blocked.add(d);
  }

  const offs = await db.execute('SELECT start_date, end_date FROM time_off');
  for (const o of offs.rows) {
    for (const d of datesInclusive(o.start_date, o.end_date)) blocked.add(d);
  }

  return blocked;
}

// Is a proposed stay free? (does not touch the database)
export function stayIsAvailable(checkIn, nights, blockedSet, today = todayStr()) {
  if (checkIn < today) return false;
  for (const d of nightsForStay(checkIn, nights)) {
    if (blockedSet.has(d)) return false;
  }
  return true;
}
