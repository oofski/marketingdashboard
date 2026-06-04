import { fmtLong } from './calendar.js';

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;
const TOKEN_KEY = 'booking_admin_token';

let token = localStorage.getItem(TOKEN_KEY) || null;

// ----------------------------- auth -----------------------------
function showSpinner(on) { $('spinner').classList.toggle('hidden', !on); }

async function authFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  return res;
}

function showLogin() { $('login-view').classList.remove('hidden'); $('dash-view').classList.add('hidden'); }
function showDash() { $('login-view').classList.add('hidden'); $('dash-view').classList.remove('hidden'); }

async function login() {
  const password = $('admin-password').value;
  const errBox = $('login-error');
  showSpinner(true);
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errBox.textContent = data.error || 'Login failed.';
      errBox.classList.remove('hidden');
      showSpinner(false);
      return;
    }
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    errBox.classList.add('hidden');
    $('admin-password').value = '';
    showDash();
    await loadBookings();
  } catch {
    errBox.textContent = 'Network error.';
    errBox.classList.remove('hidden');
  }
  showSpinner(false);
}

function logout() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
}

// ----------------------------- tabs -----------------------------
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
  $(`tab-${name}`).classList.remove('hidden');
  if (name === 'bookings') loadBookings();
  if (name === 'timeoff') loadTimeOff();
  if (name === 'settings') loadSettings();
}

