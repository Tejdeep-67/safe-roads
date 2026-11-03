// Leaflet with the marker icon paths fixed for Vite, plus the tile layers.
import L from 'leaflet';

// Fallback raster tiles: standard OpenStreetMap (keyless; their tile policy asks for
// attribution, a valid Referer and light use). The normal base map is BaseMap.tsx.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export const GUNTUR: [number, number] = [16.3067, 80.4365];

export default L;
