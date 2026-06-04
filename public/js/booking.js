import { createCalendar, addDays, fmtLong } from './calendar.js';
import { createSignaturePad } from './signature.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;
const STEP_LABELS = ['Nights', 'Dates', 'Your info', 'Guests', 'Agreement'];

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

let config = null;
let calendar = null;
let sigPad = null;
let currentStep = 0;

const state = {
  nights: null,
  checkIn: null,
  boating: false,
  booker: { firstName: '', lastName: '', email: '', phone: '', age: '', dlData: null, voterData: null },
  guests: [], // additional guests beyond the booker
  agreedToTerms: false,
  signedName: '',
};

// ----------------------------- boot -----------------------------
init();

async function init() {
  showSpinner(true);
  try {
    config = await fetch('/api/config').then((r) => r.json());
  } catch {
    document.querySelector('main').innerHTML = '<div class="notice error">Could not load the booking site. Please refresh.</div>';
    showSpinner(false);
    return;
  }

  $('property-name').textContent = config.propertyName;
  document.title = `Book Your Stay · ${config.propertyName}`;
  $('price-banner').innerHTML =
    `<span class="chip">From ${money(config.basePrice)} per stay</span>` +
    `<span class="chip">+ ${money(config.gasFee)} gas (boating / gas equipment)</span>`;
  $('gas-hint').textContent = `A ${money(config.gasFee)} gas charge will be added (final amount may be adjusted).`;
  $('agreement-text').textContent = config.agreementText;

  buildSteps();
  buildNightsOptions();
  buildCalendar();
  wireDetails();
  wireGuests();
  wireAgreement();

  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => goToStep(currentStep - 1)));
  showSpinner(false);
}

// ----------------------------- steps -----------------------------
function buildSteps() {
  $('steps').innerHTML = STEP_LABELS.map((label, i) =>
    `<div class="step" data-i="${i}"><span class="n">${i + 1}</span>${label}</div>`).join('');
}

function updateStepsIndicator() {
  document.querySelectorAll('#steps .step').forEach((el) => {
    const i = Number(el.dataset.i);
    el.classList.toggle('active', i === currentStep);
    el.classList.toggle('done', i < currentStep);
  });
}