// ----------------------------- bookings -----------------------------
async function loadBookings() {
  showSpinner(true);
  try {
    const { bookings } = await (await authFetch('/api/admin/bookings')).json();
    const tbody = $('bookings-table').querySelector('tbody');
    $('bookings-empty').classList.toggle('hidden', bookings.length > 0);
    tbody.innerHTML = bookings.map((b) => `
      <tr class="clickable" data-id="${b.id}">
        <td>#${b.id}</td>
        <td>${b.checkIn}</td>
        <td>${b.checkOut}</td>
        <td>${b.nights}</td>
        <td>${escapeHtml(b.bookerFirst)} ${escapeHtml(b.bookerLast)}</td>
        <td>${b.guestCount}</td>
        <td>${b.boating ? '<span class="tag boat">Gas</span>' : '—'}</td>
        <td>${money(b.totalPrice)}</td>
      </tr>`).join('');
    tbody.querySelectorAll('tr.clickable').forEach((tr) => {
      tr.onclick = () => openBooking(Number(tr.dataset.id));
    });
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

async function openBooking(id) {
  showSpinner(true);
  try {
    const b = await (await authFetch(`/api/admin/bookings/${id}`)).json();
    $('modal-title').textContent = `Booking #${b.id}`;

    const mailSubject = encodeURIComponent(`Your booking at the property (#${b.id})`);
    const mailBody = encodeURIComponent(
      `Hi ${b.bookerFirst},\n\nRegarding your booking #${b.id} (${b.checkIn} to ${b.checkOut}):\n\n`);
    const reach = `
      <div class="row" style="margin:6px 0 18px">
        <a class="btn sm" href="mailto:${escapeAttr(b.bookerEmail)}?subject=${mailSubject}&body=${mailBody}">Email ${escapeHtml(b.bookerFirst)}</a>
        <a class="btn sm secondary" href="tel:${escapeAttr(b.bookerPhone)}">Call ${escapeHtml(b.bookerPhone)}</a>
      </div>`;

    const guestsHtml = b.guests.map((g) => `
      <div class="guest-card">
        <div class="guest-head"><h4>${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)} ${g.isBooker ? '(booker)' : ''}</h4>
          <span class="muted">Age ${g.age}</span></div>
        <div class="uploads">
          <div class="upload-box"><span class="muted" style="font-size:0.8rem">Driver's license</span>
            ${idImg(g.dlData)}</div>
          <div class="upload-box"><span class="muted" style="font-size:0.8rem">Voter ID</span>
            ${idImg(g.voterData)}</div>
        </div>
      </div>`).join('');

    $('modal-body').innerHTML = `
      <div class="detail-grid">
        <div><div class="k">Guest</div><div class="v">${escapeHtml(b.bookerFirst)} ${escapeHtml(b.bookerLast)}</div></div>
        <div><div class="k">Booked on</div><div class="v">${new Date(b.createdAt).toLocaleString()}</div></div>
        <div><div class="k">Check-in</div><div class="v">${fmtLong(b.checkIn)}</div></div>
        <div><div class="k">Check-out</div><div class="v">${fmtLong(b.checkOut)}</div></div>
        <div><div class="k">Nights</div><div class="v">${b.nights}</div></div>
        <div><div class="k">Boating / gas</div><div class="v">${b.boating ? 'Yes (+' + money(b.gasFee) + ')' : 'No'}</div></div>
        <div><div class="k">Email</div><div class="v">${escapeHtml(b.bookerEmail)}</div></div>
        <div><div class="k">Phone</div><div class="v">${escapeHtml(b.bookerPhone)}</div></div>
        <div><div class="k">Total price</div><div class="v">${money(b.totalPrice)}</div></div>
        <div><div class="k">Party size</div><div class="v">${b.guests.length}</div></div>
      </div>
      <h3 style="margin:18px 0 4px">Reach out</h3>${reach}
      <h3 style="margin:18px 0 4px">Guests & IDs</h3>
      ${guestsHtml}
      <h3 style="margin:18px 0 4px">Signed agreement</h3>
      <div class="muted" style="font-size:0.85rem">Signed by <strong>${escapeHtml(b.signedName)}</strong> on ${new Date(b.signedAt).toLocaleString()}</div>
      <img class="id-img" style="max-width:340px;background:#fff" src="${escapeAttr(b.signatureData)}" alt="signature" />
      <details style="margin-top:12px"><summary class="muted" style="cursor:pointer">View agreement text</summary>
        <div class="agreement-text" style="margin-top:8px">${escapeHtml(b.agreementText)}</div></details>
      <div class="btn-row">
        <button class="btn danger" id="delete-booking" data-id="${b.id}">Delete booking</button>
        <button class="btn secondary" id="modal-close-2">Close</button>
      </div>`;

    $('modal').classList.remove('hidden');
    $('modal-close-2').onclick = closeModal;
    $('delete-booking').onclick = () => deleteBooking(b.id);
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

function idImg(data) {
  if (!data) return '<div class="muted" style="font-size:0.82rem">Not provided</div>';
  if (data.startsWith('data:application/pdf')) {
    return `<a class="btn sm secondary" style="margin-top:6px" href="${escapeAttr(data)}" target="_blank" rel="noopener">Open PDF</a>`;
  }
  return `<a href="${escapeAttr(data)}" target="_blank" rel="noopener"><img class="id-img" src="${escapeAttr(data)}" alt="ID" /></a>`;
}

async function deleteBooking(id) {
  if (!confirm('Delete this booking permanently? This frees the dates for others.')) return;
  showSpinner(true);
  try {
    await authFetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
    closeModal();
    await loadBookings();
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

function closeModal() { $('modal').classList.add('hidden'); $('modal-body').innerHTML = ''; }

// ----------------------------- time off -----------------------------
async function loadTimeOff() {
  showSpinner(true);
  try {
    const { timeOff } = await (await authFetch('/api/admin/timeoff')).json();
    $('timeoff-list').innerHTML = timeOff.length
      ? timeOff.map((t) => `
        <div class="guest-card" style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${t.startDate}</strong> → <strong>${t.endDate}</strong>
            ${t.reason ? `<div class="muted" style="font-size:0.85rem">${escapeHtml(t.reason)}</div>` : ''}</div>
          <button class="btn danger sm" data-off="${t.id}">Remove</button>
        </div>`).join('')
      : '<p class="muted">No time-off blocks yet.</p>';
    $('timeoff-list').querySelectorAll('[data-off]').forEach((btn) => {
      btn.onclick = () => deleteTimeOff(Number(btn.dataset.off));
    });
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

async function addTimeOff() {
  const startDate = $('off-start').value;
  const endDate = $('off-end').value;
  const reason = $('off-reason').value;
  const err = $('off-error');
  if (!startDate || !endDate) {
    err.textContent = 'Please choose a start and end date.';
    err.classList.remove('hidden');
    return;
  }
  showSpinner(true);
  try {
    const res = await authFetch('/api/admin/timeoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, reason }),
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error; err.classList.remove('hidden'); showSpinner(false); return; }
    err.classList.add('hidden');
    $('off-start').value = ''; $('off-end').value = ''; $('off-reason').value = '';
    await loadTimeOff();
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

async function deleteTimeOff(id) {
  showSpinner(true);
  try {
    await authFetch(`/api/admin/timeoff/${id}`, { method: 'DELETE' });
    await loadTimeOff();
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

// ----------------------------- settings -----------------------------
const SETTING_KEYS = ['property_name', 'base_price', 'gas_fee', 'max_nights', 'max_guests',
  'payment_link', 'contact_email', 'contact_phone', 'agreement_text'];

async function loadSettings() {
  showSpinner(true);
  try {
    const s = await (await authFetch('/api/admin/settings')).json();
    for (const k of SETTING_KEYS) { const el = $(`set-${k}`); if (el) el.value = s[k] ?? ''; }
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

async function saveSettings() {
  const body = {};
  for (const k of SETTING_KEYS) { const el = $(`set-${k}`); if (el) body[k] = el.value; }
  showSpinner(true);
  try {
    const res = await authFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const saved = $('settings-saved');
      saved.classList.remove('hidden');
      setTimeout(() => saved.classList.add('hidden'), 2500);
    }
  } catch (e) { if (e.message !== 'unauthorized') console.error(e); }
  showSpinner(false);
}

// ----------------------------- utils + wire -----------------------------
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

$('login-btn').onclick = login;
$('admin-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
$('logout-btn').onclick = logout;
$('modal-close').onclick = closeModal;
$('off-add').onclick = addTimeOff;
$('settings-save').onclick = saveSettings;
document.querySelectorAll('.tab-btn').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

// auto-resume session if token present
if (token) {
  showDash();
  loadBookings();
} else {
  showLogin();
}
