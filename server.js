import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, initDb, getSettings, updateSettings } from './src/db.js';
import { issueToken, checkPassword, requireAdmin } from './src/auth.js';
import {
  getBlockedNights,
  stayIsAvailable,
  nightsForStay,
  isValidDateStr,
  datesInclusive,
  addDays,
  todayStr,
} from './src/availability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Render (and most hosts) sit behind a proxy; trust it so req.ip is correct.
app.set('trust proxy', 1);

// Booking payloads include base64 ID photos and a signature image.
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------- helpers -----------------------------

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // ~5MB per uploaded file

function publicSettings(s) {
  return {
    propertyName: s.property_name,
    basePrice: Number(s.base_price),
    gasFee: Number(s.gas_fee),
    maxNights: Number(s.max_nights),
    maxGuests: Number(s.max_guests),
    paymentLink: s.payment_link || '',
    contactEmail: s.contact_email || '',
    contactPhone: s.contact_phone || '',
    agreementText: s.agreement_text || '',
  };
}

// Validates a "data:<mime>;base64,<data>" string. Returns { ok, mime, reason }.
function validateDataUrl(value, { required = false } = {}) {
  if (value == null || value === '') {
    return required ? { ok: false, reason: 'missing' } : { ok: true, empty: true };
  }
  if (typeof value !== 'string') return { ok: false, reason: 'not a string' };
  const m = /^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m) return { ok: false, reason: 'not a valid data URL' };
  const mime = m[1].toLowerCase();
  const approxBytes = Math.floor((m[2].length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) return { ok: false, reason: 'file too large (max 5MB)' };
  return { ok: true, mime, bytes: approxBytes };
}

