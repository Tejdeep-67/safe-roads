// Shared hazard reports, stored in Netlify Blobs (one blob per map tile, see tiles.mjs).
//   GET    /api/hazards                 -> all visible reports (anyone); ?mine=1 only mine; ?bbox=minLng,minLat,maxLng,maxLat
//   POST   /api/hazards                 -> add a report (signed in, validated, rate limited)
//   DELETE /api/hazards/:id             -> delete my own report
//   POST   /api/hazards/:id/vote        -> { vote: 'confirm' | 'fixed' | 'flag', reason? } (signed in, not on my own report)
//   DELETE /api/hazards/:id/vote        -> take my vote back
//
// The community checks reports instead of one person deciding:
//   - the reporter counts as the first confirmation, a second person confirming makes it "verified"
//   - two people saying "fixed" (and more of them than people saying "still there") marks it resolved
//   - three different people flagging it hides it until a moderator looks at it
import { json, readJsonBody, rateLimit, sameOrigin } from './http.mjs';
import { stripJpegMetadata } from './jpeg.mjs';
import {
  MAX_PER_TILE,
  MAX_TILES_PER_QUERY,
  isReportId,
  migrateLegacy,
  newReportId,
  readReports,
  tileKeyFor,
  tileKeyOfId,
  tileKeysForBbox,
  updateTile,
} from './tiles.mjs';

export const RATE_LIMIT = { max: 12, windowMs: 10 * 60 * 1000 };
export const NEW_ACCOUNT_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 }; // accounts younger than NEW_ACCOUNT_MS
export const NEW_ACCOUNT_MS = 60 * 60 * 1000;
export const DAILY_LIMIT = { max: 60, windowMs: 24 * 60 * 60 * 1000 };
export const DELETE_LIMIT = { max: 40, windowMs: 10 * 60 * 1000 };
export const VOTE_LIMIT = { max: 60, windowMs: 10 * 60 * 1000 };
export const FLAG_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };
export const DUPLICATE_RADIUS_M = 15; // the same person reporting the same spot again
export const MAX_PHOTO_BYTES = 350 * 1024;
export const VERIFY_AT = 2; // distinct people confirming (the reporter counts)
export const RESOLVE_AT = 2; // distinct people saying it is fixed
export const HIDE_AT = 3; // distinct people flagging it
export const STALE_DAYS = 180;
const MAX_BODY = 520 * 1024; // base64 makes the photo ~4/3 bigger

export const TYPES = ['pothole', 'waterlogging', 'broken_edge', 'open_manhole', 'speed_bump'];
export const SEVERITIES = ['low', 'medium', 'high'];
export const SOURCES = ['camera', 'video', 'photo', 'manual'];
export const FLAG_REASONS = ['spam', 'fake', 'wrong_place', 'offensive', 'other'];

export function haversine(aLat, aLng, bLat, bLng) {
  const r = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// "data:image/jpeg;base64,...." -> Buffer (metadata stripped), or an error
export function decodePhoto(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'photo must be a JPEG data URL' };
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: 'photo must be a JPEG data URL' };
  const bytes = Buffer.from(m[1], 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'photo is too big' };
  // JPEG files start with FF D8 FF
  if (bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { error: 'photo is not a JPEG' };
  try {
    // drop EXIF (GPS of the phone, camera model, time) before anything is stored
    return { bytes: stripJpegMetadata(bytes) };
  } catch {
    return { error: 'photo is not a valid JPEG' };
  }
}

// returns { value } or { error }
export function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (body.lat === null || body.lat === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) return { error: 'lat out of range' };
  if (body.lng === null || body.lng === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) return { error: 'lng out of range' };
  if (!SEVERITIES.includes(body.severity)) return { error: 'severity must be low, medium or high' };
  if (body.type !== undefined && !TYPES.includes(body.type)) return { error: `type must be one of ${TYPES.join(', ')}` };
  const type = body.type ?? 'pothole';
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
      // 5 decimals is about 1 metre: enough to find the hazard, no more precise than needed
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      type,
      severity: body.severity,
      confidence,
      potholes,
      source,
      note,
    },
    photo,
  };
}

// ---------- verification state ----------
const votesOf = (r) => ({ confirm: r.votes?.confirm ?? [], fixed: r.votes?.fixed ?? [], flag: r.votes?.flag ?? [] });