function goToStep(i) {
  if (i < 0 || i > 4) return;
  currentStep = i;
  document.querySelectorAll('.step-section').forEach((s) => s.classList.add('hidden'));
  $('confirmation').classList.add('hidden');
  document.querySelector(`.step-section[data-step="${i}"]`).classList.remove('hidden');
  updateStepsIndicator();

  if (i === 1) { calendar.setNights(state.nights).render(); refreshDatesNext(); }
  if (i === 3) renderGuests();
  if (i === 4) enterAgreement();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------------------- step 1: nights -----------------------------
function buildNightsOptions() {
  const max = config.maxNights || 3;
  const grid = $('nights-grid');
  let html = '';
  for (let n = 1; n <= max; n++) {
    html += `<div class="night-opt" data-n="${n}">
      <div class="big">${n}</div>
      <div class="small">${n === 1 ? 'night' : 'nights'} · ${n + 1} days</div>
    </div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.night-opt').forEach((el) => {
    el.onclick = () => {
      state.nights = Number(el.dataset.n);
      grid.querySelectorAll('.night-opt').forEach((x) => x.classList.toggle('selected', x === el));
      $('nights-next').disabled = false;
    };
  });
  $('nights-next').onclick = () => goToStep(1);
}

// ----------------------------- step 2: dates -----------------------------
function buildCalendar() {
  calendar = createCalendar($('calendar'), { onSelect: onDatePicked });
  $('dates-next').onclick = () => goToStep(2);
  loadAvailability();
}

async function loadAvailability() {
  try {
    const data = await fetch('/api/blocked').then((r) => r.json());
    calendar.setBlocked(new Set(data.blockedNights), data.today);
  } catch { /* calendar still renders, just without blocks */ }
}

function onDatePicked(date) {
  state.checkIn = date;
  refreshDatesNext();
}

function refreshDatesNext() {
  const summary = $('selection-summary');
  if (state.checkIn) {
    const out = addDays(state.checkIn, state.nights);
    summary.classList.remove('hidden');
    summary.innerHTML = `Check-in <strong>${fmtLong(state.checkIn)}</strong><br>` +
      `Check-out <strong>${fmtLong(out)}</strong> · ${state.nights} ${state.nights === 1 ? 'night' : 'nights'}`;
    $('dates-next').disabled = false;
  } else {
    summary.classList.add('hidden');
    $('dates-next').disabled = true;
  }
}

// ----------------------------- step 3: your info -----------------------------
function wireDetails() {
  const map = { 'b-first': 'firstName', 'b-last': 'lastName', 'b-email': 'email', 'b-phone': 'phone', 'b-age': 'age' };
  for (const [id, key] of Object.entries(map)) {
    $(id).value = state.booker[key];
    $(id).oninput = (e) => { state.booker[key] = e.target.value; };
  }
  $('boating').onchange = (e) => { state.boating = e.target.checked; };
  $('details-next').onclick = () => {
    const errs = [];
    if (!state.booker.firstName.trim()) errs.push('first name');
    if (!state.booker.lastName.trim()) errs.push('last name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.booker.email.trim())) errs.push('a valid email');
    if (!state.booker.phone.trim()) errs.push('phone number');
    const age = Number(state.booker.age);
    if (!Number.isInteger(age) || age < 0 || age > 120) errs.push('a valid age');
    const box = $('details-error');
    if (errs.length) {
      box.textContent = `Please enter ${errs.join(', ')}.`;
      box.classList.remove('hidden');
      return;
    }
    box.classList.add('hidden');
    goToStep(3);
  };
}

// ----------------------------- step 4: guests & IDs -----------------------------
function wireGuests() {
  $('add-guest').onclick = () => {
    const total = 1 + state.guests.length;
    if (total >= config.maxGuests) return;
    state.guests.push({ firstName: '', lastName: '', age: '', dlData: null, voterData: null });
    renderGuests();
  };
  $('guests-next').onclick = () => {
    const errs = [];
    state.guests.forEach((g, i) => {
      if (!g.firstName.trim() || !g.lastName.trim()) errs.push(`Guest ${i + 2} needs a first and last name`);
      const a = Number(g.age);
      if (!Number.isInteger(a) || a < 0 || a > 120) errs.push(`Guest ${i + 2} needs a valid age`);
    });
    const box = $('guests-error');
    if (errs.length) {
      box.innerHTML = errs.join('.<br>') + '.';
      box.classList.remove('hidden');
      return;
    }
    box.classList.add('hidden');
    goToStep(4);
  };
}

function uploadBox(label, who, kind, current) {
  const id = `up-${kind}-${who}`;
  const status = current ? `<div class="file-name">&#10003; Uploaded</div>` : '';
  return `<div class="upload-box">
    <label class="field" style="margin-top:0"><span>${label}</span>
      <input type="file" id="${id}" accept="image/*,application/pdf" /></label>
    <div id="${id}-name">${status}</div>
  </div>`;
}

function renderGuests() {
  const remaining = config.maxGuests - (1 + state.guests.length);
  $('guests-sub').innerHTML =
    `Up to <strong>${config.maxGuests}</strong> guests total, including you. ` +
    `Driver's license / voter ID uploads are optional. ${remaining > 0 ? `You can add ${remaining} more.` : 'You\'ve reached the maximum.'}`;

  const list = $('guest-list');
  let html = `<div class="guest-card">
      <div class="guest-head"><h4>You — ${escapeHtml(state.booker.firstName)} ${escapeHtml(state.booker.lastName)} (guest&nbsp;1)</h4></div>
      <div class="muted" style="font-size:0.85rem">Age ${escapeHtml(String(state.booker.age))}</div>
      <div class="uploads">
        ${uploadBox("Driver's license (optional)", 'booker', 'dl', state.booker.dlData)}
        ${uploadBox('Voter ID (optional)', 'booker', 'voter', state.booker.voterData)}
      </div>
    </div>`;

  state.guests.forEach((g, i) => {
    html += `<div class="guest-card">
      <div class="guest-head"><h4>Guest ${i + 2}</h4>
        <button type="button" class="btn ghost sm" data-remove="${i}" style="color:var(--danger)">Remove</button></div>
      <div class="row">
        <label class="field"><span>First name *</span><input type="text" data-g="${i}" data-k="firstName" value="${escapeHtml(g.firstName)}" /></label>
        <label class="field"><span>Last name *</span><input type="text" data-g="${i}" data-k="lastName" value="${escapeHtml(g.lastName)}" /></label>
        <label class="field" style="max-width:110px"><span>Age *</span><input type="number" min="0" max="120" data-g="${i}" data-k="age" value="${escapeHtml(String(g.age))}" /></label>
      </div>
      <div class="uploads">
        ${uploadBox("Driver's license (optional)", `g${i}`, 'dl', g.dlData)}
        ${uploadBox('Voter ID (optional)', `g${i}`, 'voter', g.voterData)}
      </div>
    </div>`;
  });
  list.innerHTML = html;

  $('add-guest').disabled = remaining <= 0;

  list.querySelectorAll('input[type=text], input[type=number]').forEach((inp) => {
    inp.oninput = (e) => {
      const i = Number(e.target.dataset.g);
      state.guests[i][e.target.dataset.k] = e.target.value;
    };
  });
  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => { state.guests.splice(Number(btn.dataset.remove), 1); renderGuests(); };
  });

  // wire file inputs
  bindUpload('up-dl-booker', (d) => (state.booker.dlData = d));
  bindUpload('up-voter-booker', (d) => (state.booker.voterData = d));
  state.guests.forEach((g, i) => {
    bindUpload(`up-dl-g${i}`, (d) => (state.guests[i].dlData = d));
    bindUpload(`up-voter-g${i}`, (d) => (state.guests[i].voterData = d));
  });
}

