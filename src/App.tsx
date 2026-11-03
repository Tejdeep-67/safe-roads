import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import MapApp from './map/MapApp';
import Toaster from './ui/Toaster';

const DetectDemo = lazy(() => import('./pages/DetectDemo'));

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<MapApp />} />
        <Route
          path="/detect"
          element={
            <Suspense fallback={<div className="p-6 text-muted">Loading…</div>}>
              <DetectDemo />
            </Suspense>
          }
        />
        {/* old round-2 links */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}
