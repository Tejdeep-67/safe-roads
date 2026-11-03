// Accounts and sessions for Safe Roads, with no outside auth service.
//
// Passwords: scrypt (memory-hard) with a random 16 byte salt per user, compared with
// timingSafeEqual. Stored as "scrypt$N$r$p$salt$hash" so the cost can be raised later.
// Sessions: a signed token "payload.signature" (HMAC-SHA256 with SESSION_SECRET) inside
// an httpOnly cookie, so page JavaScript can never read it.
//
// Blob layout (store "safe-roads-users"):
//   users/<userId>        -> { id, name, email, passwordHash, createdAt }
//   emails/<sha256(email)> -> { userId }   (written with onlyIfNew, which keeps emails unique)
import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { json, parseCookies, readJsonBody, rateLimit, sameOrigin } from './http.mjs';

export const COOKIE = 'sr_session';
export const SESSION_DAYS = 30;
export const LIMITS = {
  // per IP. Not too low: a whole college hostel can share one IP
  login: { max: 30, windowMs: 15 * 60 * 1000 },
  // per account, so one account can't be guessed at from many IPs
  loginEmail: { max: 10, windowMs: 15 * 60 * 1000 },
  signup: { max: 10, windowMs: 60 * 60 * 1000 }, // per IP
};
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

// ---------- passwords ----------
function scrypt(password, salt, keylen, opts) {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = SCRYPT;
  const key = await scrypt(password.normalize('NFKC'), salt, keylen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await scrypt(String(password).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// a real hash of a random password, used so "no such user" takes as long as "wrong password"
let dummyHash = null;
async function burnTime(password) {
  dummyHash ??= await hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, dummyHash);
}

// ---------- tokens ----------
const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload, secret) {
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// returns the payload, or null if the token is malformed, tampered with or expired
export function verifyToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 2048) return null;
  const dot = token.indexOf('.');
  if (dot < 1 || dot !== token.lastIndexOf('.')) return null;
  const body = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = createHmac('sha256', secret).update(body).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
  if (payload.exp * 1000 <= now) return null;
  return payload;
}

export function sessionCookie(token, maxAgeSec = SESSION_DAYS * 86400) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// ---------- validation ----------
export function normaliseEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function validateSignup(body) {
  const name = typeof body?.name === 'string' ? body.name.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim() : '';
  const email = normaliseEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (name.length < 2 || name.length > 40) return { error: 'Please enter your name (2-40 characters).' };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password.length > 128) return { error: 'Password is too long (max 128 characters).' };
  if (password.toLowerCase() === email || /^(.)\1+$/.test(password)) return { error: 'Please choose a less obvious password.' };
  return { value: { name, email, password } };
}

export function validateLogin(body) {
  const email = normaliseEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password || email.length > 254 || password.length > 128) return { error: 'Enter your email and password.' };
  return { value: { email, password } };
}

export const emailKey = (email) => `emails/${createHash('sha256').update(email).digest('hex')}`;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

// ---------- session lookup (used by the hazards function too) ----------
export async function getSessionUser(req, { users, secret, now = Date.now() }) {
  const token = parseCookies(req.headers.get('cookie'))[COOKIE];
  const payload = verifyToken(token, secret, now);
  if (!payload) return null;
  const user = await users.get(`users/${payload.sub}`, { type: 'json' });
  return user && user.id === payload.sub ? user : null;
}

function issue(user, secret, now) {
  const iat = Math.floor(now / 1000);
  return signToken({ sub: user.id, iat, exp: iat + SESSION_DAYS * 86400 }, secret);
}

