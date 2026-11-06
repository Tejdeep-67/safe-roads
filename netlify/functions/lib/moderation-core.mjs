// Moderator tools.
//   GET  /api/moderation          -> reports that people flagged, plus hidden ones (moderators only)
//   POST /api/moderation/:id      -> { action: 'approve' | 'remove' | 'resolve' | 'reopen', note? }
//
// A moderator is a signed-in user whose (lower-cased) email is in the MODERATOR_EMAILS
// environment variable, comma separated. Nobody becomes a moderator through the app itself.
import { json, readJsonBody, rateLimit, sameOrigin } from './http.mjs';
import { counts, deriveState, publicReport } from './hazards-core.mjs';
import { listTileKeys, readReports, tileKeyOfId, updateTile } from './tiles.mjs';

export const MOD_LIMIT = { max: 200, windowMs: 10 * 60 * 1000 };
const ACTIONS = ['approve', 'remove', 'resolve', 'reopen'];

export const moderatorSet = (text) =>
  new Set(String(text || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isModerator = (user, mods) => Boolean(user?.email && mods?.has(String(user.email).trim().toLowerCase()));

function queueItem(r, now) {
  const reasons = {};
  for (const f of r.votes?.flag ?? []) reasons[f.r] = (reasons[f.r] ?? 0) + 1;
  const d = deriveState(r, now);
  return {
    ...publicReport(r, null, now),
    flags: counts(r).flags,
    reasons,
    hidden: d.hidden,
    reviewed: Boolean(r.reviewed),
    resolvedNote: r.resolvedNote ?? null,
  };
}

// deps: { store, photos, limits, user, mods, ip, now, id }
export async function handleModeration(req, deps) {
  const { store, photos, limits, user, mods, now = Date.now(), id } = deps;
  if (!user) return json(401, { error: 'Sign in first.' });
  if (!isModerator(user, mods)) return json(403, { error: 'Moderators only.' });
  const rl = await rateLimit(limits, 'moderation', user.id, MOD_LIMIT, now);
  if (!rl.ok) return json(429, { error: 'Too many actions, slow down.' }, { 'retry-after': String(rl.retryAfter) });

  if (req.method === 'GET') {
    const reports = await readReports(store, null, photos);
    const queue = reports
      .filter((r) => !r.reviewed && ((r.votes?.flag?.length ?? 0) > 0 || deriveState(r, now).hidden))
      .map((r) => queueItem(r, now))
      .sort((a, b) => Number(b.hidden) - Number(a.hidden) || b.flags - a.flags || b.createdAt.localeCompare(a.createdAt));
    return json(200, { queue, count: queue.length, tiles: (await listTileKeys(store)).length });
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { allow: 'GET, POST' });
  if (!sameOrigin(req)) return json(403, { error: 'Request blocked (wrong origin).' });
  const tile = tileKeyOfId(id);
  if (!tile) return json(404, { error: 'Report not found.' });
  const { body, error } = await readJsonBody(req, 2048);
  if (error) return json(400, { error: 'Invalid request.' });
  if (!ACTIONS.includes(body.action)) return json(400, { error: `action must be one of ${ACTIONS.join(', ')}` });
  const note = typeof body.note === 'string' ? body.note.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 140) : '';

  const res = await updateTile(store, tile, (reports) => {
    const i = reports.findIndex((r) => r.id === id);
    if (i < 0) return { write: false, missing: true };
    const r = reports[i];
    const stamp = new Date(now).toISOString();
    if (body.action === 'remove') {
      reports.splice(i, 1);
      return { reports, removed: r };
    }
    r.updatedAt = stamp;
    if (body.action === 'approve') {
      // looked at it and it is fine: flags no longer hide it
      r.reviewed = true;
      r.reviewedAt = stamp;
    } else if (body.action === 'resolve') {
      r.status = 'resolved';
      r.resolvedBy = 'moderator';
      r.resolvedAt = stamp;
      r.resolvedNote = note || null;
    } else if (body.action === 'reopen') {
      r.status = 'open';
      r.resolvedBy = null;
      r.resolvedNote = null;
      r.votes = { ...(r.votes ?? {}), fixed: [] };
    }
    return { reports, report: r };
  });
  if (res.busy) return json(409, { error: 'Busy, please retry.' });
  if (res.missing) return json(404, { error: 'Report not found.' });
  if (res.removed) {
    if (res.removed.hasPhoto) await photos.delete(id).catch(() => {});
    return json(200, { ok: true, removed: id });
  }
  return json(200, { ok: true, report: queueItem(res.report, now) });
}
