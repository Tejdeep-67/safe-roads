import L from 'leaflet';
import type { Severity } from '../detection/postprocess';
import type { Hazard } from '../hazards/types';
import { kindLabel } from '../hazards/kinds';

export const SEV_COLOR: Record<Severity, string> = { low: '#e0a800', medium: '#f26b1d', high: '#dc2f2f' };
export { kindLabel };
export const SEV_LABEL: Record<Severity, string> = { low: 'Minor', medium: 'Moderate', high: 'Severe' };
const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

const iconCache = new Map<string, L.DivIcon>();
export function hazardIcon(h: Pick<Hazard, 'severity' | 'status' | 'verified' | 'mine'>, selected = false) {
  const cls = ['hz-pin', h.status === 'resolved' ? 'fixed' : '', h.verified && h.status !== 'resolved' ? 'verified' : '', h.mine ? 'mine' : '', selected ? 'selected' : ''].filter(Boolean).join(' ');
  const key = `${h.severity}|${cls}`;
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: cls,
        html: `<span style="background:${SEV_COLOR[h.severity]}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    );
  }
  return iconCache.get(key)!;
}

// cluster bubble with a ring in the colour of the worst hazard inside it
export function clusterIcon(cluster: L.MarkerCluster) {
  const children = cluster.getAllChildMarkers() as (L.Marker & { options: { sev?: Severity } })[];
  let worst: Severity = 'low';
  for (const m of children) if (m.options.sev && RANK[m.options.sev] > RANK[worst]) worst = m.options.sev;
  const n = cluster.getChildCount();
  return L.divIcon({
    className: 'hz-cluster',
    html: `<div style="box-shadow:0 0 0 3px ${SEV_COLOR[worst]}, 0 2px 6px rgb(0 0 0 / .3)">${n}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

export const meIcon = L.divIcon({ className: 'me-dot', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] });

export const placeIcon = L.divIcon({
  className: 'place-pin',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39s13-13.4 13-23.5C28 7.4 22.2 1.5 15 1.5S2 7.4 2 15.5C2 25.6 15 39 15 39z" fill="#2557d6" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15.5" r="5" fill="#fff"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

export const startIcon = L.divIcon({
  className: 'place-pin',
  html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#fff;border:4px solid #1f2328;box-shadow:0 1px 4px rgb(0 0 0 / .35)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
