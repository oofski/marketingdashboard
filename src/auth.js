import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

// Stateless signed token: "<expiry>.<signature>". No DB session needed, so it
// survives server restarts / Render's free-tier spin-downs.
export function issueToken() {
  const expiry = String(Date.now() + TOKEN_TTL_MS);
  return `${expiry}.${sign(expiry)}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [expiry, sig] = token.split('.');
  const expected = sign(expiry);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(expiry) > Date.now();
}

export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || 'changeme123';
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Express middleware guarding all admin API routes.
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
