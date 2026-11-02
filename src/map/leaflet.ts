// Leaflet plugins (markercluster, heat) expect a global `L`, so set it up once here
// and import Leaflet from this file everywhere.
import L from 'leaflet';

(window as unknown as { L: typeof L }).L = L;

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const GUNTUR: [number, number] = [16.3067, 80.4365];

export default L;
