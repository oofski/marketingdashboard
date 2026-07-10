// Client for the EBG cloud backend (Cloudflare Worker + D1).
// The desktop app talks to this instead of a local file, so every computer
// shares the same live data. The login screen stays the same — it just calls
// /api/login here, gets a short-lived token, and sends it on every request.

const API_BASE = 'https://ebg-onboarding-api.sidharth-be9.workers.dev';
const TOKEN_KEY = 'ebg_api_token';

let token = null;
try { token = sessionStorage.getItem(TOKEN_KEY) || null; } catch { /* no storage */ }

export function setToken(t) {
  token = t || null;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}
export function getToken() { return token; }

async function call(path, body) {
  const hadToken = !!token;
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body || {}),
    });
  } catch {
    throw new Error('Could not reach the server. Check your internet connection.');
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (res.status === 401) {
    const err = new Error(data.error || 'Your session expired — please sign in again.');
    err.code = 'AUTH';
    // A 401 on a request that CARRIED a token means the session died mid-use
    // (expired/rotated token), not a failed login (which is sent without one).
    // Signal the app to clear the dead session and return to the sign-in screen
    // instead of dead-ending on a raw "Not authorized" error on every write.
    if (hadToken) {
      try { window.dispatchEvent(new CustomEvent('auth-expired')); } catch { /* non-browser env */ }
    }
    throw err;
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function apiLogin(username, password) {
  return call('/api/login', { username, password }); // { ok, token, user }
}
export async function apiQuery(sql, params = []) {
  return call('/api/query', { sql, params }); // { ok, rows, lastInsertId, changes }
}
export async function apiChangePassword(currentPassword, newPassword) {
  return call('/api/change-password', { currentPassword, newPassword });
}
export async function apiCreateUser(payload) {
  return call('/api/create-user', payload); // { ok, id }
}
export async function apiResetPassword(userId, newPassword) {
  return call('/api/reset-password', { userId, newPassword });
}
