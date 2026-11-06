// Open data feed and statistics for councils, road authorities, researchers and apps.
//   GET /api/feed/geojson   GeoJSON FeatureCollection
//   GET /api/feed/csv       the same rows as CSV
//   GET /api/feed/json      plain JSON list (for people who don't want GeoJSON)
//   GET /api/stats          counts, weekly trend and hotspots (JSON)
//
// Query: bbox=minLng,minLat,maxLng,maxLat  type=pothole,waterlogging  severity=high
//        status=open|resolved|stale|all (default open)  verified=1  since=2026-01-01 (ISO date)  limit=1..5000
//
// Privacy: no names, no user ids, no free-text notes, no photo links and no raw votes are in
// the feed; only where the hazard is, what it is, how it was reported and how much the
// community agrees. Hidden (flagged) reports are never included.
import { createHash } from 'node:crypto';
import { json, rateLimit } from './http.mjs';
import { SEVERITIES, TYPES, deriveState, inBbox, isHidden, tilesFor } from './hazards-core.mjs';
import { readReports } from './tiles.mjs';

export const FEED_LIMIT = { max: 120, windowMs: 5 * 60 * 1000 }; // per IP, a cached feed is cheap but not free
export const DEFAULT_LIMIT = 1000;
export const MAX_LIMIT = 5000;
export const LICENSE = {
  name: 'CC BY 4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Safe Roads community reports (thesaferoads.netlify.app)',
};
export const COLUMNS = [
  'id', 'lat', 'lng', 'type', 'severity', 'status', 'verified', 'confirmations', 'fixed_votes',
  'potholes_detected', 'reported_via', 'created_at', 'updated_at',
];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-expose-headers': 'etag, x-total-count',
  'cross-origin-resource-policy': 'cross-origin',
};

// "pothole,waterlogging" -> checked list, or an error
function pickList(text, allowed, name) {
  if (!text) return { list: null };
  const list = text.split(',').map((s) => s.trim()).filter(Boolean);
  const bad = list.find((x) => !allowed.includes(x));
  if (bad) return { error: `${name} must be one of ${allowed.join(', ')}` };
  return { list };
}

export function parseFilters(url) {
  const q = url.searchParams;
  const t = tilesFor(q.get('bbox'));
  if (t.error) return { error: t.error };
  const type = pickList(q.get('type'), TYPES, 'type');
  if (type.error) return { error: type.error };
  const sev = pickList(q.get('severity'), SEVERITIES, 'severity');
  if (sev.error) return { error: sev.error };
  const status = q.get('status') || 'open';
  if (!['open', 'resolved', 'stale', 'all'].includes(status)) return { error: 'status must be open, resolved, stale or all' };
  let since = null;
  if (q.get('since')) {
    since = Date.parse(q.get('since'));
    if (!Number.isFinite(since)) return { error: 'since must be a date like 2026-01-31' };
  }
  let limit = DEFAULT_LIMIT;
  if (q.get('limit')) {
    limit = Number(q.get('limit'));
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { error: `limit must be 1..${MAX_LIMIT}` };
  }
  return {
    filters: { keys: t.keys, bbox: t.bbox, types: type.list, severities: sev.list, status, verified: q.get('verified') === '1', since, limit },
  };
}

// public, privacy-reduced row for one report
export function feedRow(r, now = Date.now()) {
  const d = deriveState(r, now);
  return {
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    type: r.type ?? 'pothole',
    severity: r.severity,
    status: d.stale ? 'stale' : d.status,
    verified: d.verified,
    confirmations: d.confirmations,
    fixed_votes: d.fixedVotes,
    potholes_detected: r.potholes ?? 0,
    reported_via: r.source === 'manual' ? 'manual' : 'ai_detection',
    // minute precision is plenty
    created_at: new Date(Math.floor(Date.parse(r.createdAt) / 60000) * 60000).toISOString(),
    updated_at: new Date(Math.floor(Date.parse(r.updatedAt || r.createdAt) / 60000) * 60000).toISOString(),
  };
}

export function selectRows(reports, f, now = Date.now()) {
  return reports
    .filter((r) => !isHidden(r, now) && inBbox(r, f.bbox))
    .map((r) => feedRow(r, now))
    .filter((row) => (f.status === 'all' ? true : row.status === f.status))
    .filter((row) => !f.types || f.types.includes(row.type))
    .filter((row) => !f.severities || f.severities.includes(row.severity))
    .filter((row) => !f.verified || row.verified)
    .filter((row) => f.since === null || Date.parse(row.updated_at) >= f.since)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

// CSV cells that start with = + - @ would be run as formulas by spreadsheets
export function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows) => [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';

export function toGeoJson(rows, meta = {}) {
  return {
    type: 'FeatureCollection',
    license: LICENSE,
    generated_at: meta.generatedAt,
    count: rows.length,
    truncated: Boolean(meta.truncated),
    features: rows.map(({ lat, lng, ...props }) => ({
      type: 'Feature',
      id: props.id,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: props,
    })),
  };
}

const etagOf = (text) => `"${createHash('sha1').update(text).digest('hex').slice(0, 16)}"`;

function cached(req, body, headers) {
  const etag = etagOf(body);
  const h = { ...CORS, ...headers, etag, 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120' };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: h });
  return new Response(body, { status: 200, headers: h });
}

async function guard(req, deps) {
  const { limits, ip, now = Date.now() } = deps;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'access-control-max-age': '86400' } });
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Read-only: use GET.' }, { allow: 'GET, HEAD, OPTIONS', ...CORS });
  const rl = await rateLimit(limits, 'feed', ip, FEED_LIMIT, now);
  if (!rl.ok) return json(429, { error: 'Too many requests. The feed is cached for a minute, please poll less often.' }, { 'retry-after': String(rl.retryAfter), ...CORS });
  return null;
}

