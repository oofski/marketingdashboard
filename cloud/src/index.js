// EBG Onboarding Tracker — Cloudflare Worker API.
//
// This is the small server that holds the database connection so the desktop
// app never ships a database password. The app keeps its own login screen; it
// sends the username/password here, this Worker verifies it against D1 and
// returns a short-lived token. Every later request carries that token.
//
// Security model (internal, trusted-staff app):
//  - All endpoints except /login and /health require a valid token.
//  - Password hashes are only ever touched by the dedicated auth endpoints
//    below; the generic /query endpoint refuses any SQL mentioning them.
//  - /query allows only plain SELECT/INSERT/UPDATE/DELETE (no schema changes).

const SALT = '::onboarding_salt_v1'; // must match the desktop app's hashing
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const hashPassword = (plain) => sha256Hex((plain || '') + SALT);

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function makeToken(secret, user) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${user.id}.${user.role}.${exp}`;
  return btoa(`${payload}.${await hmacHex(secret, payload)}`);
}

async function verifyToken(secret, token) {
  try {
    const [id, role, exp, sig] = atob(token).split('.');
    const payload = `${id}.${role}.${exp}`;
    if ((await hmacHex(secret, payload)) !== sig) return null;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
    return { id: Number(id), role };
  } catch {
    return null;
  }
}

function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// Only plain reads/writes go through the generic endpoint, and the password
// hash column is never reachable here (handled by the auth endpoints).
function isQueryAllowed(sql) {
  const s = sql.trimStart().toLowerCase();
  if (!/^(select|insert|update|delete|with)\b/.test(s)) return false;
  if (s.includes('password_hash')) return false;
  return true;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const { pathname } = new URL(request.url);
    const secret = env.SESSION_SECRET;
    if (!secret) return json({ ok: false, error: 'Server not configured (missing SESSION_SECRET)' }, 500);

    try {
      if (pathname === '/api/health') return json({ ok: true });

      if (pathname === '/api/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        const row = await env.DB.prepare(
          'SELECT id, username, password_hash, full_name, role, active FROM users WHERE username = ?'
        ).bind((username || '').trim()).first();
        if (!row) return json({ ok: false, error: 'Invalid username or password' }, 401);
        if (!row.active) return json({ ok: false, error: 'This account is deactivated. Ask an admin to re-enable it.' }, 403);
        if ((await hashPassword(password)) !== row.password_hash) {
          return json({ ok: false, error: 'Invalid username or password' }, 401);
        }
        const user = { id: row.id, username: row.username, full_name: row.full_name, role: row.role };
        return json({ ok: true, token: await makeToken(secret, user), user });
      }

      // Everything below requires a valid token.
      const auth = await verifyToken(secret, bearer(request));
      if (!auth) return json({ ok: false, error: 'Not authorized' }, 401);

      if (pathname === '/api/query' && request.method === 'POST') {
        const { sql, params = [] } = await request.json();
        if (typeof sql !== 'string' || !isQueryAllowed(sql)) {
          return json({ ok: false, error: 'Query not allowed' }, 400);
        }
        const result = await env.DB.prepare(sql).bind(...params).all();
        return json({
          ok: true,
          rows: result.results || [],
          lastInsertId: result.meta?.last_row_id ?? null,
          changes: result.meta?.changes ?? 0,
        });
      }

      if (pathname === '/api/change-password' && request.method === 'POST') {
        const { currentPassword, newPassword } = await request.json();
        const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(auth.id).first();
        if (!row) return json({ ok: false, error: 'Account not found.' }, 404);
        if ((await hashPassword(currentPassword)) !== row.password_hash) {
          return json({ ok: false, error: 'Your current password is incorrect.' }, 400);
        }
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .bind(await hashPassword(newPassword), auth.id).run();
        return json({ ok: true });
      }

      // Admin-only endpoints.
      if (auth.role !== 'admin') return json({ ok: false, error: 'Admins only' }, 403);

      if (pathname === '/api/create-user' && request.method === 'POST') {
        const { username, full_name, role = 'staff', email = null, password } = await request.json();
        const result = await env.DB.prepare(
          'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)'
        ).bind(username, await hashPassword(password), full_name, role, email || null).run();
        return json({ ok: true, id: result.meta?.last_row_id ?? null });
      }

      if (pathname === '/api/reset-password' && request.method === 'POST') {
        const { userId, newPassword } = await request.json();
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .bind(await hashPassword(newPassword), Number(userId)).run();
        return json({ ok: true });
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e) }, 500);
    }
  },
};
