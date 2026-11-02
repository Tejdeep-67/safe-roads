// Keyless public services. Their usage policies ask for light use:
//  - Nominatim: max 1 request/second, no autocomplete-as-you-type, show attribution.
//  - OSRM demo server: fair use only.
// So searches only run when the user presses search, are queued 1.1 s apart and cached.
import type { LatLng } from './geo';

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  coords: LatLng[];
  distance: number; // metres
  duration: number; // seconds
}

let lastNominatim = 0;
const cache = new Map<string, Place[]>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const gap = Date.now() - lastNominatim;
  if (gap < 1100) await wait(1100 - gap);
  lastNominatim = Date.now();
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '5', countrycodes: 'in', 'accept-language': 'en' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'Search is busy, wait a few seconds and try again.' : `Search failed (${res.status})`);
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  const places = data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
  cache.set(key, places);
  return places;
}

export async function reverseLabel(lat: number, lng: number): Promise<string> {
  try {
    const gap = Date.now() - lastNominatim;
    if (gap < 1100) await wait(1100 - gap);
    lastNominatim = Date.now();
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '16', 'accept-language': 'en' });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
    const d = await res.json();
    return d.display_name ? String(d.display_name).split(',').slice(0, 3).join(',') : 'My location';
  } catch {
    return 'My location';
  }
}

export async function getRoute(from: Place, to: Place, signal?: AbortSignal): Promise<RouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found between these places.');
  const r = data.routes[0];
  return {
    coords: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as LatLng),
    distance: r.distance,
    duration: r.duration,
  };
}
