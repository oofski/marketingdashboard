// Generates a single, self-contained `preview.html` at the repo root that can
// be opened by double-clicking (no server, no install). It inlines the real
// CSS + booking JavaScript and swaps the server API for an in-browser mock
// backed by localStorage, so the preview stays faithful to the real site.
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

// Server defaults → the camelCase shape the booking UI expects.
const previewConfig = {
  propertyName: DEFAULT_SETTINGS.property_name,
  basePrice: Number(DEFAULT_SETTINGS.base_price),
  gasFee: Number(DEFAULT_SETTINGS.gas_fee),
  maxNights: Number(DEFAULT_SETTINGS.max_nights),
  maxGuests: Number(DEFAULT_SETTINGS.max_guests),
  paymentLink: DEFAULT_SETTINGS.payment_link,
  contactEmail: DEFAULT_SETTINGS.contact_email,
  contactPhone: DEFAULT_SETTINGS.contact_phone,
  agreementText: DEFAULT_SETTINGS.agreement_text,
};

// In-browser mock backend + a fetch() shim the inlined booking code calls.
const mockBackend = `
// ---- Local preview mock backend (stands in for the real server) ----
var PREVIEW_KEY = 'lakehouse_preview_v1';
var PREVIEW_DEFAULTS = ${JSON.stringify(previewConfig)};
var memFallback = null;
function previewLoad() {
  try { return JSON.parse(localStorage.getItem(PREVIEW_KEY)) || {}; }
  catch (e) { return memFallback || {}; }
}
function previewSave(s) {
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(s)); }
  catch (e) { memFallback = s; }
}
function previewStore() {
  var s = previewLoad();
  s.bookings = s.bookings || [];
  s.timeoff = s.timeoff || [];
  s.settings = s.settings || {};
  s.nextId = s.nextId || 1;
  return s;
}
function pAddDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function previewGetConfig() { var s = previewStore(); return Object.assign({}, PREVIEW_DEFAULTS, s.settings); }
function previewGetBlocked() {
  var s = previewStore(), set = {};
  s.bookings.forEach(function (b) { for (var i = 0; i < b.nights; i++) set[pAddDays(b.checkIn, i)] = 1; });
  s.timeoff.forEach(function (t) { var cur = t.startDate; for (var i = 0; i < 3660 && cur <= t.endDate; i++) { set[cur] = 1; cur = pAddDays(cur, 1); } });
  return { today: new Date().toISOString().slice(0, 10), blockedNights: Object.keys(set).sort() };
}
function previewCreateBooking(body) {
  var cfg = previewGetConfig(), s = previewStore(), blocked = {};
  previewGetBlocked().blockedNights.forEach(function (d) { blocked[d] = 1; });
  for (var i = 0; i < body.nights; i++) {
    if (blocked[pAddDays(body.checkIn, i)]) return { __status: 409, error: 'Sorry, those dates were just taken. Please pick another date.' };
  }
  var total = cfg.basePrice + (body.boating ? cfg.gasFee : 0);
  var id = s.nextId++;
  s.bookings.push({
    id: id, createdAt: new Date().toISOString(), checkIn: body.checkIn,
    checkOut: pAddDays(body.checkIn, body.nights), nights: body.nights, boating: !!body.boating,
    total: total, booker: body.booker, guests: body.guests || [], signedName: body.signedName
  });
  previewSave(s);
  return { ok: true, bookingId: id, checkIn: body.checkIn, checkOut: pAddDays(body.checkIn, body.nights), nights: body.nights, totalPrice: total, paymentLink: cfg.paymentLink || '' };
}
window.__resetPreview = function () { try { localStorage.removeItem(PREVIEW_KEY); } catch (e) {} memFallback = null; location.reload(); };

// fetch() shim — the inlined booking code calls these same routes.
function fetch(url, opts) {
  url = String(url); opts = opts || {};
  function resp(data, status, okFlag) {
    if (status == null) status = 200;
    if (okFlag == null) okFlag = status < 400;
    return Promise.resolve({ ok: okFlag, status: status, json: function () { return Promise.resolve(data); } });
  }
  if (url.indexOf('/api/config') >= 0) return resp(previewGetConfig());
  if (url.indexOf('/api/blocked') >= 0) return resp(previewGetBlocked());
  if (url.indexOf('/api/bookings') >= 0 && opts.method === 'POST') {
    var r = previewCreateBooking(JSON.parse(opts.body));
    if (r.__status) return resp({ error: r.error }, r.__status, false);
    return resp(r, 200, true);
  }
  return resp({ error: 'Not available in this local preview.' }, 404, false);
}
`;

// Everything in one classic <script>, wrapped so the fetch() shim is local.
const combinedJs = `(function () {\n${signatureJs}\n${calendarJs}\n${mockBackend}\n${bookingJs}\n})();`;

const banner = `<div style="background:#fff3cd;color:#664d03;padding:9px 14px;text-align:center;font-size:0.85rem;border-bottom:1px solid #ffe69c">
  Local preview &mdash; this is a working demo of the booking site. Bookings are saved only in this browser.
  <button onclick="window.__resetPreview && window.__resetPreview()" style="margin-left:8px;cursor:pointer;border:1px solid #997404;background:#fff;border-radius:6px;padding:2px 10px">Reset demo</button>
</div>`;

let html = read('public/index.html');
html = html.replace('<link rel="stylesheet" href="/css/styles.css" />', `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="/js/booking.js"></script>', `<script>\n${combinedJs}\n</script>`);
html = html.replace('<body>', `<body>\n${banner}`);
html = html.replace('<a href="/admin">Owner / admin login</a>',
  '<span class="muted">(The admin portal is part of the live/local-server version.)</span>');
html = html.replace('<title>Book Your Stay</title>', '<title>Booking Site — Local Preview</title>');

writeFileSync(path.join(root, 'preview.html'), html);
console.log('Wrote preview.html (' + Math.round(html.length / 1024) + ' KB) — open it by double-clicking.');
