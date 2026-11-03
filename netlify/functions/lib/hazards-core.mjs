// Logic for the shared hazard store. Kept separate from the Netlify wrapper so it
// can be tested with a fake in-memory store (see netlify/tests).
//
// Blob layout:
//   store "safe-roads-hazards", key "reports" -> JSON array of reports
//     { id, lat, lng, severity, confidence, source, note, potholes, createdAt,
//       ownerId, ownerName, hasPhoto }
//     (reports from before accounts existed have no ownerId; they are shown as
//      "before sign-in" and nobody can delete them through the API)
//   store "safe-roads-photos", key "<reportId>" -> the JPEG bytes
import { randomUUID } from 'node:crypto';
import { json, readJsonBody, rateLimit, sameOrigin } from './http.mjs';

export const KEY = 'reports';
export const MAX_REPORTS = 2000;
export const DUPLICATE_RADIUS_M = 15; // the same person reporting the same spot again
export const RATE_LIMIT = { max: 12, windowMs: 10 * 60 * 1000 };
export const DELETE_LIMIT = { max: 40, windowMs: 10 * 60 * 1000 };
export const MAX_PHOTO_BYTES = 350 * 1024;
const MAX_BODY = 520 * 1024; // base64 makes the photo ~4/3 bigger
const SEVERITIES = ['low', 'medium', 'high'];
const SOURCES = ['camera', 'video', 'photo', 'manual'];

export function haversine(aLat, aLng, bLat, bLng) {
  const r = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// "data:image/jpeg;base64,...." -> Buffer, or an error
export function decodePhoto(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'photo must be a JPEG data URL' };
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: 'photo must be a JPEG data URL' };
  const bytes = Buffer.from(m[1], 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'photo is too big' };
  // JPEG files start with FF D8 FF
  if (bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { error: 'photo is not a JPEG' };
  return { bytes };
}

// returns { value } or { error }
export function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (body.lat === null || body.lat === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) return { error: 'lat out of range' };
  if (body.lng === null || body.lng === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) return { error: 'lng out of range' };
  if (!SEVERITIES.includes(body.severity)) return { error: 'severity must be low, medium or high' };
  const source = SOURCES.includes(body.source) ? body.source : 'manual';
  let confidence = null;
  if (body.confidence !== undefined && body.confidence !== null) {
    confidence = Number(body.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return { error: 'confidence must be 0..1' };
    confidence = Math.round(confidence * 100) / 100;
  }
  let potholes = 0;
  if (body.potholes !== undefined) {
    potholes = Number(body.potholes);
    if (!Number.isInteger(potholes) || potholes < 0 || potholes > 50) return { error: 'potholes must be 0..50' };
  }
  let note = typeof body.note === 'string' ? body.note : '';
  // strip control characters and angle brackets, keep it short
  note = note.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 140);
  let photo = null;
  if (body.photo !== undefined && body.photo !== null) {
    const p = decodePhoto(body.photo);
    if (p.error) return { error: p.error };
    photo = p.bytes;
  }
  return {
    value: {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      severity: body.severity,
      confidence,
      potholes,
      source,
      note,
    },
    photo,
  };
}

// what everyone may see about a report
export function publicReport(r, userId) {
  return {
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    severity: r.severity,
    confidence: r.confidence ?? null,
    potholes: r.potholes ?? 0,
    source: r.source,
    note: r.note || '',
    createdAt: r.createdAt,
    by: r.ownerName ?? null,
    mine: Boolean(userId && r.ownerId === userId),
    hasPhoto: Boolean(r.hasPhoto),
  };
}

export async function readReports(store) {
  const res = await store.getWithMetadata(KEY, { type: 'json', consistency: 'strong' });
  return { reports: Array.isArray(res?.data) ? res.data : [], etag: res?.etag };
}

// read-modify-write with the etag, retried if someone else wrote in between
export async function updateReports(store, fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { reports, etag } = await readReports(store);
    const result = fn(reports);
    if (result.write === false) return result;
    const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const res = await store.setJSON(KEY, result.reports ?? reports, opts);
    if (res?.modified !== false) return result;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  return { busy: true };
}