export function counts(r) {
  const v = votesOf(r);
  const confirm = new Set(v.confirm.filter((u) => u !== r.ownerId));
  const fixed = new Set(v.fixed);
  return {
    // the reporter is the first confirmation (unless they said it is fixed)
    confirmations: confirm.size + (r.ownerId && !fixed.has(r.ownerId) ? 1 : 0),
    fixedVotes: fixed.size,
    flags: new Set(v.flag.filter((f) => f.u !== r.ownerId).map((f) => f.u)).size,
  };
}

// Derived, never trusted from the client: status follows the votes (a moderator can pin it)
export function deriveState(r, now = Date.now()) {
  const c = counts(r);
  const v = votesOf(r);
  let status = r.status === 'resolved' && r.resolvedBy === 'moderator' ? 'resolved' : 'open';
  if (status === 'open' && c.fixedVotes >= RESOLVE_AT && c.fixedVotes > v.confirm.filter((u) => u !== r.ownerId).length) status = 'resolved';
  const resolvedBy = status === 'resolved' ? (r.resolvedBy === 'moderator' ? 'moderator' : 'community') : null;
  const hidden = !r.reviewed && c.flags >= HIDE_AT;
  const last = Date.parse(r.updatedAt || r.createdAt);
  const stale = status === 'open' && c.confirmations < VERIFY_AT && now - last > STALE_DAYS * 86400000;
  return { ...c, status, resolvedBy, hidden, verified: c.confirmations >= VERIFY_AT, stale };
}

// what everyone may see about a report
export function publicReport(r, userId, now = Date.now()) {
  const d = deriveState(r, now);
  const myVote = userId
    ? votesOf(r).fixed.includes(userId)
      ? 'fixed'
      : votesOf(r).confirm.includes(userId)
        ? 'confirm'
        : votesOf(r).flag.some((f) => f.u === userId)
          ? 'flag'
          : null
    : null;
  return {
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    type: r.type ?? 'pothole',
    severity: r.severity,
    confidence: r.confidence ?? null,
    potholes: r.potholes ?? 0,
    source: r.source,
    note: r.note || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? r.createdAt,
    status: d.stale ? 'stale' : d.status,
    verified: d.verified,
    confirmations: d.confirmations,
    fixedVotes: d.fixedVotes,
    mine: Boolean(userId && r.ownerId === userId),
    myVote,
    hasPhoto: Boolean(r.hasPhoto),
  };
}

export const isHidden = (r, now) => deriveState(r, now).hidden;