function bindUpload(id, setter) {
  const input = $(id);
  if (!input) return;
  input.onchange = async (e) => {
    const file = e.target.files[0];
    const nameEl = $(`${id}-name`);
    if (!file) { setter(null); nameEl.innerHTML = ''; return; }
    if (!ALLOWED.includes(file.type)) {
      nameEl.innerHTML = '<div class="file-name" style="color:var(--danger)">Unsupported file type</div>';
      input.value = ''; setter(null); return;
    }
    if (file.size > MAX_BYTES) {
      nameEl.innerHTML = '<div class="file-name" style="color:var(--danger)">File too large (max 5MB)</div>';
      input.value = ''; setter(null); return;
    }
    const dataUrl = await fileToDataUrl(file);
    setter(dataUrl);
    nameEl.innerHTML = `<div class="file-name">&#10003; ${escapeHtml(file.name)}</div>`;
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ----------------------------- step 5: agreement -----------------------------
function wireAgreement() {
  $('clear-sig').onclick = () => sigPad && sigPad.clear();
  $('agree').onchange = (e) => { state.agreedToTerms = e.target.checked; };
  $('signed-name').oninput = (e) => { state.signedName = e.target.value; };
  $('submit-booking').onclick = submitBooking;
}

function priceBreakdownHtml() {
  const gas = state.boating ? config.gasFee : 0;
  const total = config.basePrice + gas;
  return `
    <div class="price-line"><span>Stay (${state.nights} ${state.nights === 1 ? 'night' : 'nights'})</span><span>${money(config.basePrice)}</span></div>
    ${state.boating ? `<div class="price-line"><span>Gas (boating / equipment)</span><span>${money(gas)}</span></div>` : ''}
    <div class="price-line total"><span>Total</span><span>${money(total)}</span></div>
    ${state.boating ? '<div class="hint">Final gas amount may be adjusted to actual usage.</div>' : ''}`;
}

function enterAgreement() {
  const total = 1 + state.guests.length;
  $('review-line').innerHTML =
    `${state.nights} ${state.nights === 1 ? 'night' : 'nights'} · ` +
    `${fmtLong(state.checkIn)} &rarr; ${fmtLong(addDays(state.checkIn, state.nights))} · ` +
    `${total} ${total === 1 ? 'guest' : 'guests'}`;
  $('price-box').innerHTML = priceBreakdownHtml();
  // reflect current state into controls
  $('agree').checked = state.agreedToTerms;
  $('signed-name').value = state.signedName;
  if (!sigPad) sigPad = createSignaturePad($('signature'));
  else sigPad.clear();
}

async function submitBooking() {
  const errs = [];
  if (!state.agreedToTerms) errs.push('agree to the terms');
  if (!state.signedName.trim()) errs.push('type your full name');
  if (!sigPad || sigPad.isEmpty()) errs.push('draw your signature');
  const box = $('agreement-error');
  if (errs.length) {
    box.textContent = `Please ${errs.join(', ')}.`;
    box.classList.remove('hidden');
    return;
  }
  box.classList.add('hidden');

  const payload = {
    checkIn: state.checkIn,
    nights: state.nights,
    boating: state.boating,
    booker: {
      firstName: state.booker.firstName.trim(),
      lastName: state.booker.lastName.trim(),
      email: state.booker.email.trim(),
      phone: state.booker.phone.trim(),
      age: Number(state.booker.age),
      dlData: state.booker.dlData,
      voterData: state.booker.voterData,
    },
    guests: state.guests.map((g) => ({
      firstName: g.firstName.trim(),
      lastName: g.lastName.trim(),
      age: Number(g.age),
      dlData: g.dlData,
      voterData: g.voterData,
    })),
    agreedToTerms: true,
    signedName: state.signedName.trim(),
    signatureData: sigPad.toDataURL(),
  };

  showSpinner(true);
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      box.textContent = data.error || 'Something went wrong. Please try again.';
      box.classList.remove('hidden');
      showSpinner(false);
      return;
    }
    showConfirmation(data);
  } catch {
    box.textContent = 'Network error. Please try again.';
    box.classList.remove('hidden');
  }
  showSpinner(false);
}