// remove every report of one user (account deletion); returns how many went
export async function deleteReportsOf(store, photos, userId) {
  const res = await updateReports(store, (reports) => {
    const gone = reports.filter((r) => r.ownerId === userId);
    if (!gone.length) return { write: false, gone };
    return { reports: reports.filter((r) => r.ownerId !== userId), gone };
  });
  for (const r of res.gone ?? []) if (r.hasPhoto) await photos.delete(r.id).catch(() => {});
  return res.gone?.length ?? 0;
}

// deps: { store, photos, limits, user, ip, now, id }
export async function handle(req, deps) {
  const { store, photos, limits, user, ip, now = Date.now(), id } = deps;
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const { reports } = await readReports(store);
    if (url.searchParams.get('mine') === '1') {
      if (!user) return json(401, { error: 'Sign in to see your reports.' });
      const mine = reports.filter((r) => r.ownerId === user.id).map((r) => publicReport(r, user.id)).reverse();
      return json(200, { hazards: mine, count: mine.length });
    }
    const list = reports.map((r) => publicReport(r, user?.id));
    return json(200, { hazards: list, count: list.length });
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') return json(405, { error: 'Method not allowed.' }, { allow: 'GET, POST, DELETE' });
  if (!sameOrigin(req)) return json(403, { error: 'Request blocked (wrong origin).' });
  if (!user) return json(401, { error: 'Sign in to report or delete potholes.' });

  if (req.method === 'DELETE') {
    if (!id) return json(400, { error: 'Which report?' });
    const rl = await rateLimit(limits, 'delete', user.id, DELETE_LIMIT, now);
    if (!rl.ok) return json(429, { error: 'Too many deletes, slow down a little.' }, { 'retry-after': String(rl.retryAfter) });
    const res = await updateReports(store, (reports) => {
      const r = reports.find((x) => x.id === id);
      if (!r) return { write: false, status: 404 };
      if (r.ownerId !== user.id) return { write: false, status: 403 };
      return { reports: reports.filter((x) => x.id !== id), removed: r };
    });
    if (res.busy) return json(409, { error: 'Busy, please retry.' });
    if (res.status === 404) return json(404, { error: 'That report no longer exists.' });
    if (res.status === 403) return json(403, { error: 'You can only delete your own reports.' });
    if (res.removed?.hasPhoto) await photos.delete(id).catch(() => {});
    return json(200, { ok: true, id });
  }

  // POST: new report
  if (id) return json(404, { error: 'Not found.' });
  const { body, error: bodyError } = await readJsonBody(req, MAX_BODY);
  if (bodyError) return json(bodyError === 'too_large' ? 413 : 400, { error: bodyError === 'too_large' ? 'Photo is too big.' : 'Invalid request.' });
  const { value, photo, error } = validate(body);
  if (error) return json(400, { error });

  const rl = await rateLimit(limits, 'report', `${user.id}|${ip}`, RATE_LIMIT, now);
  if (!rl.ok) return json(429, { error: 'Too many reports in a short time. Try again in a few minutes.' }, { 'retry-after': String(rl.retryAfter) });

  const report = {
    id: randomUUID(),
    ...value,
    createdAt: new Date(now).toISOString(),
    ownerId: user.id,
    ownerName: user.name.split(' ')[0].slice(0, 24),
    hasPhoto: Boolean(photo),
  };
  // photo first, so a report never points at a photo that isn't there yet
  if (photo) await photos.set(report.id, photo, { metadata: { contentType: 'image/jpeg', ownerId: user.id } });
  const res = await updateReports(store, (reports) => {
    const dup = reports.find(
      (r) => r.ownerId === user.id && haversine(r.lat, r.lng, report.lat, report.lng) <= DUPLICATE_RADIUS_M,
    );
    if (dup) return { write: false, dup };
    reports.push(report);
    const trimmed = reports.length > MAX_REPORTS ? reports.splice(0, reports.length - MAX_REPORTS) : [];
    return { reports, trimmed };
  });
  if ((res.busy || res.dup) && photo) await photos.delete(report.id).catch(() => {});
  if (res.busy) return json(409, { error: 'Busy, please retry.' });
  if (res.dup) return json(409, { error: 'You already reported a pothole at this spot.', hazard: publicReport(res.dup, user.id) });
  for (const r of res.trimmed ?? []) if (r.hasPhoto) await photos.delete(r.id).catch(() => {});
  return json(201, { hazard: publicReport(report, user.id) });
}
