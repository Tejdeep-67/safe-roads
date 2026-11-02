import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Toaster from './components/Toaster';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

// heavier pages are split out so the landing page loads fast
const Detect = lazy(() => import('./pages/Detect'));
const HazardMap = lazy(() => import('./pages/HazardMap'));
const RoutePlanner = lazy(() => import('./pages/RoutePlanner'));
const About = lazy(() => import('./pages/About'));

const TITLES: Record<string, string> = {
  '/': 'Safe Roads - real-time pothole detection',
  '/detect': 'Detect potholes - Safe Roads',
  '/map': 'Hazard map - Safe Roads',
  '/route': 'Route alerts - Safe Roads',
  '/about': 'How it works - Safe Roads',
};

function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber/30 border-t-amber" />
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? 'Safe Roads';
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[2000] btn-primary">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1 pb-20 md:pb-0">
        <div key={pathname} className="animate-fade-up">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/detect" element={<Detect />} />
              <Route path="/map" element={<HazardMap />} />
              <Route path="/route" element={<RoutePlanner />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
