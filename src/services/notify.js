import { Users } from './db.js';

function openMailto(url) {
  if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
}

// Opens a pre-filled team email (in Outlook / the OS default mail app) announcing
// a new onboarding or offboarding. Returns { ok } or { ok:false, reason } so the
// caller can tell the admin why nothing happened (e.g. no staff emails on file).
export function notifyTeam({ kind, employee }) {
  const emails = Users.teamEmails();
  if (emails.length === 0) {
    return {
      ok: false,
      reason: 'No staff have an email address on file yet. Add emails in Admin → Staff, then try again.',
    };
  }

  const name = `${employee.first_name} ${employee.last_name}`.trim();
  const isOff = kind === 'offboarding';
  const subject = isOff ? `Offboarding started: ${name}` : `New onboarding: ${name}`;
  const lines = isOff
    ? [
        `${name} is being offboarded${employee.final_day ? ` — final day ${employee.final_day}` : ''}.`,
        employee.position ? `Position: ${employee.position}` : null,
        '',
        'Please check the Onboarding Tracker app for any offboarding tasks assigned to you.',
      ]
    : [
        `${name} has started onboarding${employee.start_date ? ` — start date ${employee.start_date}` : ''}.`,
        employee.position ? `Position: ${employee.position}` : null,
        '',
        'Please check the Onboarding Tracker app for any onboarding tasks assigned to you.',
      ];
  const body = lines.filter((l) => l !== null).join('\n');

  const url = `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  openMailto(url);
  return { ok: true, count: emails.length };
}
