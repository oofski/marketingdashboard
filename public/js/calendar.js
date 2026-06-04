// Availability calendar. Shows which check-in dates have enough consecutive
// free nights for the chosen stay length, and lets the user pick one.

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d) { return d.toISOString().slice(0, 10); }
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
export function fmtLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function createCalendar(container, { onSelect }) {
  let blocked = new Set();
  let today = ymd(new Date());
  let nights = 1;
  let selected = null;
  let viewYear, viewMonth;

  function initView() {
    const t = new Date(today + 'T00:00:00Z');
    viewYear = t.getUTCFullYear();
    viewMonth = t.getUTCMonth();
  }

  function stayNights(checkIn, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(addDays(checkIn, i));
    return out;
  }

  function isAvailable(dateStr) {
    if (dateStr < today) return false;
    for (const d of stayNights(dateStr, nights)) {
      if (blocked.has(d)) return false;
    }
    return true;
  }

  function render() {
    if (viewYear == null) initView();
    const first = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startDow = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const thisMonthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const todayMonthStr = today.slice(0, 7);
    const canGoBack = thisMonthStr > todayMonthStr;

    const rangeSet = selected ? new Set(stayNights(selected, nights)) : new Set();
    const checkoutDate = selected ? addDays(selected, nights) : null;

    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div class="cal-day empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const avail = isAvailable(ds);
      const classes = ['cal-day'];
      if (avail) classes.push('available'); else classes.push('unavailable');
      if (selected) {
        if (ds === selected) classes.push('start');
        else if (rangeSet.has(ds)) classes.push('in-range');
        if (ds === checkoutDate) classes.push('checkout');
      }
      cells += `<div class="${classes.join(' ')}" data-date="${ds}" ${avail ? 'role="button" tabindex="0"' : ''}>${day}</div>`;
    }

    container.innerHTML = `
      <div class="cal">
        <div class="cal-head">
          <div class="title">${MONTHS[viewMonth]} ${viewYear}</div>
          <div class="cal-nav">
            <button type="button" class="btn secondary sm" data-nav="prev" ${canGoBack ? '' : 'disabled'}>&larr;</button>
            <button type="button" class="btn secondary sm" data-nav="next">&rarr;</button>
          </div>
        </div>
        <div class="cal-grid">
          ${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
          ${cells}
        </div>
        <div class="cal-legend">
          <span class="key"><span class="swatch" style="background:var(--surface-2);border:1px solid var(--line)"></span> Available</span>
          <span class="key"><span class="swatch" style="background:var(--primary)"></span> Your check-in</span>
          <span class="key"><span class="swatch" style="background:var(--primary-soft)"></span> Nights booked</span>
          <span class="key"><span class="swatch" style="box-shadow:inset 0 0 0 2px var(--accent)"></span> Check-out day</span>
        </div>
      </div>`;

    container.querySelector('[data-nav="prev"]').onclick = () => {
      if (!canGoBack) return;
      viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
    };
    container.querySelector('[data-nav="next"]').onclick = () => {
      viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      render();
    };
    container.querySelectorAll('.cal-day.available').forEach((el) => {
      const pick = () => { selected = el.dataset.date; render(); onSelect && onSelect(selected); };
      el.onclick = pick;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    });
  }

  return {
    setBlocked(set, todayStr) { blocked = set; if (todayStr) { today = todayStr; initView(); } return this; },
    setNights(n) {
      nights = n;
      // If the current selection no longer fits, clear it.
      if (selected && !isAvailable(selected)) { selected = null; onSelect && onSelect(null); }
      return this;
    },
    getSelected() { return selected; },
    clearSelection() { selected = null; },
    render,
  };
}
