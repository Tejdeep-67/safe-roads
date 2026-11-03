// Keyless public map services, used lightly and politely:
//  - Photon (komoot, OpenStreetMap data) for search-as-you-type suggestions. It is built
//    for autocomplete; we still debounce (350 ms), need 3+ characters, cancel stale
//    requests and cache answers.
//  - Nominatim (OSM) only when you press Enter and Photon found nothing, and for
//    reverse lookups. Its policy: max 1 request/second, no autocomplete, attribution.
//    Requests are spaced 1.1 s apart and cached. (Browsers don't let pages set
//    User-Agent; the Referer header identifies the site.)
//  - OSRM demo server for driving routes, fair use only.
import type { LatLng } from './geo';

export interface Place {
  label: string; // short name, e.g. "Brodipet"
  detail?: string; // second line, e.g. "Guntur, Andhra Pradesh"
  lat: number;
  lng: number;
}

export interface RouteResult {
  coords: LatLng[];
  distance: number; // metres
  duration: number; // seconds
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cache = new Map<string, Place[]>();

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function photonPlace(f: PhotonFeature): Place {
  const p = f.properties;
  const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || p.county || 'Unnamed place';
  const detail = [p.name && p.street ? p.street : null, p.district, p.city !== name ? p.city : null, p.state]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .join(', ');
  return { label: name, detail, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
}

export async function suggestPlaces(query: string, near: LatLng | null, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = `p|${q.toLowerCase()}|${near ? near.map((n) => n.toFixed(1)).join(',') : ''}`;
  if (cache.has(key)) return cache.get(key)!;
  const params = new URLSearchParams({ q, limit: '6', lang: 'en' });
  if (near) {
    params.set('lat', near[0].toFixed(4));
    params.set('lon', near[1].toFixed(4));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  // the app is about Indian roads, so Indian results first
  const feats = [...data.features].sort(
    (a, b) => Number(b.properties.countrycode === 'IN') - Number(a.properties.countrycode === 'IN'),
  );
  const seen = new Set<string>();
  const places = feats.map(photonPlace).filter((p) => {
    const k = `${p.label}|${p.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  cache.set(key, places);
  return places;
}

let lastNominatim = 0;
async function nominatim(path: string, params: URLSearchParams, signal?: AbortSignal) {
  const gap = Date.now() - lastNominatim;
  if (gap < 1100) await wait(1100 - gap);
  lastNominatim = Date.now();
  params.set('format', 'jsonv2');
  params.set('accept-language', 'en');
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}?${params}`, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'Search is busy, wait a few seconds and try again.' : `Search failed (${res.status})`);
  return res.json();
}

// full search, used when you press Enter
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = `n|${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;
  const data = (await nominatim('search', new URLSearchParams({ q, limit: '6', countrycodes: 'in' }), signal)) as {
    name?: string;
    display_name: string;
    lat: string;
    lon: string;
  }[];
  const places = data.map((d) => {
    const parts = d.display_name.split(', ');
    return { label: d.name || parts[0], detail: parts.slice(1, 4).join(', '), lat: Number(d.lat), lng: Number(d.lon) };
  });
  cache.set(key, places);
  return places;
}

const reverseCache = new Map<string, string>();
export async function reverseLabel(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (reverseCache.has(key)) return reverseCache.get(key)!;
  try {
    const d = (await nominatim('reverse', new URLSearchParams({ lat: String(lat), lon: String(lng), zoom: '17' }))) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = d.address || {};
    const label =
      [a.road, a.suburb || a.neighbourhood || a.village, a.city || a.town || a.county].filter(Boolean).slice(0, 2).join(', ') ||
      d.display_name?.split(', ').slice(0, 2).join(', ') ||
      key;
    reverseCache.set(key, label);
    return label;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// up to 3 driving routes (OSRM gives alternatives when there are sensible ones)
export async function getRoutes(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteResult[]> {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true`;
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error("Couldn't reach the routing service. Check your connection.");
  }
  if (!res.ok) throw new Error(res.status === 429 ? 'Routing is busy, try again in a moment.' : `Routing failed (${res.status})`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No driving route found between these places.');
  return (data.routes as { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[])
    .slice(0, 3)
    .map((r) => ({
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      distance: r.distance,
      duration: r.duration,
    }));
}

export function formatDuration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}
