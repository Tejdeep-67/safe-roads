// Builds the URL of the open data feed from the choices on the /data page.
import type { HazardType } from '../hazards/types';
import { TYPE_ORDER } from '../hazards/kinds';

export type FeedFormat = 'geojson' | 'csv' | 'json';
export interface FeedQuery {
  types: HazardType[];
  severities: ('low' | 'medium' | 'high')[];
  status: 'open' | 'resolved' | 'all';
  verifiedOnly: boolean;
  since: string; // yyyy-mm-dd or ''
  bbox: string; // minLng,minLat,maxLng,maxLat or ''
}

export const DEFAULT_QUERY: FeedQuery = { types: [], severities: [], status: 'open', verifiedOnly: false, since: '', bbox: '' };

export function feedPath(format: FeedFormat, q: FeedQuery, limit?: number): string {
  const p = new URLSearchParams();
  if (q.bbox) p.set('bbox', q.bbox);
  if (q.types.length && q.types.length < TYPE_ORDER.length) p.set('type', q.types.join(','));
  if (q.severities.length && q.severities.length < 3) p.set('severity', q.severities.join(','));
  if (q.status !== 'open') p.set('status', q.status);
  if (q.verifiedOnly) p.set('verified', '1');
  if (q.since) p.set('since', q.since);
  if (limit) p.set('limit', String(limit));
  const qs = p.toString();
  // keep commas readable in the URL, they are valid in a query string
  return `/api/feed/${format}${qs ? `?${qs.replace(/%2C/g, ',')}` : ''}`;
}

// bbox text from the user: four numbers, returns '' if it is not valid
export function cleanBbox(text: string): string {
  const p = text.split(',').map((s) => Number(s.trim()));
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n) || (text.trim() === ''))) return '';
  const [a, b, c, d] = p;
  if (a > c || b > d || b < -90 || d > 90 || a < -180 || c > 180) return '';
  return p.join(',');
}