// ---------- request handler ----------
// deps: { users, limits, secret, ip, now, action, onDeleteUser }
export async function handleAuth(req, deps) {
  const { users, limits, secret, ip, now = Date.now(), action } = deps;
  if (!secret) return json(503, { error: 'Sign-in is not configured on this server yet.' });

  if (action === 'me' && req.method === 'GET') {
    const user = await getSessionUser(req, { users, secret, now });
    return json(200, { user: user ? publicUser(user) : null });
  }

  if (!['POST', 'DELETE'].includes(req.method)) return json(405, { error: 'Method not allowed.' }, { allow: 'GET, POST, DELETE' });
  if (!sameOrigin(req)) return json(403, { error: 'Request blocked (wrong origin).' });

  if (action === 'logout' && req.method === 'POST') {
    return json(200, { ok: true }, { 'set-cookie': clearCookie() });
  }

  const { body, error } = await readJsonBody(req, 4096);
  if (error) return json(error === 'too_large' ? 413 : 400, { error: 'Invalid request.' });

  if (action === 'signup' && req.method === 'POST') {
    const v = validateSignup(body);
    if (v.error) return json(400, { error: v.error });
    const rl = await rateLimit(limits, 'signup', ip, LIMITS.signup, now);
    if (!rl.ok) return json(429, { error: 'Too many sign-ups from this network. Try again later.' }, { 'retry-after': String(rl.retryAfter) });

    const { name, email, password } = v.value;
    const user = { id: randomUUID(), name, email, passwordHash: await hashPassword(password), createdAt: new Date(now).toISOString() };
    // claim the email first; onlyIfNew makes this the uniqueness check
    const claim = await users.setJSON(emailKey(email), { userId: user.id }, { onlyIfNew: true });
    if (claim && claim.modified === false) {
      // an email link with no user behind it (a sign-up that died half way) can be reused
      const link = await users.get(emailKey(email), { type: 'json' });
      const owner = link?.userId ? await users.get(`users/${link.userId}`, { type: 'json' }) : null;
      if (!owner) {
        await users.setJSON(emailKey(email), { userId: user.id });
        await users.setJSON(`users/${user.id}`, user);
        return json(201, { user: publicUser(user) }, { 'set-cookie': sessionCookie(issue(user, secret, now)) });
      }
      // Without email verification we can't hide that an address is taken at sign-up,
      // so the message points to sign in. Login errors stay generic.
      return json(409, { error: 'Could not create an account with that email. If you already have one, sign in instead.' });
    }
    await users.setJSON(`users/${user.id}`, user);
    return json(201, { user: publicUser(user) }, { 'set-cookie': sessionCookie(issue(user, secret, now)) });
  }

  if (action === 'login' && req.method === 'POST') {
    const v = validateLogin(body);
    if (v.error) return json(400, { error: v.error });
    const rl = await rateLimit(limits, 'login', ip, LIMITS.login, now);
    const rl2 = rl.ok ? await rateLimit(limits, 'login-email', v.value.email, LIMITS.loginEmail, now) : rl;
    if (!rl.ok || !rl2.ok) {
      return json(429, { error: 'Too many sign-in attempts. Wait a few minutes and try again.' }, { 'retry-after': String((rl.ok ? rl2 : rl).retryAfter) });
    }
    const link = await users.get(emailKey(v.value.email), { type: 'json' });
    const user = link?.userId ? await users.get(`users/${link.userId}`, { type: 'json' }) : null;
    if (!user) {
      await burnTime(v.value.password);
      return json(401, { error: 'Wrong email or password.' });
    }
    if (!(await verifyPassword(v.value.password, user.passwordHash))) return json(401, { error: 'Wrong email or password.' });
    return json(200, { user: publicUser(user) }, { 'set-cookie': sessionCookie(issue(user, secret, now)) });
  }

  if (action === 'me' && req.method === 'DELETE') {
    // delete my account (needs the password again) and everything I reported
    const user = await getSessionUser(req, { users, secret, now });
    if (!user) return json(401, { error: 'Please sign in again.' });
    const rl = await rateLimit(limits, 'login', ip, LIMITS.login, now);
    if (!rl.ok) return json(429, { error: 'Too many attempts. Try again later.' }, { 'retry-after': String(rl.retryAfter) });
    if (!(await verifyPassword(body.password ?? '', user.passwordHash))) return json(401, { error: 'Wrong password.' });
    let removed = 0;
    try {
      removed = deps.onDeleteUser ? await deps.onDeleteUser(user.id) : 0;
    } catch {
      // reports first, account second: never leave reports behind for a deleted user
      return json(409, { error: 'Busy, please try again.' });
    }
    await users.delete(emailKey(user.email));
    await users.delete(`users/${user.id}`);
    return json(200, { ok: true, reportsRemoved: removed }, { 'set-cookie': clearCookie() });
  }

  return json(404, { error: 'Not found.' });
}
