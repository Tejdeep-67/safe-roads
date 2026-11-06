// Optional layer: speed bumps and humps that mapmakers recorded in OpenStreetMap, for the part of
// the map you are looking at. Real data from the public Overpass API, shown as small grey squares
// so nobody mistakes them for community reports.
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchRoadFeatures, kindText, MIN_ZOOM, type RoadFeature } from '../lib/overpass';

interface Props {
  enabled: boolean;
  onStatus: (s: 'idle' | 'zoom' | 'loading' | 'ok' | 'error', count?: number) => void;
}

const icon = L.divIcon({ className: 'osm-feature', html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7] });

export default function RoadFeatures({ enabled, onStatus }: Props) {
  const map = useMap();
  const layer = useRef<L.LayerGroup | null>(null);
  const status = useRef(onStatus);
  status.current = onStatus;

  useEffect(() => {
    if (!enabled) {
      status.current('idle');
      return;
    }
    const g = L.layerGroup().addTo(map);
    layer.current = g;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const draw = (list: RoadFeature[]) => {
      g.clearLayers();
      for (const f of list) {
        const m = L.marker([f.lat, f.lng], { icon, keyboard: false, riseOnHover: true, title: kindText[f.kind] });
        const link = `https://www.openstreetmap.org/node/${f.id}`;
        m.bindPopup(
          `<strong>${kindText[f.kind]}</strong><br><span style="font-size:12px">From OpenStreetMap${f.name ? ` · ${f.name.replace(/[<>&"]/g, '')}` : ''}</span><br><a href="${link}" target="_blank" rel="noopener noreferrer" style="font-size:12px">See on OpenStreetMap</a>`,
        );
        g.addLayer(m);
      }
    };

    const load = async () => {
      if (map.getZoom() < MIN_ZOOM) {
        seq++;
        g.clearLayers();
        status.current('zoom');
        return;
      }
      const mine = ++seq;
      const b = map.getBounds();
      status.current('loading');
      try {
        const list = await fetchRoadFeatures({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
        if (mine !== seq) return; // the map moved on while this was loading
        draw(list);
        status.current('ok', list.length);
      } catch {
        if (mine === seq) status.current('error');
      }
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 700);
    };
    map.on('moveend', soon);
    load();
    return () => {
      clearTimeout(timer);
      seq++; // anything still in flight is stale now
      map.off('moveend', soon);
      map.removeLayer(g);
      layer.current = null;
    };
  }, [map, enabled]);

  return null;
}