function showConfirmation(data) {
  document.querySelectorAll('.step-section').forEach((s) => s.classList.add('hidden'));
  document.querySelectorAll('#steps .step').forEach((el) => el.classList.add('done'));
  const c = $('confirmation');
  c.classList.remove('hidden');

  $('confirm-summary').innerHTML =
    `${config.propertyName} · Booking reference <strong>#${data.bookingId}</strong><br>` +
    `${fmtLong(data.checkIn)} &rarr; ${fmtLong(data.checkOut)} · ${data.nights} ${data.nights === 1 ? 'night' : 'nights'}`;
  $('confirm-price').innerHTML = priceBreakdownHtml();

  const pay = $('confirm-payment');
  if (data.paymentLink) {
    pay.innerHTML = `<div class="center"><a class="btn" href="${escapeAttr(data.paymentLink)}" target="_blank" rel="noopener">Pay now (${money(data.totalPrice)})</a>
      <div class="hint" style="margin-top:8px">You'll be taken to a secure payment page.</div></div>`;
  } else {
    pay.innerHTML = `<div class="notice info center">Your booking is recorded. We'll contact you with payment instructions for the ${money(data.totalPrice)} total.</div>`;
  }

  const bits = [];
  if (config.contactEmail) bits.push(`Email: <a href="mailto:${escapeAttr(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a>`);
  if (config.contactPhone) bits.push(`Phone: <a href="tel:${escapeAttr(config.contactPhone)}">${escapeHtml(config.contactPhone)}</a>`);
  $('confirm-contact').innerHTML = bits.length ? `Questions? ${bits.join(' &nbsp;·&nbsp; ')}` : '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------------------- utils -----------------------------
function showSpinner(on) { $('spinner').classList.toggle('hidden', !on); }
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
