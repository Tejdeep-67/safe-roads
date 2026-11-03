// The base map. Vector tiles from OpenFreeMap (free, no key, OpenStreetMap data) drawn with
// MapLibre inside Leaflet: a clean Google-Maps-like look without the busy POI icons of the
// standard OSM tiles. Falls back to plain OSM raster tiles if WebGL is missing or the
// style can't load.
import { useEffect, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L, { TILE_ATTRIBUTION, TILE_URL } from './leaflet';

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function BaseMap({ dark }: { dark: boolean }) {
  const map = useMap();
  const [raster, setRaster] = useState(() => !hasWebGL());

  useEffect(() => {
    if (raster) return;
    let layer: L.Layer | null = null;
    let cancelled = false;
    Promise.all([import('@maplibre/maplibre-gl-leaflet'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(() => {
        if (cancelled) return;
        const gl = L.maplibreGL({ style: dark ? STYLES.dark : STYLES.light });
        gl.addTo(map);
        layer = gl;
        const ml = gl.getMaplibreMap();
        ml.on('error', (e) => {
          // a missing style or tile server problem: switch to raster tiles for this visit
          const status = (e as { error?: { status?: number } }).error?.status;
          if (!ml.isStyleLoaded() || (status && status >= 400)) setRaster(true);
        });
      })
      .catch(() => !cancelled && setRaster(true));
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, dark, raster]);

  return raster ? <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} className="map-tiles" /> : null;
}