// deps: { store, photos, limits, ip, now, format }
export async function handleFeed(req, deps) {
  const { store, photos, now = Date.now(), format } = deps;
  const blocked = await guard(req, deps);
  if (blocked) return blocked;
  if (!['geojson', 'csv', 'json'].includes(format)) return json(404, { error: 'Formats: geojson, csv, json.' }, CORS);
  const parsed = parseFilters(new URL(req.url));
  if (parsed.error) return json(400, { error: parsed.error }, CORS);
  const f = parsed.filters;
  const all = selectRows(await readReports(store, f.keys, photos), f, now);
  const rows = all.slice(0, f.limit);
  const truncated = all.length > rows.length;
  const extra = { 'x-total-count': String(all.length) };
  if (format === 'csv') {
    return cached(req, toCsv(rows), { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="safe-roads-hazards.csv"', ...extra });
  }
  // generated_at is the newest report time, not "now": same data gives the same bytes, so ETags and CDN caching work
  const generatedAt = rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), '1970-01-01T00:00:00.000Z');
  if (format === 'json') {
    return cached(req, JSON.stringify({ license: LICENSE, generated_at: generatedAt, count: rows.length, truncated, hazards: rows }), { 'content-type': 'application/json; charset=utf-8', ...extra });
  }
  return cached(req, JSON.stringify(toGeoJson(rows, { generatedAt, truncated })), {
    'content-type': 'application/geo+json; charset=utf-8',
    'content-disposition': 'inline; filename="safe-roads-hazards.geojson"',
    ...extra,
  });
}

// ---------- statistics ----------
export const HOTSPOT_CELL_DEG = 0.005; // about 550 m
export const HOTSPOT_MIN = 2;

export function computeStats(reports, f, now = Date.now()) {
  const rows = selectRows(reports, { ...f, status: 'all', types: f.types, severities: f.severities, verified: false, since: f.since }, now);
  const by = (key, keys) => Object.fromEntries(keys.map((k) => [k, rows.filter((r) => r[key] === k).length]));
  const weekMs = 7 * 86400000;
  const weeks = [];
  const monday = 4 * 86400000; // the epoch was a Thursday; shift so weeks run Monday to Sunday (UTC)
  const startOfWeek = Math.floor((now - monday) / weekMs) * weekMs + monday;
  for (let i = 11; i >= 0; i--) {
    const from = startOfWeek - i * weekMs;
    weeks.push({
      week_start: new Date(from).toISOString().slice(0, 10),
      reported: rows.filter((r) => Date.parse(r.created_at) >= from && Date.parse(r.created_at) < from + weekMs).length,
    });
  }
  const cells = new Map();
  for (const r of rows.filter((x) => x.status === 'open')) {
    const key = `${Math.floor(r.lat / HOTSPOT_CELL_DEG)}_${Math.floor(r.lng / HOTSPOT_CELL_DEG)}`;
    const c = cells.get(key) ?? { n: 0, lat: 0, lng: 0, high: 0, verified: 0 };
    c.n++;
    c.lat += r.lat;
    c.lng += r.lng;
    if (r.severity === 'high') c.high++;
    if (r.verified) c.verified++;
    cells.set(key, c);
  }
  const hotspots = [...cells.values()]
    .filter((c) => c.n >= HOTSPOT_MIN)
    .sort((a, b) => b.n - a.n || b.high - a.high)
    .slice(0, 20)
    .map((c) => ({ lat: Math.round((c.lat / c.n) * 1e4) / 1e4, lng: Math.round((c.lng / c.n) * 1e4) / 1e4, open_reports: c.n, high_severity: c.high, verified: c.verified }));
  const resolved = rows.filter((r) => r.status === 'resolved');
  return {
    total: rows.length,
    verified: rows.filter((r) => r.verified).length,
    by_status: by('status', ['open', 'resolved', 'stale']),
    by_type: by('type', TYPES),
    by_severity: by('severity', SEVERITIES),
    resolved_share: rows.length ? Math.round((resolved.length / rows.length) * 1000) / 10 : null,
    weekly: weeks,
    hotspots,
    hotspot_rule: `open reports within the same ${HOTSPOT_CELL_DEG}° grid cell (about 550 m), at least ${HOTSPOT_MIN}`,
  };
}

export async function handleStats(req, deps) {
  const { store, photos, now = Date.now() } = deps;
  const blocked = await guard(req, deps);
  if (blocked) return blocked;
  const parsed = parseFilters(new URL(req.url));
  if (parsed.error) return json(400, { error: parsed.error }, CORS);
  const reports = await readReports(store, parsed.filters.keys, photos);
  const body = JSON.stringify({ license: LICENSE, ...computeStats(reports, parsed.filters, now) });
  return cached(req, body, { 'content-type': 'application/json; charset=utf-8' });
}
