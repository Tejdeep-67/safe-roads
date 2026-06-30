import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { SearchResult } from '../types';

interface SearchBarProps {
  onSelectLocation: (result: SearchResult) => void;
  onShowDirections: () => void;
  selectedLocation: SearchResult | null;
}

export function SearchBar({ onSelectLocation, onShowDirections, selectedLocation }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`
        );
        const data = await response.json();
        const formattedResults = data.features.map((feature: any) => ({
          place_id: feature.properties.osm_id,
          display_name: feature.properties.name + (feature.properties.city ? ', ' + feature.properties.city : '') + (feature.properties.country ? ', ' + feature.properties.country : ''),
          lat: feature.geometry.coordinates[1].toString(),
          lon: feature.geometry.coordinates[0].toString(),
          type: feature.properties.osm_key,
        }));
        setResults(formattedResults);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setQuery(result.display_name);
    setShowResults(false);
    onSelectLocation(result);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="absolute top-4 left-4 right-4 md:left-4 md:right-auto z-[1000] w-full md:w-96 max-w-md">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="flex items-center px-4 py-3 border-b">
          <Search className="w-5 h-5 text-gray-400 mr-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a location..."
            className="flex-1 outline-none text-gray-700"
          />
          {query && (
            <button onClick={handleClear} className="ml-2">
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.place_id}
                onClick={() => handleSelect(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
              >
                <p className="text-sm text-gray-900 font-medium">{result.display_name}</p>
                <p className="text-xs text-gray-500 mt-1">{result.type}</p>
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
        )}

        {selectedLocation && (
          <div className="p-3 border-t">
            <button
              onClick={onShowDirections}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Get Directions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
