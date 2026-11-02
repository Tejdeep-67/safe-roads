import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from './plugins';
import type { Hazard } from '../hazards/types';
import { SEVERITY_COLOR } from '../detection/draw';

const RANK = { low: 0, medium: 1, high: 2 } as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function hazardIcon(h: Pick<Hazard, 'severity' | 'origin'>) {
  return L.divIcon({
    className: '',
    html: `<div class="hz-pin ${h.origin === 'sample' ? 'sample' : ''}" style="color:${SEVERITY_COLOR[h.severity]}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  });
}

export function popupHtml(h: Hazard) {
  const when = new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const origin = h.origin === 'sample' ? 'Sample data' : h.origin === 'shared' ? 'Shared report' : 'Saved on this device';
  return `<div style="min-width:180px">
    ${h.thumb ? `<img src="${h.thumb}" alt="" style="width:100%;border-radius:8px;margin-bottom:8px"/>` : ''}
    <div style="display:flex;align-items:center;gap:6px;font-weight:600;color:#fff">
      <span style="width:8px;height:8px;border-radius:9px;background:${SEVERITY_COLOR[h.severity]}"></span>
      ${h.severity[0].toUpperCase() + h.severity.slice(1)} severity pothole
    </div>
    ${h.note ? `<div style="margin-top:4px;color:#d4d4d8">${esc(h.note)}</div>` : ''}
    <div style="margin-top:6px;color:#8b8f98;font-size:12px">${origin} · ${when}<br/>
    ${h.confidence != null ? `Model confidence ${Math.round(h.confidence * 100)}% · ` : ''}${h.source} · ${h.confirmations} report${h.confirmations > 1 ? 's' : ''}</div>
  </div>`;
}

interface Props {
  hazards: Hazard[];
  view: 'markers' | 'heat';
  selectedId?: string | null;
  fitOnFirst?: boolean;
}

export default function HazardLayer({ hazards, view, selectedId, fitOnFirst = true }: Props) {
  const map = useMap();
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const heat = useRef<L.Layer | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const fitted = useRef(false);

  useEffect(() => {
    cluster.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => {
        const children = c.getAllChildMarkers() as (L.Marker & { _sev?: Hazard['severity'] })[];
        const worst = children.reduce<Hazard['severity']>((w, m) => (m._sev && RANK[m._sev] > RANK[w] ? m._sev : w), 'low');
        const n = c.getChildCount();
        const size = n < 10 ? 34 : n < 50 ? 40 : 48;
        return L.divIcon({
          className: '',
          html: `<div class="hz-cluster" style="width:${size}px;height:${size}px;background:${SEVERITY_COLOR[worst]}">${n}</div>`,
          iconSize: [size, size],
        });
      },
    });
    return () => {
      cluster.current?.remove();
      heat.current?.remove();
    };
  }, []);

  useEffect(() => {
    const group = cluster.current!;
    group.clearLayers();
    markers.current.clear();
    heat.current?.remove();
    heat.current = null;

    if (view === 'markers') {
      const list = hazards.map((h) => {
        const m = L.marker([h.lat, h.lng], { icon: hazardIcon(h), keyboard: true, title: `${h.severity} pothole` }) as L.Marker & { _sev?: Hazard['severity'] };
        m._sev = h.severity;
        m.bindPopup(popupHtml(h));
        markers.current.set(h.id, m);
        return m;
      });
      group.addLayers(list);
      if (!map.hasLayer(group)) group.addTo(map);
    } else {
      group.remove();
      const w = { low: 0.45, medium: 0.7, high: 1 };
      heat.current = (L as unknown as { heatLayer: (p: [number, number, number][], o: object) => L.Layer })
        .heatLayer(
          hazards.map((h) => [h.lat, h.lng, w[h.severity]]),
          { radius: 26, blur: 20, maxZoom: 15, minOpacity: 0.35, gradient: { 0.3: '#facc15', 0.6: '#fb923c', 1: '#f43f5e' } },
        )
        .addTo(map);
    }

    if (fitOnFirst && !fitted.current && hazards.length) {
      fitted.current = true;
      map.fitBounds(L.latLngBounds(hazards.map((h) => [h.lat, h.lng])), { padding: [40, 40], maxZoom: 14 });
    }
  }, [hazards, view, map, fitOnFirst]);

  useEffect(() => {
    if (!selectedId) return;
    const m = markers.current.get(selectedId);
    if (m && cluster.current) cluster.current.zoomToShowLayer(m, () => m.openPopup());
  }, [selectedId]);

  return null;
}
