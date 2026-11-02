// Distance helpers for the route alerts.
// For short distances (a few km) a flat "equirectangular" projection around the
// point is accurate to well under a metre, so point-to-segment distance can be done
// with normal 2D vector math instead of spherical formulas.

export type LatLng = [number, number];

const R = 6371000; // earth radius in metres
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// metres east/north of `origin`
export function toXY(p: LatLng, origin: LatLng): [number, number] {
  return [rad(p[1] - origin[1]) * R * Math.cos(rad(origin[0])), rad(p[0] - origin[0]) * R];
}

export interface SegmentHit {
  dist: number; // metres from the point to the segment
  t: number; // 0..1 position of the closest point along the segment
}

export function pointToSegment(p: LatLng, a: LatLng, b: LatLng): SegmentHit {
  const [px, py] = toXY(p, a);
  const [bx, by] = toXY(b, a);
  const len2 = bx * bx + by * by;
  let t = len2 === 0 ? 0 : (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return { dist: Math.hypot(px - t * bx, py - t * by), t };
}

// cumulative distance at every vertex of the route
export function cumulative(route: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) out.push(out[i - 1] + haversine(route[i - 1], route[i]));
  return out;
}

export interface RoutePosition {
  dist: number; // distance from the route
  along: number; // distance from the start of the route, measured along it
  segment: number;
}

export function locateOnRoute(p: LatLng, route: LatLng[], cum = cumulative(route)): RoutePosition {
  let best: RoutePosition = { dist: Infinity, along: 0, segment: 0 };
  for (let i = 0; i < route.length - 1; i++) {
    // cheap reject: skip segments clearly far away (~2 km in degrees)
    const a = route[i];
    const b = route[i + 1];
    if (
      Math.min(a[0], b[0]) - 0.02 > p[0] ||
      Math.max(a[0], b[0]) + 0.02 < p[0] ||
      Math.min(a[1], b[1]) - 0.02 > p[1] ||
      Math.max(a[1], b[1]) + 0.02 < p[1]
    )
      continue;
    const hit = pointToSegment(p, a, b);
    if (hit.dist < best.dist) {
      best = { dist: hit.dist, along: cum[i] + hit.t * (cum[i + 1] - cum[i]), segment: i };
    }
  }
  return best;
}

export interface NearHazard<T> {
  item: T;
  dist: number;
  along: number;
}

export function hazardsNearRoute<T extends { lat: number; lng: number }>(
  route: LatLng[],
  items: T[],
  buffer = 30,
): NearHazard<T>[] {
  if (route.length < 2) return [];
  const cum = cumulative(route);
  const out: NearHazard<T>[] = [];
  for (const item of items) {
    const pos = locateOnRoute([item.lat, item.lng], route, cum);
    if (pos.dist <= buffer) out.push({ item, dist: pos.dist, along: pos.along });
  }
  return out.sort((a, b) => a.along - b.along);
}

// point at a given distance along the route (used by the drive simulator)
export function pointAlong(route: LatLng[], along: number, cum = cumulative(route)): LatLng {
  if (along <= 0) return route[0];
  for (let i = 1; i < route.length; i++) {
    if (cum[i] >= along) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (along - cum[i - 1]) / seg;
      return [route[i - 1][0] + t * (route[i][0] - route[i - 1][0]), route[i - 1][1] + t * (route[i][1] - route[i - 1][1])];
    }
  }
  return route[route.length - 1];
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}
