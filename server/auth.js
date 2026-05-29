import './env.js';
import crypto from 'node:crypto';

const SECRET = process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function passwords() {
  // Passwords come only from env vars — never hardcoded — so the repo is safe to share.
  // A role with no env var set is simply disabled.
  const map = {};
  if (process.env.ADMIN_PASSWORD) map[process.env.ADMIN_PASSWORD] = 'admin';
  if (process.env.TEAM_PASSWORD) map[process.env.TEAM_PASSWORD] = 'team';
  if (process.env.CLIENT_PASSWORD) map[process.env.CLIENT_PASSWORD] = 'client';
  return map;
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
}

export function issueToken(role) {
  const payload = { role, exp: Date.now() + TOKEN_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const expected = sign(payloadB64);
  // constant-time compare
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload.role || null;
  } catch {
    return null;
  }
}

// POST /api/login  { password } -> { role, token }
export function loginHandler(req, res) {
  const pwd = (req.body && req.body.password ? String(req.body.password) : '').trim();
  const role = passwords()[pwd];
  if (!role) return res.status(401).json({ error: 'Incorrect password' });
  res.json({ role, token: issueToken(role) });
}

// Middleware: attach req.role or 401.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const role = verifyToken(token);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  req.role = role;
  next();
}

// Middleware factory: only allow the listed roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
