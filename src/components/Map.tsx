import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Pothole, SearchResult, RouteInfo } from '../types';
import { potholeAPI } from '../lib/api';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Create dynamic pothole icons based on severity
const createPotholeIcon = (severity: 'low' | 'medium' | 'high' = 'medium') => {
  const severityColors = {
    low: { fill: '#fbbf24', stroke: '#b45309' }, // Amber
    medium: { fill: '#f97316', stroke: '#92400e' }, // Orange
    high: { fill: '#ef4444', stroke: '#7f1d1d' }, // Red
  };
  
  const color = severityColors[severity] || severityColors.medium;
  
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="40" height="48">
        <!-- Outer glow effect -->
        <circle cx="24" cy="24" r="22" fill="${color.fill}" opacity="0.2"/>
        <!-- Main circle -->
        <circle cx="24" cy="24" r="18" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/>
        <!-- Inner darker circle for depth -->
        <circle cx="24" cy="24" r="14" fill="${color.fill}" opacity="0.9"/>
        <!-- Exclamation mark -->
        <text x="24" y="30" font-size="22" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">!</text>
        <!-- Pointer at bottom -->
        <polygon points="24,40 18,56 30,56" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1"/>
      </svg>
    `),
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48],
    className: 'pothole-marker',
  });
};

const potholeIcon = createPotholeIcon('medium');

// Component to track zoom level
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };

    map.on('zoom', handleZoom);
    onZoomChange(map.getZoom()); // Initial zoom level
    return () => {
      map.off('zoom', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

const destinationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#1d4ed8" stroke="#1e3a8a" stroke-width="1.5"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  `),
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const sourceIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#16a34a" stroke="#15803d" stroke-width="1.5"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  `),
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

interface MapViewProps {
  destination: SearchResult | null;
  route: RouteInfo | null;
}