function cleanStr(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// --------------------------- public API ---------------------------

app.get('/api/config', async (req, res) => {
  try {
    const s = await getSettings();
    res.json(publicSettings(s));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Dates that are already taken, so the calendar can grey them out.
app.get('/api/blocked', async (req, res) => {
  try {
    const blocked = await getBlockedNights();
    res.json({ today: todayStr(), blockedNights: [...blocked].sort() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load availability' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const s = await getSettings();
    const maxNights = Number(s.max_nights) || 3;
    const maxGuests = Number(s.max_guests) || 7;
    const basePrice = Number(s.base_price) || 0;
    const gasFee = Number(s.gas_fee) || 0;

    const body = req.body || {};
    const errors = [];

    // --- dates / nights ---
    const checkIn = cleanStr(body.checkIn, 10);
    const nights = Number(body.nights);
    if (!isValidDateStr(checkIn)) errors.push('A valid check-in date is required.');
    if (!Number.isInteger(nights) || nights < 1 || nights > maxNights) {
      errors.push(`Nights must be between 1 and ${maxNights}.`);
    }
    if (isValidDateStr(checkIn) && checkIn < todayStr()) {
      errors.push('Check-in date cannot be in the past.');
    }

    // --- booker ---
    const booker = body.booker || {};
    const bFirst = cleanStr(booker.firstName, 60);
    const bLast = cleanStr(booker.lastName, 60);
    const bEmail = cleanStr(booker.email, 120);
    const bPhone = cleanStr(booker.phone, 40);
    const bAge = Number(booker.age);
    if (!bFirst) errors.push('Your first name is required.');
    if (!bLast) errors.push('Your last name is required.');
    if (!isValidEmail(bEmail)) errors.push('A valid email is required.');
    if (!bPhone) errors.push('A phone number is required.');
    if (!Number.isInteger(bAge) || bAge < 0 || bAge > 120) errors.push('A valid age is required for the person booking.');

    // --- additional guests ---
    const extraGuests = Array.isArray(body.guests) ? body.guests : [];
    const totalGuests = 1 + extraGuests.length;
    if (totalGuests > maxGuests) {
      errors.push(`Maximum ${maxGuests} guests total (including you).`);
    }
    const guestRows = [];
    // booker is guest #1
    guestRows.push({
      first: bFirst, last: bLast, age: bAge, isBooker: 1,
      dl: booker.dlData, voter: booker.voterData,
    });
    extraGuests.forEach((g, i) => {
      const f = cleanStr(g.firstName, 60);
      const l = cleanStr(g.lastName, 60);
      const a = Number(g.age);
      if (!f || !l) errors.push(`Guest ${i + 2}: first and last name are required.`);
      if (!Number.isInteger(a) || a < 0 || a > 120) errors.push(`Guest ${i + 2}: a valid age is required.`);
      guestRows.push({ first: f, last: l, age: a, isBooker: 0, dl: g.dlData, voter: g.voterData });
    });

    // --- validate any uploaded ID images ---
    for (let i = 0; i < guestRows.length; i++) {
      const who = i === 0 ? 'Your' : `Guest ${i + 1}'s`;
      const dl = validateDataUrl(guestRows[i].dl);
      if (!dl.ok) errors.push(`${who} driver's license upload is invalid: ${dl.reason}.`);
      const voter = validateDataUrl(guestRows[i].voter);
      if (!voter.ok) errors.push(`${who} voter ID upload is invalid: ${voter.reason}.`);
    }

    // --- agreement + signature ---
    const agreed = body.agreedToTerms === true;
    const signedName = cleanStr(body.signedName, 120);
    const signature = typeof body.signatureData === 'string' ? body.signatureData : '';
    if (!agreed) errors.push('You must agree to the terms of the agreement.');
    if (!signedName) errors.push('Please type your full legal name to sign.');
    const sig = validateDataUrl(signature, { required: true });
    if (!sig.ok || !sig.mime || !sig.mime.startsWith('image/')) {
      errors.push('A signature is required.');
    }

    const boating = body.boating === true;

    if (errors.length) return res.status(400).json({ error: errors.join(' '), errors });

    // --- availability re-check + atomic insert ---
    const checkOut = addDays(checkIn, nights);
    const totalPrice = basePrice + (boating ? gasFee : 0);
    const now = new Date().toISOString();

    const tx = await db.transaction('write');
    try {
      // Re-read blocked nights inside the transaction to prevent double-booking.
      const conflict = await tx.execute(
        "SELECT check_in, nights FROM bookings WHERE status = 'confirmed'"
      );
      const taken = new Set();
      for (const b of conflict.rows) {
        for (const d of nightsForStay(b.check_in, Number(b.nights))) taken.add(d);
      }
      const offs = await tx.execute('SELECT start_date, end_date FROM time_off');
      for (const o of offs.rows) {
        for (const d of datesInclusive(o.start_date, o.end_date)) taken.add(d);
      }
      if (!stayIsAvailable(checkIn, nights, taken)) {
        await tx.rollback();
        return res.status(409).json({ error: 'Sorry, those dates were just taken. Please pick another date.' });
      }

      const ins = await tx.execute({
        sql: `INSERT INTO bookings
          (created_at, check_in, check_out, nights, booker_first, booker_last,
           booker_email, booker_phone, boating, base_price, gas_fee, total_price,
           agreement_text, signed_name, signature_data, signed_at, status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'confirmed')`,
        args: [
          now, checkIn, checkOut, nights, bFirst, bLast, bEmail, bPhone,
          boating ? 1 : 0, basePrice, boating ? gasFee : 0, totalPrice,
          s.agreement_text || '', signedName, signature, now,
        ],
      });
      const bookingId = Number(ins.lastInsertRowid);

      for (const g of guestRows) {
        const dlMime = g.dl ? (validateDataUrl(g.dl).mime || null) : null;
        const voterMime = g.voter ? (validateDataUrl(g.voter).mime || null) : null;
        await tx.execute({
          sql: `INSERT INTO guests
            (booking_id, first_name, last_name, age, is_booker, dl_data, dl_mime, voter_data, voter_mime)
            VALUES (?,?,?,?,?,?,?,?,?)`,
          args: [
            bookingId, g.first, g.last, g.age, g.isBooker,
            g.dl || null, dlMime, g.voter || null, voterMime,
          ],
        });
      }

      await tx.commit();

      res.json({
        ok: true,
        bookingId,
        checkIn,
        checkOut,
        nights,
        totalPrice,
        paymentLink: s.payment_link || '',
      });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating your booking. Please try again.' });
  }
});

// --------------------------- admin API ---------------------------

const loginAttempts = new Map(); // ip -> { count, first }

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - rec.first > 15 * 60 * 1000) { rec.count = 0; rec.first = now; }
  if (rec.count >= 10) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  if (checkPassword(req.body?.password)) {
    loginAttempts.delete(ip);
    return res.json({ token: issueToken() });
  }
  rec.count += 1;
  loginAttempts.set(ip, rec);
  res.status(401).json({ error: 'Incorrect password.' });
});

app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT id, created_at, check_in, check_out, nights, booker_first, booker_last,
              booker_email, booker_phone, boating, total_price, status
       FROM bookings ORDER BY check_in ASC`
    );
    const counts = await db.execute('SELECT booking_id, COUNT(*) AS n FROM guests GROUP BY booking_id');
    const countMap = new Map(counts.rows.map((r) => [Number(r.booking_id), Number(r.n)]));
    const bookings = result.rows.map((b) => ({
      id: Number(b.id),
      createdAt: b.created_at,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: Number(b.nights),
      bookerFirst: b.booker_first,
      bookerLast: b.booker_last,
      bookerEmail: b.booker_email,
      bookerPhone: b.booker_phone,
      boating: !!b.boating,
      totalPrice: Number(b.total_price),
      status: b.status,
      guestCount: countMap.get(Number(b.id)) || 0,
    }));
    res.json({ bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

app.get('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const bRes = await db.execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [id] });
    if (!bRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const b = bRes.rows[0];
    const gRes = await db.execute({
      sql: 'SELECT * FROM guests WHERE booking_id = ? ORDER BY is_booker DESC, id ASC',
      args: [id],
    });
    res.json({
      id: Number(b.id),
      createdAt: b.created_at,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: Number(b.nights),
      bookerFirst: b.booker_first,
      bookerLast: b.booker_last,
      bookerEmail: b.booker_email,
      bookerPhone: b.booker_phone,
      boating: !!b.boating,
      basePrice: Number(b.base_price),
      gasFee: Number(b.gas_fee),
      totalPrice: Number(b.total_price),
      agreementText: b.agreement_text,
      signedName: b.signed_name,
      signatureData: b.signature_data,
      signedAt: b.signed_at,
      status: b.status,
      guests: gRes.rows.map((g) => ({
        id: Number(g.id),
        firstName: g.first_name,
        lastName: g.last_name,
        age: Number(g.age),
        isBooker: !!g.is_booker,
        dlData: g.dl_data || null,
        voterData: g.voter_data || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load booking' });
  }
});

app.delete('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.execute({ sql: 'DELETE FROM guests WHERE booking_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM bookings WHERE id = ?', args: [id] });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

app.get('/api/admin/timeoff', requireAdmin, async (req, res) => {
  try {
    const r = await db.execute('SELECT * FROM time_off ORDER BY start_date ASC');
    res.json({
      timeOff: r.rows.map((t) => ({
        id: Number(t.id),
        startDate: t.start_date,
        endDate: t.end_date,
        reason: t.reason || '',
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load time off' });
  }
});

app.post('/api/admin/timeoff', requireAdmin, async (req, res) => {
  try {
    const start = cleanStr(req.body?.startDate, 10);
    const end = cleanStr(req.body?.endDate, 10);
    const reason = cleanStr(req.body?.reason, 200);
    if (!isValidDateStr(start) || !isValidDateStr(end)) {
      return res.status(400).json({ error: 'Valid start and end dates are required.' });
    }
    if (end < start) return res.status(400).json({ error: 'End date must be on or after the start date.' });
    await db.execute({
      sql: 'INSERT INTO time_off (start_date, end_date, reason, created_at) VALUES (?,?,?,?)',
      args: [start, end, reason, new Date().toISOString()],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add time off' });
  }
});

app.delete('/api/admin/timeoff/:id', requireAdmin, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM time_off WHERE id = ?', args: [Number(req.params.id)] });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete time off' });
  }
});

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const s = await getSettings();
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const allowed = ['property_name', 'base_price', 'gas_fee', 'max_nights',
      'max_guests', 'payment_link', 'contact_email', 'contact_phone', 'agreement_text'];
    const updates = {};
    for (const key of allowed) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }
    // Guard numeric fields.
    for (const numKey of ['base_price', 'gas_fee', 'max_nights', 'max_guests']) {
      if (numKey in updates) {
        const n = Number(updates[numKey]);
        if (Number.isNaN(n) || n < 0) return res.status(400).json({ error: `${numKey} must be a number.` });
      }
    }
    await updateSettings(updates);
    res.json({ ok: true, settings: await getSettings() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ----------------------------- pages -----------------------------

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// JSON error handler (e.g. when uploaded photos exceed the size limit).
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Your uploads are too large. Please use smaller photos (under 5MB each).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error. Please try again.' });
});

// ----------------------------- boot -----------------------------

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Booking site running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
