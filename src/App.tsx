import { useState, useEffect } from 'react';
import { User, X } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { Map } from './components/Map';
import { SearchBar } from './components/SearchBar';
import { DirectionsPanel } from './components/DirectionsPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { AuthModal } from './components/AuthModal';
import { Intro } from './components/Intro';
import { SearchResult, RouteInfo } from './types';

function App() {
  const { user, loading } = useAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<SearchResult | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [source, setSource] = useState<SearchResult | null>(null);
  const [destination, setDestination] = useState<SearchResult | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [authRequired, setAuthRequired] = useState(false);

  // Setup periodic refresh for new potholes
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handlePotholeUploaded = () => {
    // Immediately trigger refresh when a pothole is uploaded
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectLocation = (result: SearchResult) => {
    setSelectedLocation(result);
    setShowDirections(false);
    setDestination(null);
    setSource(null);
    setRoute(null);
  };

  const handleShowDirections = () => {
    if (selectedLocation) {
      setDestination(selectedLocation);
      setShowDirections(true);
    }
  };

  const handleStartNavigation = (sourceLocation: SearchResult, route: RouteInfo) => {
    setSource(sourceLocation);
    setRoute(route);
    setShowDirections(false);
  };

  const handleCloseDirections = () => {
    setShowDirections(false);
    setSelectedLocation(null);
  };

  const handleExitNavigation = () => {
    setSource(null);
    setShowDirections(false);
    setSelectedLocation(null);
    setDestination(null);
    setRoute(null);
  };

  const handleReportClick = () => {
    if (!user) {
      setAuthRequired(true);
      setShowAuth(true);
    } else {
      setShowProfile(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show intro on first load
  if (showIntro) {
    return <Intro onComplete={() => setShowIntro(false)} />;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Map
        destination={destination}
        source={source}
        route={route}
        onRouteUpdate={setRoute}
        refreshTrigger={refreshTrigger}
      />

      {!showDirections && !showProfile && (
        <SearchBar
          onSelectLocation={handleSelectLocation}
          onShowDirections={handleShowDirections}
          selectedLocation={selectedLocation}
        />
      )}

      {showDirections && destination && !showProfile && (
        <DirectionsPanel
          destination={destination}
          route={route}
          onClose={handleCloseDirections}
          onStartNavigation={handleStartNavigation}
          onExitNavigation={handleExitNavigation}
          isNavigating={source !== null}
        />
      )}

      {/* Exit Navigation Button - shown when actively navigating */}
      {source && !showProfile && (
        <button
          onClick={handleExitNavigation}
          className="absolute top-4 left-4 md:left-4 z-[999] bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Exit Navigation
        </button>
      )}

      {!showProfile && (
        <button
          onClick={handleReportClick}
          className="absolute top-4 right-4 md:right-4 z-[1000] bg-white w-12 h-12 rounded-full shadow-lg hover:bg-gray-50 flex items-center justify-center"
          title={user ? "Profile & Reports" : "Sign in to report potholes"}
        >
          <User className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {showProfile && user && <ProfilePanel onClose={() => setShowProfile(false)} onPotholeUploaded={handlePotholeUploaded} />}
      
      {showAuth && <AuthModal onClose={() => {
        setShowAuth(false);
        if (authRequired) {
          setAuthRequired(false);
        }
      }} />}
    </div>
  );
}

export default App;
