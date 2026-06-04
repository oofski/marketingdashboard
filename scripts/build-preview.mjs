// Generates two single, self-contained HTML files at the repo root that can be
// opened by double-clicking (no server, no install):
//   preview.html        — the guest booking site
//   admin-preview.html  — the owner/admin portal
//
// Both inline the real CSS + JS and swap the server API for an in-browser mock
// backed by localStorage, so they stay faithful to the real site and share the
// same data (a booking made in one shows up in the other). Sample bookings are
// preloaded so the admin portal isn't empty on first open.
//
// Run with:  npm run build:preview
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS } from '../src/defaults.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const css = read('public/css/styles.css');
const signatureJs = read('public/js/signature.js').replace(/^export\s+/gm, '');
const calendarJs = read('public/js/calendar.js').replace(/^export\s+/gm, '');
const bookingJs = read('public/js/booking.js').replace(/^import[^\n]*\n/gm, '');
const adminJs = read('public/js/admin.js').replace(/^import[^\n]*\n/gm, '');

// In-browser mock backend shared by both previews + a fetch() shim that the
// inlined page code calls exactly like the real /api routes.
const mockBackend = `
// ---- Local preview mock backend (stands in for the real server) ----
var PREVIEW_KEY = 'lakehouse_preview_v1';
var DEFAULT_SETTINGS = ${JSON.stringify(DEFAULT_SETTINGS)};
var memFallback = null;
function previewLoad() { try { return JSON.parse(localStorage.getItem(PREVIEW_KEY)) || {}; } catch (e) { return memFallback || {}; } }
function previewSave(s) { try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(s)); } catch (e) { memFallback = s; } }
function previewStore() {
  var s = previewLoad();
  s.bookings = s.bookings || [];
  s.timeoff = s.timeoff || [];
  s.settings = s.settings || {};
  s.nextId = s.nextId || 1;
  s.nextOffId = s.nextOffId || 1;
  return s;
}
function pAddDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function effectiveSettings() { var s = previewStore(); return Object.assign({}, DEFAULT_SETTINGS, s.settings); }
function previewGetConfig() {
  var s = effectiveSettings();
  return { propertyName: s.property_name, basePrice: Number(s.base_price), gasFee: Number(s.gas_fee),
    maxNights: Number(s.max_nights), maxGuests: Number(s.max_guests), paymentLink: s.payment_link || '',
    contactEmail: s.contact_email || '', contactPhone: s.contact_phone || '', agreementText: s.agreement_text || '' };
}
function previewGetBlocked() {
  var s = previewStore(), set = {};
  s.bookings.forEach(function (b) { for (var i = 0; i < b.nights; i++) set[pAddDays(b.checkIn, i)] = 1; });
  s.timeoff.forEach(function (t) { var cur = t.startDate; for (var i = 0; i < 3660 && cur <= t.endDate; i++) { set[cur] = 1; cur = pAddDays(cur, 1); } });
  return { today: new Date().toISOString().slice(0, 10), blockedNights: Object.keys(set).sort() };
}
function previewCreateBooking(body) {
  var s = effectiveSettings(), store = previewStore(), blocked = {};
  previewGetBlocked().blockedNights.forEach(function (d) { blocked[d] = 1; });
  for (var i = 0; i < body.nights; i++) {
    if (blocked[pAddDays(body.checkIn, i)]) return { __status: 409, error: 'Sorry, those dates were just taken. Please pick another date.' };
  }
  var basePrice = Number(s.base_price), gasFee = body.boating ? Number(s.gas_fee) : 0, total = basePrice + gasFee;
  var id = store.nextId++;
  store.bookings.push({
    id: id, createdAt: new Date().toISOString(), checkIn: body.checkIn, checkOut: pAddDays(body.checkIn, body.nights),
    nights: body.nights, boating: !!body.boating, basePrice: basePrice, gasFee: gasFee, total: total,
    booker: body.booker, guests: body.guests || [], signedName: body.signedName, signatureData: body.signatureData,
    agreementText: s.agreement_text, status: 'confirmed'
  });
  previewSave(store);
  return { ok: true, bookingId: id, checkIn: body.checkIn, checkOut: pAddDays(body.checkIn, body.nights), nights: body.nights, totalPrice: total, paymentLink: s.payment_link || '' };
}
// --- admin-facing adapters (match the real server's JSON shapes) ---
function adminListBookings() {
  return previewStore().bookings.slice().sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : 1; }).map(function (b) {
    return { id: b.id, createdAt: b.createdAt, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights,
      bookerFirst: b.booker.firstName, bookerLast: b.booker.lastName, bookerEmail: b.booker.email, bookerPhone: b.booker.phone,
      boating: !!b.boating, totalPrice: b.total, status: b.status || 'confirmed', guestCount: 1 + (b.guests ? b.guests.length : 0) };
  });
}
function adminGetBooking(id) {
  var b = previewStore().bookings.filter(function (x) { return x.id === id; })[0];
  if (!b) return { error: 'Not found' };
  var guests = [{ id: 0, firstName: b.booker.firstName, lastName: b.booker.lastName, age: b.booker.age, isBooker: true, dlData: b.booker.dlData || null, voterData: b.booker.voterData || null }];
  (b.guests || []).forEach(function (g, i) { guests.push({ id: i + 1, firstName: g.firstName, lastName: g.lastName, age: g.age, isBooker: false, dlData: g.dlData || null, voterData: g.voterData || null }); });
  return { id: b.id, createdAt: b.createdAt, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights,
    bookerFirst: b.booker.firstName, bookerLast: b.booker.lastName, bookerEmail: b.booker.email, bookerPhone: b.booker.phone,
    boating: !!b.boating, basePrice: b.basePrice, gasFee: b.gasFee, totalPrice: b.total, agreementText: b.agreementText || '',
    signedName: b.signedName || '', signatureData: b.signatureData || '', signedAt: b.createdAt, status: b.status || 'confirmed', guests: guests };
}
function adminDeleteBooking(id) { var s = previewStore(); s.bookings = s.bookings.filter(function (b) { return b.id !== id; }); previewSave(s); }
function adminListTimeoff() { return previewStore().timeoff.map(function (t) { return { id: t.id, startDate: t.startDate, endDate: t.endDate, reason: t.reason || '', createdAt: t.createdAt }; }); }
function adminAddTimeoff(body) {
  if (!body.startDate || !body.endDate) return { __status: 400, error: 'Valid start and end dates are required.' };
  if (body.endDate < body.startDate) return { __status: 400, error: 'End date must be on or after the start date.' };
  var s = previewStore(); s.timeoff.push({ id: s.nextOffId++, startDate: body.startDate, endDate: body.endDate, reason: body.reason || '', createdAt: new Date().toISOString() }); previewSave(s); return { ok: true };
}
function adminDeleteTimeoff(id) { var s = previewStore(); s.timeoff = s.timeoff.filter(function (t) { return String(t.id) !== String(id); }); previewSave(s); }
function adminUpdateSettings(body) {
  var s = previewStore(), allowed = ['property_name','base_price','gas_fee','max_nights','max_guests','payment_link','contact_email','contact_phone','agreement_text'];
  allowed.forEach(function (k) { if (k in body) s.settings[k] = String(body[k]); }); previewSave(s);
}
// A simple drawn "signature" so the admin signature panel shows something.
var PREVIEW_SIG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="260" height="90"><path d="M12 64 C 40 14, 64 80, 92 44 S 150 8, 176 54 T 248 42" fill="none" stroke="#1f2a30" stroke-width="2.5" stroke-linecap="round"/></svg>');
function previewSeedIfEmpty() {
  var s = previewStore();
  if (s.seeded) return;
  s.seeded = true;
  var base = new Date(); function plus(n) { var x = new Date(base); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  var ag = effectiveSettings().agreement_text;
  s.bookings.push({ id: s.nextId++, createdAt: new Date().toISOString(), checkIn: plus(14), checkOut: plus(16), nights: 2, boating: true,
    basePrice: 300, gasFee: 150, total: 450, booker: { firstName: 'Jordan', lastName: 'Rivera', email: 'jordan@example.com', phone: '(555) 123-4567', age: 36, dlData: null, voterData: null },
    guests: [{ firstName: 'Alex', lastName: 'Rivera', age: 34, dlData: null, voterData: null }, { firstName: 'Sky', lastName: 'Rivera', age: 9, dlData: null, voterData: null }],
    signedName: 'Jordan Rivera', signatureData: PREVIEW_SIG, agreementText: ag, status: 'confirmed' });
  s.bookings.push({ id: s.nextId++, createdAt: new Date().toISOString(), checkIn: plus(25), checkOut: plus(26), nights: 1, boating: false,
    basePrice: 300, gasFee: 0, total: 300, booker: { firstName: 'Sam', lastName: 'Lee', email: 'sam.lee@example.com', phone: '(555) 987-6543', age: 29, dlData: null, voterData: null },
    guests: [], signedName: 'Sam Lee', signatureData: PREVIEW_SIG, agreementText: ag, status: 'confirmed' });
  s.timeoff.push({ id: s.nextOffId++, startDate: plus(40), endDate: plus(43), reason: 'Owner use' });
  previewSave(s);
}
window.__resetPreview = function () { try { localStorage.removeItem(PREVIEW_KEY); } catch (e) {} memFallback = null; location.reload(); };
previewSeedIfEmpty();

// fetch() shim — the inlined page code calls these exact routes.
function fetch(url, opts) {
  url = String(url); opts = opts || {};
  var method = (opts.method || 'GET').toUpperCase();
  function resp(data, status, okFlag) { if (status == null) status = 200; if (okFlag == null) okFlag = status < 400; return Promise.resolve({ ok: okFlag, status: status, json: function () { return Promise.resolve(data); } }); }
  // public booking routes
  if (url.indexOf('/api/config') >= 0) return resp(previewGetConfig());
  if (url.indexOf('/api/blocked') >= 0) return resp(previewGetBlocked());
  if (url.indexOf('/api/bookings') >= 0 && url.indexOf('/api/admin') < 0 && method === 'POST') { var r = previewCreateBooking(JSON.parse(opts.body)); if (r.__status) return resp({ error: r.error }, r.__status, false); return resp(r); }
  // admin routes
  if (url.indexOf('/api/admin/login') >= 0 && method === 'POST') return resp({ token: 'preview-token' });
  var BK = '/api/admin/bookings/';
  if (url.indexOf(BK) >= 0) { var bid = parseInt(url.slice(url.indexOf(BK) + BK.length), 10); if (method === 'DELETE') { adminDeleteBooking(bid); return resp({ ok: true }); } return resp(adminGetBooking(bid)); }
  if (url.indexOf('/api/admin/bookings') >= 0) return resp({ bookings: adminListBookings() });
  var OFF = '/api/admin/timeoff/';
  if (url.indexOf(OFF) >= 0 && method === 'DELETE') { adminDeleteTimeoff(url.slice(url.indexOf(OFF) + OFF.length)); return resp({ ok: true }); }
  if (url.indexOf('/api/admin/timeoff') >= 0 && method === 'POST') { var ra = adminAddTimeoff(JSON.parse(opts.body)); if (ra.__status) return resp({ error: ra.error }, ra.__status, false); return resp({ ok: true }); }
  if (url.indexOf('/api/admin/timeoff') >= 0) return resp({ timeOff: adminListTimeoff() });
  if (url.indexOf('/api/admin/settings') >= 0 && method === 'PUT') { adminUpdateSettings(JSON.parse(opts.body)); return resp({ ok: true, settings: effectiveSettings() }); }
  if (url.indexOf('/api/admin/settings') >= 0) return resp(effectiveSettings());
  return resp({ error: 'Not available in this local preview.' }, 404, false);
}
`;

