// Small helpers shared by all the functions: JSON responses, cookies, origin check,
// a blob-backed rate limiter and IP hashing.
import { createHash } from 'node:crypto';

export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

// CSRF: the session cookie is SameSite=Lax, so other sites can't send it with a POST
// from fetch/forms anyway. On top of that every state-changing request must come from
// our own origin. Browsers always send Origin on cross-site POST/DELETE, so a missing
// Origin means it is not a cross-site browser request (curl, server code).
export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) {
    const site = req.headers.get('sec-fetch-site');
    return !site || site === 'same-origin' || site === 'none';
  }
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export const hashId = (value, salt = 'saferoads') =>
  createHash('sha256').update(`${salt}:${value || 'unknown'}`).digest('hex').slice(0, 32);

// Fixed-window counter per (bucket, id) stored as a tiny JSON blob.
// Not atomic: two requests at the exact same moment can both pass, which is fine for
// slowing down password guessing and spam. It is a speed bump, not a quota system.
export async function rateLimit(store, bucket, id, { max, windowMs }, now = Date.now()) {
  const key = `rl/${bucket}/${hashId(id)}`;
  let entry = null;
  try {
    entry = await store.get(key, { type: 'json' });
  } catch {
    entry = null;
  }
  if (!entry || typeof entry.start !== 'number' || now - entry.start > windowMs) entry = { start: now, count: 0 };
  if (entry.count >= max) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)) };
  }
  entry.count++;
  await store.setJSON(key, entry);
  return { ok: true, remaining: max - entry.count };
}

export async function readJsonBody(req, maxBytes) {
  const text = await req.text();
  if (text.length > maxBytes) return { error: 'too_large' };
  try {
    const body = JSON.parse(text || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid' };
    return { body };
  } catch {
    return { error: 'invalid' };
  }
}