export function parseBbox(text) {
  if (!text) return null;
  const p = String(text).split(',').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return { error: 'bbox must be minLng,minLat,maxLng,maxLat' };
  const [minLng, minLat, maxLng, maxLat] = p;
  if (minLng > maxLng || minLat > maxLat || minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return { error: 'bbox is out of range' };
  return { bbox: p };
}

// tiles to read for a request: a bbox's tiles, or every tile when there is none
export function tilesFor(bboxText) {
  const b = parseBbox(bboxText);
  if (b?.error) return { error: b.error };
  if (!b) return { keys: null };
  const keys = tileKeysForBbox(b.bbox);
  if (keys.length > MAX_TILES_PER_QUERY) return { error: 'bbox is too large, ask for a smaller area' };
  return { keys, bbox: b.bbox };
}

export const inBbox = (r, bbox) => !bbox || (r.lng >= bbox[0] && r.lat >= bbox[1] && r.lng <= bbox[2] && r.lat <= bbox[3]);

// remove every report of one user (account deletion) and take their votes back; returns how many reports went
export async function deleteReportsOf(store, photos, userId) {
  const { listTileKeys } = await import('./tiles.mjs');
  let removed = 0;
  for (const key of await listTileKeys(store)) {
    const res = await updateTile(store, key, (reports) => {
      const gone = reports.filter((r) => r.ownerId === userId);
      let touched = gone.length > 0;
      const kept = reports
        .filter((r) => r.ownerId !== userId)
        .map((r) => {
          const v = votesOf(r);
          const next = {
            confirm: v.confirm.filter((u) => u !== userId),
            fixed: v.fixed.filter((u) => u !== userId),
            flag: v.flag.filter((f) => f.u !== userId),
          };
          if (next.confirm.length !== v.confirm.length || next.fixed.length !== v.fixed.length || next.flag.length !== v.flag.length) {
            touched = true;
            return { ...r, votes: next };
          }
          return r;
        });
      if (!touched) return { write: false, gone };
      return { reports: kept, gone };
    });
    if (res.busy) throw new Error('busy');
    for (const r of res.gone ?? []) if (r.hasPhoto) await photos.delete(r.id).catch(() => {});
    removed += res.gone?.length ?? 0;
  }
  return removed;
}

// ---------- votes ----------
async function handleVote(req, deps) {
  const { store, photos, limits, user, ip, now = Date.now(), id } = deps;
  void photos;
  if (!sameOrigin(req)) return json(403, { error: 'Request blocked (wrong origin).' });
  if (!user) return json(401, { error: 'Sign in to confirm or flag reports.' });
  const tile = tileKeyOfId(id);
  if (!tile) return json(404, { error: 'That report no longer exists.' });

  let vote = null;
  let reason = null;
  if (req.method === 'POST') {
    const { body, error } = await readJsonBody(req, 2048);
    if (error) return json(400, { error: 'Invalid request.' });
    vote = body.vote;
    if (!['confirm', 'fixed', 'flag'].includes(vote)) return json(400, { error: 'vote must be confirm, fixed or flag' });
    if (vote === 'flag') {
      reason = FLAG_REASONS.includes(body.reason) ? body.reason : 'other';
      const f = await rateLimit(limits, 'flag', user.id, FLAG_LIMIT, now);
      if (!f.ok) return json(429, { error: 'You have flagged a lot of reports lately. Try again later.' }, { 'retry-after': String(f.retryAfter) });
    }
  } else if (req.method !== 'DELETE') {
    return json(405, { error: 'Method not allowed.' }, { allow: 'POST, DELETE' });
  }
  const rl = await rateLimit(limits, 'vote', `${user.id}|${ip}`, VOTE_LIMIT, now);
  if (!rl.ok) return json(429, { error: 'Slow down a little, too many votes in a short time.' }, { 'retry-after': String(rl.retryAfter) });

  const res = await updateTile(store, tile, (reports) => {
    const r = reports.find((x) => x.id === id);
    if (!r) return { write: false, missing: true };
    if (deriveState(r, now).hidden) return { write: false, missing: true };
    const v = votesOf(r);
    if (req.method === 'DELETE') {
      r.votes = {
        confirm: v.confirm.filter((u) => u !== user.id),
        fixed: v.fixed.filter((u) => u !== user.id),
        flag: v.flag.filter((f) => f.u !== user.id),
      };
    } else {
      if (r.ownerId === user.id && vote !== 'fixed') return { write: false, own: true };
      if (vote === 'flag') {
        if (v.flag.some((f) => f.u === user.id)) return { write: false, same: true, report: r };
        r.votes = { ...v, flag: [...v.flag, { u: user.id, r: reason }] };
      } else {
        // confirm and fixed contradict each other: the latest one replaces the earlier one
        const other = vote === 'confirm' ? 'fixed' : 'confirm';
        if (v[vote].includes(user.id) && !v[other].includes(user.id)) return { write: false, same: true, report: r };
        r.votes = { ...v, [other]: v[other].filter((u) => u !== user.id), [vote]: [...v[vote], user.id] };
      }
    }
    r.updatedAt = new Date(now).toISOString();
    return { reports, report: r };
  });
  if (res.busy) return json(409, { error: 'Busy, please retry.' });
  if (res.missing) return json(404, { error: 'That report no longer exists.' });
  if (res.own) return json(403, { error: "That's your own report. You can only say it was fixed, or delete it." });
  return json(200, { hazard: publicReport(res.report, user.id, now), unchanged: Boolean(res.same) });
}

// ---------- request handler ----------
// deps: { store, photos, limits, user, ip, now, id, action }
export async function handle(req, deps) {
  const { store, photos, limits, user, ip, now = Date.now(), id, action } = deps;
  const url = new URL(req.url);
  await migrateLegacy(store, photos);

  if (action === 'vote') return handleVote(req, deps);
  if (action) return json(404, { error: 'Not found.' });

  if (req.method === 'GET') {
    if (id) {
      if (!isReportId(id)) return json(404, { error: 'Not found.' });
      const reports = await readReports(store, [tileKeyOfId(id)]);
      const r = reports.find((x) => x.id === id);
      if (!r || (isHidden(r, now) && r.ownerId !== user?.id)) return json(404, { error: 'Not found.' });
      return json(200, { hazard: publicReport(r, user?.id, now) });
    }
    const t = tilesFor(url.searchParams.get('bbox'));
    if (t.error) return json(400, { error: t.error });
    const reports = (await readReports(store, t.keys)).filter((r) => inBbox(r, t.bbox));
    if (url.searchParams.get('mine') === '1') {
      if (!user) return json(401, { error: 'Sign in to see your reports.' });
      const mine = reports
        .filter((r) => r.ownerId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => publicReport(r, user.id, now));
      return json(200, { hazards: mine, count: mine.length });
    }
    // hidden (flagged) reports stay out of the public list; stale ones too, they come back with ?stale=1
    const showStale = url.searchParams.get('stale') === '1';
    const list = reports
      .filter((r) => !isHidden(r, now) || r.ownerId === user?.id)
      .map((r) => publicReport(r, user?.id, now))
      .filter((h) => showStale || h.status !== 'stale');
    return json(200, { hazards: list, count: list.length });
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') return json(405, { error: 'Method not allowed.' }, { allow: 'GET, POST, DELETE' });
  if (!sameOrigin(req)) return json(403, { error: 'Request blocked (wrong origin).' });
  if (!user) return json(401, { error: 'Sign in to report or delete hazards.' });

  if (req.method === 'DELETE') {
    if (!id) return json(400, { error: 'Which report?' });
    const rl = await rateLimit(limits, 'delete', user.id, DELETE_LIMIT, now);
    if (!rl.ok) return json(429, { error: 'Too many deletes, slow down a little.' }, { 'retry-after': String(rl.retryAfter) });
    const tile = tileKeyOfId(id);
    if (!tile) return json(404, { error: 'That report no longer exists.' });
    const res = await updateTile(store, tile, (reports) => {
      const i = reports.findIndex((r) => r.id === id);
      if (i < 0) return { write: false, missing: true };
      if (!reports[i].ownerId || reports[i].ownerId !== user.id) return { write: false, forbidden: true };
      const [removed] = reports.splice(i, 1);
      return { reports, removed };
    });
    if (res.busy) return json(409, { error: 'Busy, please retry.' });
    if (res.missing) return json(404, { error: 'That report no longer exists.' });
    if (res.forbidden) return json(403, { error: 'You can only delete your own reports.' });
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
  const daily = await rateLimit(limits, 'report-day', user.id, DAILY_LIMIT, now);
  if (!daily.ok) return json(429, { error: 'Daily report limit reached. Thank you, please come back tomorrow.' }, { 'retry-after': String(daily.retryAfter) });
  // brand-new accounts are the usual way to spam: they get a smaller allowance for their first hour
  if (user.createdAt && now - Date.parse(user.createdAt) < NEW_ACCOUNT_MS) {
    const n = await rateLimit(limits, 'report-new', user.id, NEW_ACCOUNT_LIMIT, now);
    if (!n.ok) return json(429, { error: 'New accounts can send a few reports in their first hour. Try again a little later.' }, { 'retry-after': String(n.retryAfter) });
  }

  const report = {
    id: newReportId(value.lat, value.lng),
    ...value,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    ownerId: user.id,
    hasPhoto: Boolean(photo),
    status: 'open',
    votes: { confirm: [], fixed: [], flag: [] },
  };
  // photo first, so a report never points at a photo that isn't there yet
  if (photo) await photos.set(report.id, photo, { metadata: { contentType: 'image/jpeg', ownerId: user.id } });
  const res = await updateTile(store, tileKeyFor(report.lat, report.lng), (reports) => {
    const dup = reports.find(
      (r) => r.ownerId === user.id && (r.type ?? 'pothole') === report.type && haversine(r.lat, r.lng, report.lat, report.lng) <= DUPLICATE_RADIUS_M,
    );
    if (dup) return { write: false, dup };
    reports.push(report);
    let trimmed = [];
    if (reports.length > MAX_PER_TILE) {
      // drop the oldest resolved ones first, then the oldest of the rest
      const order = [...reports].sort((a, b) => (deriveState(a).status === 'resolved' ? 0 : 1) - (deriveState(b).status === 'resolved' ? 0 : 1) || a.createdAt.localeCompare(b.createdAt));
      const drop = new Set(order.slice(0, reports.length - MAX_PER_TILE).map((r) => r.id));
      trimmed = reports.filter((r) => drop.has(r.id));
      return { reports: reports.filter((r) => !drop.has(r.id)), trimmed };
    }
    return { reports, trimmed };
  });
  if ((res.busy || res.dup) && photo) await photos.delete(report.id).catch(() => {});
  if (res.busy) return json(409, { error: 'Busy, please retry.' });
  if (res.dup) return json(409, { error: 'You already reported this kind of hazard at this spot.', hazard: publicReport(res.dup, user.id, now) });
  for (const r of res.trimmed ?? []) if (r.hasPhoto) await photos.delete(r.id).catch(() => {});
  return json(201, { hazard: publicReport(report, user.id, now) });
}
