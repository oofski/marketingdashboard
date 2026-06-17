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

const NO_EMAILS = {
  ok: false,
  reason: 'No staff have an email address on file yet. Add emails in Admin → Staff, then try again.',
};

// A general "please go do your tasks" nudge to the whole team.
export function remindEveryone() {
  const emails = Users.teamEmails();
  if (emails.length === 0) return NO_EMAILS;
  const subject = 'Reminder: please complete your onboarding tasks';
  const body = [
    'Hi team,',
    '',
    'Please open the Onboarding Tracker and complete any onboarding or offboarding tasks assigned to you.',
    '',
    'Thank you!',
  ].join('\n');
  openMailto(`mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  return { ok: true, count: emails.length };
}

// Emails the list of open tasks for one employee's on/offboarding. Pass
// `recipients` (an array of email addresses) to send to specific staff;
// omit it (or pass an empty list) to fall back to the whole team.
export function emailEmployeeTasks(employee, tasks, recipients = null) {
  const emails = recipients && recipients.length ? recipients : Users.teamEmails();
  if (emails.length === 0) return NO_EMAILS;
  const name = `${employee.first_name} ${employee.last_name}`.trim();
  const pending = (tasks || []).filter((t) => t.status === 'pending');
  const lines = [`Open tasks for ${name}:`, ''];
  for (const t of pending) lines.push(`- ${t.title}${t.assignee_name ? ` (${t.assignee_name})` : ''}`);
  lines.push('', 'Please complete the items assigned to you in the Onboarding Tracker.');
  const subject = `Open tasks: ${name}`;
  openMailto(`mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`);
  return { ok: true, count: emails.length, taskCount: pending.length };
}
