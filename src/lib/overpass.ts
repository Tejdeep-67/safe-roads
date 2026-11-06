// Road features that mapmakers recorded in OpenStreetMap (speed bumps, humps, tables, cushions),
// fetched live from the public Overpass API for the part of the map you are looking at.
// This is real third-party data (ODbL licence, © OpenStreetMap contributors), not Safe Roads reports.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const MIN_ZOOM = 14;
export const MAX_FEATURES = 500;
export const CALMING = ['bump', 'hump', 'table', 'cushion'] as const;
export type Calming = (typeof CALMING)[number];

export interface RoadFeature {
  id: number;
  lat: number;
  lng: number;
  kind: Calming;
  name?: string;
}

export type Bounds = { south: number; west: number; north: number; east: number };

// snap the box outwards to a 0.01 degree grid (about 1 km): pans inside the same cell reuse the cached answer
export function snapBounds(b: Bounds): Bounds {
  const f = (v: number, up: boolean) => (up ? Math.ceil(v * 100) / 100 : Math.floor(v * 100) / 100);
  return { south: f(b.south, false), west: f(b.west, false), north: f(b.north, true), east: f(b.east, true) };
}
export const boundsKey = (b: Bounds) => [b.south, b.west, b.north, b.east].map((n) => n.toFixed(2)).join(',');

export function buildQuery(b: Bounds): string {
  const box = `${b.south},${b.west},${b.north},${b.east}`;
  return `[out:json][timeout:15];node["traffic_calming"~"^(${CALMING.join('|')})$"](${box});out body ${MAX_FEATURES};`;
}

interface OverpassJson {
  elements?: { type?: string; id?: number; lat?: number; lon?: number; tags?: Record<string, string> }[];
}

export function parseFeatures(data: unknown): RoadFeature[] {
  const els = (data as OverpassJson)?.elements;
  if (!Array.isArray(els)) return [];
  const out: RoadFeature[] = [];
  for (const e of els) {
    const kind = e.tags?.traffic_calming as Calming | undefined;
    if (e.type !== 'node' || !Number.isFinite(e.lat) || !Number.isFinite(e.lon) || typeof e.id !== 'number') continue;
    if (!kind || !CALMING.includes(kind)) continue;
    out.push({ id: e.id, lat: e.lat as number, lng: e.lon as number, kind, name: e.tags?.name?.slice(0, 60) });
  }
  return out;
}

export const kindText: Record<Calming, string> = { bump: 'Speed bump', hump: 'Speed hump', table: 'Raised table', cushion: 'Speed cushion' };

const cache = new Map<string, Promise<RoadFeature[]>>();
export function fetchRoadFeatures(b: Bounds, signal?: AbortSignal): Promise<RoadFeature[]> {
  const snapped = snapBounds(b);
  const key = boundsKey(snapped);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = fetch(OVERPASS_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(buildQuery(snapped)),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    signal,
  })
    .then((r) => {
      if (!r.ok) throw new Error(`overpass ${r.status}`);
      return r.json();
    })
    .then(parseFeatures);
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return p;
}
