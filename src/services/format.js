// Small presentation helpers shared across the UI.

export function formatDate(value) {
  if (!value) return '—';
  // Accept ISO (YYYY-MM-DD) and common date strings.
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value);
  if (isNaN(d)) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function daysUntil(value) {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value);
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

export function startDateLabel(value) {
  const n = daysUntil(value);
  if (n === null) return formatDate(value);
  if (n === 0) return 'Starts today';
  if (n === 1) return 'Starts tomorrow';
  if (n > 1) return `Starts in ${n} days`;
  if (n === -1) return 'Started yesterday';
  return `Started ${Math.abs(n)} days ago`;
}

export const EMPLOYEE_STATUS = {
  onboarding: { label: 'Onboarding', badge: 'badge-accent' },
  on_hold: { label: 'On hold', badge: 'badge-warning' },
  completed: { label: 'Completed', badge: 'badge-success' },
  cancelled: { label: 'Cancelled', badge: 'badge' },
};

export function employeeStatusMeta(status) {
  return EMPLOYEE_STATUS[status] || EMPLOYEE_STATUS.onboarding;
}

export const TASK_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'done', label: 'Done' },
  { value: 'na', label: 'N/A' },
];

export function progressColor(percent) {
  if (percent >= 100) return 'var(--success)';
  if (percent >= 50) return 'var(--accent)';
  if (percent > 0) return 'var(--warning)';
  return 'var(--border-strong)';
}
