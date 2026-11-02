// Logic for the shared hazard store. Kept separate from the Netlify wrapper so it
// can be tested with a fake in-memory store (see hazards.test.mjs).
import { createHash, randomUUID } from 'node:crypto';

export const KEY = 'reports';
export const MAX_REPORTS = 1500;
export const MERGE_RADIUS_M = 15; // a new report this close to an old one counts as a confirmation
export const RATE_LIMIT = { max: 12, windowMs: 10 * 60 * 1000 };
const SEVERITIES = ['low', 'medium', 'high'];
const SOURCES = ['camera', 'video', 'photo', 'manual'];

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

export function haversine(aLat, aLng, bLat, bLng) {
  const r = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// returns { value } or { error }
export function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { error: 'lat out of range' };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { error: 'lng out of range' };
  if (!SEVERITIES.includes(body.severity)) return { error: 'severity must be low, medium or high' };
  const source = SOURCES.includes(body.source) ? body.source : 'manual';
  let confidence = null;
  if (body.confidence !== undefined && body.confidence !== null) {
    confidence = Number(body.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return { error: 'confidence must be 0..1' };
    confidence = Math.round(confidence * 100) / 100;
  }
  let note = typeof body.note === 'string' ? body.note : '';
  // strip control characters and angle brackets, keep it short
  note = note.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 140);
  return {
    value: {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      severity: body.severity,
      confidence,
      source,
      note,
    },
  };
}

const hashIp = (ip) => createHash('sha256').update(`saferoads:${ip || 'unknown'}`).digest('hex').slice(0, 24);

export async function checkRateLimit(store, ip, now) {
  const key = `rl-${hashIp(ip)}`;
  const entry = (await store.get(key, { type: 'json' })) || { start: now, count: 0 };
  if (now - entry.start > RATE_LIMIT.windowMs) {
    entry.start = now;
    entry.count = 0;
  }
  if (entry.count >= RATE_LIMIT.max) {
    return { ok: false, retryAfter: Math.ceil((entry.start + RATE_LIMIT.windowMs - now) / 1000) };
  }
  entry.count++;
  await store.setJSON(key, entry);
  return { ok: true };
}

async function readReports(store) {
  const res = await store.getWithMetadata(KEY, { type: 'json', consistency: 'strong' });
  return { reports: Array.isArray(res?.data) ? res.data : [], etag: res?.etag };
}

export async function handle(req, { store, ip, now = Date.now() }) {
  if (req.method === 'GET') {
    const { reports } = await readReports(store);
    return json(200, { hazards: reports, count: reports.length });
  }
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, { allow: 'GET, POST' });

  const text = await req.text();
  if (text.length > 2048) return json(413, { error: 'body too large' });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'invalid JSON' });
  }
  const { value, error } = validate(body);
  if (error) return json(400, { error });

  const rl = await checkRateLimit(store, ip, now);
  if (!rl.ok) return json(429, { error: 'too many reports, try again later' }, { 'retry-after': String(rl.retryAfter) });

  // optimistic concurrency: re-read and retry if someone else wrote in between
  for (let attempt = 0; attempt < 4; attempt++) {
    const { reports, etag } = await readReports(store);
    const near = reports.find((r) => haversine(r.lat, r.lng, value.lat, value.lng) <= MERGE_RADIUS_M);
    let saved;
    let merged = false;
    if (near) {
      near.confirmations = (near.confirmations || 1) + 1;
      if (SEVERITIES.indexOf(value.severity) > SEVERITIES.indexOf(near.severity)) near.severity = value.severity;
      near.updatedAt = new Date(now).toISOString();
      saved = near;
      merged = true;
    } else {
      saved = { id: randomUUID(), ...value, createdAt: new Date(now).toISOString(), confirmations: 1 };
      reports.push(saved);
      if (reports.length > MAX_REPORTS) reports.splice(0, reports.length - MAX_REPORTS);
    }
    const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const res = await store.setJSON(KEY, reports, opts);
    if (res?.modified !== false) return json(merged ? 200 : 201, { hazard: saved, merged });
  }
  return json(409, { error: 'busy, please retry' });
}
