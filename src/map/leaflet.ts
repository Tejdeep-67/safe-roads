// Leaflet plugins (markercluster, heat) expect a global `L`, so set it up once here
// and import Leaflet from this file everywhere.
import L from 'leaflet';

(window as unknown as { L: typeof L }).L = L;

// Standard OpenStreetMap tiles (no API key). They are made dark with a CSS filter on
// the tile pane (see .leaflet-tile-pane in index.css) so they match the app.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const GUNTUR: [number, number] = [16.3067, 80.4365];

export default L;
