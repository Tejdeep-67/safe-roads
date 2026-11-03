// Hazard pins, clustered when zoomed out. Plain Leaflet inside react-leaflet so a few
// hundred markers stay cheap to redraw.
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from './plugins';
import type { Hazard } from '../hazards/types';
import { clusterIcon, hazardIcon, SEV_LABEL } from './markers';

interface Props {
  hazards: Hazard[];
  selectedId: string | null;
  onSelect: (h: Hazard) => void;
}

export default function HazardPins({ hazards, selectedId, onSelect }: Props) {
  const map = useMap();
  const group = useRef<L.MarkerClusterGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const g = L.markerClusterGroup({
      iconCreateFunction: clusterIcon,
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
    });
    map.addLayer(g);
    group.current = g;
    return () => {
      map.removeLayer(g);
      group.current = null;
    };
  }, [map]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    const markers = hazards.map((h) => {
      const m = L.marker([h.lat, h.lng], {
        icon: hazardIcon(h, h.id === selectedId),
        keyboard: true,
        title: `${SEV_LABEL[h.severity]} pothole${h.origin === 'sample' ? ' (sample)' : ''}`,
        alt: `${SEV_LABEL[h.severity]} pothole`,
        riseOnHover: true,
        zIndexOffset: h.id === selectedId ? 1000 : 0,
        // read by the cluster icon to colour the ring
        sev: h.severity,
      } as L.MarkerOptions);
      m.on('click', () => onSelectRef.current(h));
      return m;
    });
    g.addLayers(markers);
  }, [hazards, selectedId]);

  return null;
}
