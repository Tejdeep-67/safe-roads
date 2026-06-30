import { useState, useEffect, useRef } from 'react';
import { Navigation, X, MapPin, Target, Clock, Route } from 'lucide-react';
import { SearchResult, RouteInfo } from '../types';

interface DirectionsPanelProps {
  destination: SearchResult;
  onClose: () => void;
  onStartNavigation: (source: SearchResult, route: RouteInfo) => void;
  onExitNavigation?: () => void;
  isNavigating?: boolean;
}

export function DirectionsPanel({ destination, route, onClose, onStartNavigation, onExitNavigation, isNavigating }: DirectionsPanelProps) {
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceResults, setSourceResults] = useState<SearchResult[]>([]);
  const [selectedSource, setSelectedSource] = useState<SearchResult | null>(null);
  const [showResults, setShowResults] = useState(false);  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (sourceQuery.length < 3) {
      setSourceResults([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(sourceQuery)}&limit=5&lang=en`
        );
        const data = await response.json();
        const formattedResults = data.features.map((feature: any) => ({
          place_id: feature.properties.osm_id,
          display_name: feature.properties.name + (feature.properties.city ? ', ' + feature.properties.city : '') + (feature.properties.country ? ', ' + feature.properties.country : ''),
          lat: feature.geometry.coordinates[1].toString(),
          lon: feature.geometry.coordinates[0].toString(),
          type: feature.properties.osm_key,
        }));
        setSourceResults(formattedResults);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSourceResults([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [sourceQuery]);

  useEffect(() => {
    if (selectedSource) {
      fetchRoutes();
    } else {
      setRoutes([]);
      setSelectedRoute(null);
    }
  }, [selectedSource]);

  const fetchRoutes = async () => {
    if (!selectedSource) return;

    setLoadingRoutes(true);
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${selectedSource.lon},${selectedSource.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&alternatives=true`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeInfos: RouteInfo[] = data.routes.map((routeData: any) => ({
          distance: routeData.distance,
          duration: routeData.duration,
          coordinates: routeData.geometry.coordinates,
        }));
        setRoutes(routeInfos);
        setSelectedRoute(routeInfos[0]); // Default to first route
      }
    } catch (error) {
      console.error('Route fetch error:', error);
      setRoutes([]);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleSourceSelect = (result: SearchResult) => {
    setSourceQuery(result.display_name);
    setShowResults(false);
    setSelectedSource(result);
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const currentLocation: SearchResult = {
            place_id: 'current',
            display_name: 'Current Location',
            lat: latitude.toString(),
            lon: longitude.toString(),
            type: 'current',
          };
          setSourceQuery('Current Location');
          setSelectedSource(currentLocation);
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to get current location');
        }
      );
    }
  };

  const handleStart = () => {
    if (selectedSource && selectedRoute) {
      onStartNavigation(selectedSource, selectedRoute);
    }
  };

  const handleClose = () => {
    onClose();
  };

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
    <div className="absolute top-4 left-4 right-4 md:left-4 md:right-auto z-[1000] w-full md:w-96 max-w-md">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Directions</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Route Summary - Show when route exists */}
        {route && (
          <div className="px-4 py-3 bg-blue-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Route className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{formatDistance(route.distance)}</p>
                  <p className="text-xs text-gray-600">{formatDuration(route.duration)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          {!isNavigating && (
            <>
              <div className="relative">
                <div className="flex items-center px-3 py-2 border rounded-lg bg-gray-50">
                  <MapPin className="w-5 h-5 text-green-600 mr-2" />
                  <input
                    type="text"
                    value={sourceQuery}
                    onChange={(e) => setSourceQuery(e.target.value)}
                    placeholder="Choose starting point..."
                    className="flex-1 outline-none bg-transparent text-gray-700"
                  />
                </div>

                {showResults && sourceResults.length > 0 && (
                  <div className="absolute w-full mt-1 bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto z-10 border">
                    {sourceResults.map((result) => (
                      <button
                        key={result.place_id}
                        onClick={() => handleSourceSelect(result)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="text-sm text-gray-900">{result.display_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleUseCurrentLocation}
                className="w-full flex items-center justify-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border"
              >
                <Target className="w-4 h-4 mr-2" />
                Use Current Location
              </button>
            </>
          )}

          <div className="flex items-center px-3 py-2 border rounded-lg bg-gray-50">
            <MapPin className="w-5 h-5 text-red-600 mr-2" />
            <p className="flex-1 text-sm text-gray-700 truncate">{destination.display_name}</p>
          </div>

          {loadingRoutes && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Finding routes...</p>
            </div>
          )}

          {routes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Choose a route:</p>
              {routes.map((route, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedRoute(route)}
                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                    selectedRoute === route
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Route className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">
                        Route {index + 1} {index === 0 ? '(Recommended)' : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDistance(route.distance)}</p>
                      <p className="text-xs text-gray-500">{formatDuration(route.duration)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          {!isNavigating ? (
            <button
              onClick={handleStart}
              disabled={!selectedSource || !selectedRoute}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Start Navigation
            </button>
          ) : (
            <button
              onClick={onExitNavigation}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Exit Navigation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
