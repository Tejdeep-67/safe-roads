// Reports are stored in map tiles instead of one big list: every report goes into the blob of
// the 0.1 x 0.1 degree square (about 11 km, roughly one city) it lies in. That keeps each
// write small, lets a viewport / city query read only a few blobs, and means two people
// reporting in different cities never fight over the same etag.
//
//   t/<latIndex>_<lngIndex>  ->  [ report, report, ... ]
//
// A report id is "<latIndex>_<lngIndex>.<uuid>", so any id tells us which tile to open.
import { randomUUID } from 'node:crypto';

export const TILE_DEG = 0.1;
export const TILE_PREFIX = 't/';
export const MAX_PER_TILE = 1500;
export const MAX_TILES_PER_QUERY = 400;
const LEGACY_KEY = 'reports';
const ID_RE = /^(\d{1,5})_(\d{1,5})\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const tileIndex = (lat, lng) => [Math.floor((lat + 90) / TILE_DEG + 1e-9), Math.floor((lng + 180) / TILE_DEG + 1e-9)];
export const tileKeyFor = (lat, lng) => {
  const [a, b] = tileIndex(lat, lng);
  return `${TILE_PREFIX}${a}_${b}`;
};
export const newReportId = (lat, lng) => {
  const [a, b] = tileIndex(lat, lng);
  return `${a}_${b}.${randomUUID()}`;
};
export const isReportId = (id) => typeof id === 'string' && ID_RE.test(id);
export const tileKeyOfId = (id) => {
  const m = ID_RE.exec(id || '');
  return m ? `${TILE_PREFIX}${m[1]}_${m[2]}` : null;
};

// tile keys that overlap a bbox [minLng, minLat, maxLng, maxLat]
export function tileKeysForBbox([minLng, minLat, maxLng, maxLat]) {
  const [a0, b0] = tileIndex(minLat, minLng);
  const [a1, b1] = tileIndex(maxLat, maxLng);
  const keys = [];
  for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) keys.push(`${TILE_PREFIX}${a}_${b}`);
  return keys;
}

export async function listTileKeys(store) {
  const keys = [];
  let res = await store.list({ prefix: TILE_PREFIX });
  for (const b of res.blobs ?? []) keys.push(b.key);
  return keys;
}

async function readTile(store, key) {
  const res = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
  return { reports: Array.isArray(res?.data) ? res.data : [], etag: res?.etag, exists: Boolean(res) };
}

// all reports in the given tiles (or every tile when keys is null)
export async function readReports(store, keys = null, photos = null) {
  await migrateLegacy(store, photos);
  const wanted = keys ?? (await listTileKeys(store));
  const chunks = [];
  for (let i = 0; i < wanted.length; i += 20) {
    const part = await Promise.all(wanted.slice(i, i + 20).map((k) => readTile(store, k).then((t) => t.reports)));
    chunks.push(...part);
  }
  return chunks.flat();
}

// read-modify-write one tile with the etag, retried when someone else wrote in between.
// fn(reports) -> { write: false, ...x } or { reports: [...], ...x }
export async function updateTile(store, key, fn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { reports, etag, exists } = await readTile(store, key);
    const result = fn(reports);
    if (result.write === false) return result;
    // the local `netlify dev` blob server doesn't send etags on reads; there we can only
    // write unconditionally (production always has them)
    const opts = etag ? { onlyIfMatch: etag } : exists ? {} : { onlyIfNew: true };
    const res = await store.setJSON(key, result.reports ?? reports, opts);
    if (res?.modified !== false) return result;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  return { busy: true };
}

// Version 3 of the app kept every report in one blob called "reports". The first read after
// this version moves them into tiles (and re-keys their photos) and then deletes the old blob.
export async function migrateLegacy(store, photos) {
  let legacy;
  try {
    if (!(await store.getMetadata(LEGACY_KEY))) return 0;
    legacy = await store.get(LEGACY_KEY, { type: 'json', consistency: 'strong' });
  } catch {
    return 0;
  }
  if (!Array.isArray(legacy)) return 0;
  const byTile = new Map();
  const renames = [];
  for (const r of legacy) {
    if (!r || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const oldId = r.id;
    const next = { ...r, id: isReportId(oldId) ? oldId : newReportId(r.lat, r.lng), type: r.type || 'pothole', status: 'open' };
    if (next.id !== oldId) renames.push([oldId, next.id]);
    const key = tileKeyFor(r.lat, r.lng);
    if (!byTile.has(key)) byTile.set(key, []);
    byTile.get(key).push(next);
  }
  for (const [key, list] of byTile) {
    await updateTile(store, key, (cur) => ({ reports: [...cur.filter((c) => !list.some((l) => l.id === c.id)), ...list] }));
  }
  if (photos) {
    for (const [from, to] of renames) {
      const data = await photos.get(from, { type: 'arrayBuffer' }).catch(() => null);
      if (data) {
        await photos.set(to, data, { metadata: { contentType: 'image/jpeg' } });
        await photos.delete(from).catch(() => {});
      }
    }
  }
  await store.delete(LEGACY_KEY);
  return legacy.length;
}