function MapView({ destination, route }: MapViewProps) {
  const map = useMap();

  useEffect(() => {
    if (destination) {
      map.setView([parseFloat(destination.lat), parseFloat(destination.lon)], 15);
    }
  }, [destination, map]);

  useEffect(() => {
    if (route && route.coordinates.length > 0) {
      const bounds = L.latLngBounds(route.coordinates.map(coord => [coord[1], coord[0]]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [route, map]);

  return null;
}

interface MapProps {
  destination: SearchResult | null;
  source: SearchResult | null;
  route: RouteInfo | null;
  onRouteUpdate: (route: RouteInfo | null) => void;
  refreshTrigger?: number;
}

export function Map({ destination, source, route, onRouteUpdate, refreshTrigger = 0 }: MapProps) {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(5);
  const mapRef = useRef<L.Map | null>(null);

  // Fetch all verified potholes so uploaded/verified potholes show on the map
  const fetchAllPotholes = async () => {
    try {
      const resp = await potholeAPI.getAllPotholes();
      if (resp.data && resp.data.potholes) {
        setPotholes(resp.data.potholes);
      }
    } catch (err) {
      console.error('Fetch all potholes error:', err);
    }
  };

  // Fetch potholes when refresh trigger changes (periodic refresh)
  useEffect(() => {
    if (!source || !destination) {
      fetchAllPotholes();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (source && destination) {
      fetchRoute();
    } else {
      onRouteUpdate(null);
      setPotholes([]);
      setWarningMessage(null);
    }
  }, [source, destination]);

  const fetchRoute = async () => {
    if (!source || !destination) return;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${source.lon},${source.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        const routeInfo: RouteInfo = {
          distance: routeData.distance,
          duration: routeData.duration,
          coordinates: routeData.geometry.coordinates,
        };
        onRouteUpdate(routeInfo);
        fetchPotholesOnRoute(routeInfo);
      }
    } catch (error) {
      console.error('Route fetch error:', error);
    }
  };

  const fetchPotholesOnRoute = async (routeInfo: RouteInfo) => {
    try {
      const response = await potholeAPI.getPothelesOnRoute(routeInfo.coordinates, 30);
      
      if (response.data.potholes) {
        setPotholes(response.data.potholes);
        setWarningMessage(response.data.warning);
      }
    } catch (error) {
      console.error('Pothole fetch error:', error);
      setPotholes([]);
      setWarningMessage(null);
    }
  };

  // Refresh route potholes periodically when actively navigating
  useEffect(() => {
    if (route) {
      fetchPotholesOnRoute(route);
    }
  }, [refreshTrigger, route]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} h ${remainingMinutes} min`;
  };

  return (
    <div className="relative w-full h-screen">
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        className="w-full h-full"
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapView
          destination={destination}
          route={route}
        />

        <ZoomTracker onZoomChange={setZoomLevel} />

        {source && (
          <Marker
            position={[parseFloat(source.lat), parseFloat(source.lon)]}
            icon={sourceIcon}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Starting Point</p>
                <p className="text-gray-600 text-xs mt-1">{source.display_name}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {destination && (
          <Marker
            position={[parseFloat(destination.lat), parseFloat(destination.lon)]}
            icon={destinationIcon}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Destination</p>
                <p className="text-gray-600 text-xs mt-1">{destination.display_name}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {route && (
          <Polyline
            positions={route.coordinates.map((coord) => [coord[1], coord[0]])}
            color="#2563eb"
            weight={5}
            opacity={0.7}
          />
        )}

        {route && zoomLevel >= 13 && potholes.map((pothole) => (
          <Marker
            key={pothole.id}
            position={[pothole.latitude, pothole.longitude]}
            icon={createPotholeIcon(pothole.severity)}
          >
            <Popup>
              <div className="text-sm w-48">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${
                    pothole.severity === 'high' ? 'bg-red-500' :
                    pothole.severity === 'medium' ? 'bg-orange-500' :
                    'bg-amber-500'
                  }`}></span>
                  <p className="font-semibold text-red-600">Pothole Alert</p>
                </div>
                
                <div className="bg-gray-50 p-2 rounded mb-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Severity:</span>
                    <span className={`text-xs font-bold uppercase ${
                      pothole.severity === 'high' ? 'text-red-600' :
                      pothole.severity === 'medium' ? 'text-orange-600' :
                      'text-amber-600'
                    }`}>{pothole.severity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Confidence:</span>
                    <span className="text-xs font-semibold text-gray-700">{(pothole.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Reports:</span>
                    <span className="text-xs font-semibold text-gray-700">{pothole.report_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Verified:</span>
                    <span className="text-xs font-semibold text-green-600">{pothole.verified ? '✓ Yes' : '✗ No'}</span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 border-t pt-2">
                  <p>{pothole.latitude.toFixed(6)}, {pothole.longitude.toFixed(6)}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute bottom-4 right-4 md:bottom-4 md:right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="bg-white w-10 h-10 md:w-10 md:h-10 rounded-lg shadow-lg hover:bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-700"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="bg-white w-10 h-10 md:w-10 md:h-10 rounded-lg shadow-lg hover:bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-700"
        >
          −
        </button>
      </div>

      {/* Pothole Legend - Only show when zoomed in */}
      {zoomLevel >= 13 && (
        <div className="absolute top-20 right-4 md:right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Severity Levels</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500 shadow-md"></div>
              <p className="text-xs text-gray-700">High (≥85%)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-orange-500 shadow-md"></div>
              <p className="text-xs text-gray-700">Medium (70-84%)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-amber-500 shadow-md"></div>
              <p className="text-xs text-gray-700">Low (&lt;70%)</p>
            </div>
          </div>
        </div>
      )}

      {warningMessage && (
        <div className="absolute top-4 left-4 md:left-4 z-[1000] bg-red-50 border-l-4 border-red-500 px-4 py-3 rounded-md shadow-lg max-w-xs md:max-w-sm">
          <p className="text-red-700 font-semibold text-sm">{warningMessage}</p>
        </div>
      )}

      {route && (
        <div className="absolute bottom-4 left-4 md:left-4 z-[1000] bg-white rounded-lg shadow-lg px-4 py-3 max-w-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-500">Distance</p>
              <p className="font-semibold text-gray-900">{formatDistance(route.distance)}</p>
            </div>
            <div className="border-l h-10 hidden md:block"></div>
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="font-semibold text-gray-900">{formatDuration(route.duration)}</p>
            </div>
            {potholes.length > 0 && (
              <>
                <div className="border-l h-10 hidden md:block"></div>
                <div>
                  <p className="text-xs text-gray-500">Potholes</p>
                  <p className="font-semibold text-red-600">{potholes.length}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