function banner(text, linkHref, linkLabel) {
  return `<div style="background:#fff3cd;color:#664d03;padding:9px 14px;text-align:center;font-size:0.85rem;border-bottom:1px solid #ffe69c">
  ${text}
  &nbsp;<a href="${linkHref}" style="color:#664d03;font-weight:700">${linkLabel}</a>
  &nbsp;<button onclick="window.__resetPreview && window.__resetPreview()" style="margin-left:6px;cursor:pointer;border:1px solid #997404;background:#fff;border-radius:6px;padding:2px 10px">Reset demo</button>
</div>`;
}

function buildPage({ htmlFile, jsParts, title, bannerHtml }) {
  const combinedJs = `(function () {\n${jsParts.join('\n')}\n})();`;
  let html = read(htmlFile);
  html = html.replace('<link rel="stylesheet" href="/css/styles.css" />', `<style>\n${css}\n</style>`);
  html = html.replace(/<script type="module" src="\/js\/\w+\.js"><\/script>/, `<script>\n${combinedJs}\n</script>`);
  html = html.replace('<body>', `<body>\n${bannerHtml}`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  return html;
}

// Booking site preview
const bookingHtml = buildPage({
  htmlFile: 'public/index.html',
  jsParts: [signatureJs, calendarJs, mockBackend, bookingJs],
  title: 'Booking Site — Local Preview',
  bannerHtml: banner('Local preview of the <strong>booking site</strong> — includes sample data; bookings save only in this browser.', 'admin-preview.html', 'Open admin preview →'),
}).replace('<a href="/admin">Owner / admin login</a>', '<a href="admin-preview.html">Owner / admin preview</a>');
writeFileSync(path.join(root, 'preview.html'), bookingHtml);

// Admin portal preview (calendar.js included for its fmtLong helper)
const adminHtml = buildPage({
  htmlFile: 'public/admin.html',
  jsParts: [calendarJs, mockBackend, adminJs],
  title: 'Admin Portal — Local Preview',
  bannerHtml: banner('Local preview of the <strong>admin portal</strong> — any password logs you in; data is this browser only.', 'preview.html', '← Open booking site'),
});
writeFileSync(path.join(root, 'admin-preview.html'), adminHtml);

console.log('Wrote preview.html (' + Math.round(bookingHtml.length / 1024) + ' KB) and admin-preview.html (' + Math.round(adminHtml.length / 1024) + ' KB).');
console.log('Open either by double-clicking. (Keep them in the same folder so the links between them work.)');
