// The whole app is this one screen: a full-screen map with a search bar, a few
// floating buttons, and one panel at a time (bottom sheet on phones, left panel on desktop).
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttributionControl, MapContainer, Marker, Polyline, ZoomControl, useMapEvents, Circle } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Camera, LocateFixed, LocateOff, Locate, RefreshCw, WifiOff } from 'lucide-react';
import L, { GUNTUR } from './leaflet';
import BaseMap from './BaseMap';
import HazardPins from './HazardPins';
import { meIcon, placeIcon, startIcon } from './markers';
import { useAuth } from '../auth/AuthProvider';
import { deleteHazard, refreshHazards, setShowSamples, useHazards } from '../hazards/store';
import type { Hazard } from '../hazards/types';
import { useMyLocation } from '../geo/useMyLocation';
import { useDriveMode } from '../geo/useDriveMode';
import { haversine, type LatLng } from '../geo/geo';
import type { Place, RouteResult } from '../geo/services';
import SearchBar from '../ui/SearchBar';
import AccountMenu from '../ui/AccountMenu';
import AuthPanel from '../ui/AuthPanel';
import HazardDetails from '../ui/HazardDetails';
import PlaceDetails from '../ui/PlaceDetails';
import Directions, { routeHazards, type From } from '../ui/Directions';
import DriveOverlay from '../ui/DriveOverlay';
import MyReports from '../ui/MyReports';
import AboutPanel from '../ui/AboutPanel';
import { toast } from '../ui/Toaster';

// the report flow pulls in exifr + the detector glue, so it loads when first opened
const ReportFlow = lazy(() => import('../ui/ReportFlow'));

type Panel =
  | { kind: 'none' }
  | { kind: 'hazard'; id: string }
  | { kind: 'place' }
  | { kind: 'directions' }
  | { kind: 'report' }
  | { kind: 'mine' }
  | { kind: 'about' }
  | { kind: 'auth'; reason?: string; then?: 'report' | 'mine' };

const VIEW_KEY = 'saferoads.view';
const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initialView(): { center: LatLng; zoom: number } {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
    if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.zoom)) return { center: [v.lat, v.lng], zoom: v.zoom };
  } catch {
    /* ignore */
  }
  return { center: GUNTUR, zoom: 13 };
}

function useDesktop() {
  const [d, setD] = useState(isDesktop);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setD(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return d;
}

function MapEvents({ onClick, onMove }: { onClick: (ll: LatLng) => void; onMove: (m: LeafletMap) => void }) {
  const map = useMapEvents({
    click: (e) => onClick([e.latlng.lat, e.latlng.lng]),
    moveend: () => onMove(map),
  });
  return null;
}

export default function MapApp() {
  const { user, signOut } = useAuth();
  const hz = useHazards();
  const loc = useMyLocation();
  const desktop = useDesktop();
  const [dark, setDark] = useState(() => localStorage.getItem('saferoads.theme') === 'dark');
  const [panel, setPanelState] = useState<Panel>({ kind: 'none' });
  const [place, setPlace] = useState<Place | null>(null);
  const [from, setFrom] = useState<From>('me');
  const [to, setTo] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [routeIdx, setRouteIdx] = useState(0);
  const [driving, setDriving] = useState(false);
  const [voice, setVoice] = useState(true);
  const [picking, setPicking] = useState<{ done: (ll: LatLng | null) => void } | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const view = useMemo(initialView, []);

  // ---------- theme ----------
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#202227' : '#ffffff');
    localStorage.setItem('saferoads.theme', dark ? 'dark' : 'light');
  }, [dark]);

  // ---------- reload "mine" flags when the account changes ----------
  const uid = user?.id ?? null;
  const firstUid = useRef(true);
  useEffect(() => {
    if (firstUid.current) {
      firstUid.current = false;
      return;
    }
    refreshHazards();
  }, [uid]);

  // ---------- panels + the phone's back button ----------
  const setPanel = useCallback((p: Panel) => {
    if (p.kind !== 'none' && !history.state?.sr) history.pushState({ sr: true }, '');
    setPanelState(p);
  }, []);
  const closePanel = useCallback(() => {
    if (history.state?.sr) history.back();
    else setPanelState({ kind: 'none' });
  }, []);
  useEffect(() => {
    const onPop = () => {
      setPanelState({ kind: 'none' });
      setPicking((pk) => {
        pk?.done(null);
        return null;
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (panel.kind !== 'directions') {
      setRoutes([]);
      setDriving(false);
    }
  }, [panel.kind]);

  // ---------- map helpers ----------
  const focus = useCallback((ll: LatLng, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const z = zoom ?? Math.max(map.getZoom(), 16);
    const offset = isDesktop() ? L.point(-206, 0) : L.point(0, Math.round(window.innerHeight * 0.28));
    const target = map.unproject(map.project(ll, z).add(offset), z);
    if (reducedMotion()) map.setView(target, z);
    else map.flyTo(target, z, { duration: 0.6 });
  }, []);

  const fitRoute = useCallback((r: RouteResult) => {
    const map = mapRef.current;
    if (!map) return;
    const b = L.latLngBounds(r.coords.map(([a, c]) => L.latLng(a, c)));
    map.fitBounds(b, isDesktop() ? { paddingTopLeft: [440, 80], paddingBottomRight: [80, 60] } : { paddingTopLeft: [24, 24], paddingBottomRight: [24, Math.round(window.innerHeight * 0.52) + 16] });
  }, []);

  const mapCenter = useCallback((): LatLng => {
    const c = mapRef.current?.getCenter();
    return c ? [c.lat, c.lng] : GUNTUR;
  }, []);

  // ---------- selected things ----------
  const selected = panel.kind === 'hazard' ? hz.all.find((h) => h.id === panel.id) ?? null : null;
  useEffect(() => {
    // the pin was deleted (by me, elsewhere) or samples were hidden
    if (panel.kind === 'hazard' && !selected && hz.status !== 'loading') setPanelState({ kind: 'none' });
  }, [panel, selected, hz.status]);

  const nearbyCount = selected
    ? hz.all.filter((h) => h.id !== selected.id && h.origin === selected.origin && haversine([h.lat, h.lng], [selected.lat, selected.lng]) <= 15).length
    : 0;

  const route = routes[routeIdx];
  const onRoute = useMemo(() => routeHazards(route, hz.all), [route, hz.all]);
  const routeCoords = useMemo(() => route?.coords ?? null, [route]);
  const { drive, startGps, startSim, stop } = useDriveMode(routeCoords, onRoute, { voice });

  useEffect(() => {
    if (routes.length) {
      setRouteIdx(0);
      fitRoute(routes[0]);
    }
  }, [routes, fitRoute]);

  useEffect(() => {
    if (driving && drive.position) mapRef.current?.setView(drive.position, Math.max(mapRef.current.getZoom(), 16), { animate: !reducedMotion() });
  }, [driving, drive.position]);
  useEffect(() => {
    if (driving && !drive.active && drive.along > 0) toast("You've arrived. Drive mode ended.", 'success');
  }, [driving, drive.active, drive.along]);

  // ---------- actions ----------
  const openHazard = (h: Hazard) => {
    setPanel({ kind: 'hazard', id: h.id });
    focus([h.lat, h.lng]);
  };

  const openReport = () => {
    if (!user) setPanel({ kind: 'auth', reason: 'You need an account to report a pothole. It takes a few seconds.', then: 'report' });
    else setPanel({ kind: 'report' });
  };

  const locateMe = async () => {
    const ll = await loc.locate();
    if (ll) {
      const m = mapRef.current;
      if (reducedMotion()) m?.setView(ll, Math.max(m.getZoom(), 15));
      else m?.flyTo(ll, Math.max(m?.getZoom() ?? 15, 15), { duration: 0.6 });
    } else toast(loc.lastError() ?? "Couldn't get your location.", 'error');
  };

  const directionsTo = (p: Place | null) => {
    setTo(p);
    if (from === null) setFrom('me');
    setPanel({ kind: 'directions' });
  };

  const startDrive = async (sim: boolean) => {
    if (!routeCoords) return;
    setDriving(true);
    if (sim) await startSim();
    else await startGps();
    mapRef.current?.setZoom(16);
  };
  const stopDrive = () => {
    stop();
    setDriving(false);
    if (route) fitRoute(route);
  };

  const onMapClick = (ll: LatLng) => {
    if (picking) mapRef.current?.panTo(ll, { animate: !reducedMotion() });
  };

  const pickOnMap = (start: LatLng | null, done: (ll: LatLng | null) => void) => {
    if (start) mapRef.current?.setView(start, Math.max(mapRef.current.getZoom(), 17));
    setPicking({ done });
  };

  const onMove = (m: LeafletMap) => {
    const c = m.getCenter();
    localStorage.setItem(VIEW_KEY, JSON.stringify({ lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5), zoom: m.getZoom() }));
  };

  const avatar = (
    <AccountMenu
      user={user}
      dark={dark}
      showSamples={hz.showSamples}
      onSignIn={() => setPanel({ kind: 'auth' })}
      onSignOut={async () => {
        await signOut();
        if (panel.kind === 'mine' || panel.kind === 'report') setPanelState({ kind: 'none' });
        toast('Signed out.', 'info');
      }}
      onMyReports={() => setPanel({ kind: 'mine' })}
      onAbout={() => setPanel({ kind: 'about' })}
      onToggleDark={() => setDark((d) => !d)}
      onToggleSamples={() => setShowSamples(!hz.showSamples)}
    />
  );

  const panelOpen = panel.kind !== 'none';
  const LocIcon = loc.status === 'denied' || loc.status === 'unavailable' ? LocateOff : loc.status === 'on' ? LocateFixed : Locate;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <MapContainer
        center={view.center}
        zoom={view.zoom}
        minZoom={4}
        maxZoom={19}
        zoomControl={false}
        attributionControl={false}
        className="absolute inset-0 z-0 h-full w-full"
        ref={mapRef}
        worldCopyJump
      >
        <BaseMap dark={dark} />
        <AttributionControl position="bottomright" prefix={false} />
        {desktop && !driving && <ZoomControl position="bottomright" />}
        <MapEvents onClick={onMapClick} onMove={onMove} />

        {routes.map((r, i) =>
          i === routeIdx ? null : (
            <Polyline key={`alt${i}`} positions={r.coords} pathOptions={{ color: '#8a94a6', weight: 6, opacity: 0.8 }} eventHandlers={{ click: () => setRouteIdx(i) }} />
          ),
        )}
        {route && (
          <>
            <Polyline positions={route.coords} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9 }} interactive={false} />
            <Polyline positions={route.coords} pathOptions={{ color: '#2557d6', weight: 6, opacity: 1 }} interactive={false} />
          </>
        )}

        <HazardPins hazards={hz.all} selectedId={selected?.id ?? null} onSelect={(h) => !picking && openHazard(h)} />

        {loc.pos && !driving && (
          <>
            {loc.accuracy && loc.accuracy < 500 && (
              <Circle center={loc.pos} radius={loc.accuracy} pathOptions={{ color: '#3a6ff0', weight: 1, fillOpacity: 0.08 }} interactive={false} />
            )}
            <Marker position={loc.pos} icon={meIcon} interactive={false} keyboard={false} />
          </>
        )}
        {driving && drive.position && <Marker position={drive.position} icon={meIcon} interactive={false} keyboard={false} />}
        {place && (panel.kind === 'place' || panel.kind === 'none') && <Marker position={[place.lat, place.lng]} icon={placeIcon} keyboard={false} />}
        {to && panel.kind === 'directions' && <Marker position={[to.lat, to.lng]} icon={placeIcon} keyboard={false} />}
        {route && panel.kind === 'directions' && !driving && <Marker position={route.coords[0]} icon={startIcon} keyboard={false} interactive={false} />}
      </MapContainer>

      {/* top bar */}
      {!driving && !picking && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-[1150] items-start gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))] md:flex ${
            panel.kind === 'directions' ? 'hidden' : 'flex'
          }`}
        >
          <div className="pointer-events-auto w-full md:w-auto">
            <SearchBar
              near={loc.pos ?? mapCenter()}
              selected={place}
              onSelect={(p) => {
                setPlace(p);
                setPanel({ kind: 'place' });
                focus([p.lat, p.lng], 15);
              }}
              onClear={() => {
                setPlace(null);
                if (panel.kind === 'place') closePanel();
              }}
              onDirections={() => directionsTo(place)}
              avatar={avatar}
            />
            {hz.status === 'offline' && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#1f2328] px-3 py-2 text-[13px] text-white shadow-float md:w-[400px]" role="status">
                <WifiOff className="h-4 w-4 shrink-0 text-amber-300" />
                <span className="flex-1">Can't reach the server. Showing the last saved map; reporting is paused.</span>
                <button className="flex items-center gap-1 rounded-full px-2 py-1 font-medium text-amber-200 hover:bg-white/10" onClick={() => refreshHazards()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            )}
          </div>
          <div className="pointer-events-auto ml-auto hidden md:block">{avatar}</div>
        </div>
      )}

      {/* floating buttons */}
      {!driving && !picking && (
        <div
          className={`absolute bottom-0 right-0 z-[1000] flex-col items-end gap-3 p-4 pb-[max(28px,calc(env(safe-area-inset-bottom)+20px))] md:flex md:pb-8 ${
            panelOpen ? 'hidden' : 'flex'
          }`}
        >
          <button className={`fab h-12 w-12 ${loc.status === 'locating' ? 'animate-pulse2' : ''}`} onClick={locateMe} aria-label="Show my location" title="My location">
            <LocIcon className={`h-5 w-5 ${loc.status === 'on' ? 'text-brand-600' : ''}`} />
          </button>
          <button
            className="flex h-14 items-center gap-2 rounded-2xl bg-brand-600 pl-4 pr-5 text-[15px] font-semibold text-white shadow-float transition hover:bg-brand-700 active:scale-[.98]"
            onClick={openReport}
          >
            <Camera className="h-5 w-5" /> Report pothole
          </button>
        </div>
      )}

      {/* placing a report on the map */}
      {picking && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1100] -translate-x-1/2 -translate-y-full" aria-hidden="true">
            <svg width="36" height="48" viewBox="0 0 30 40" className="drop-shadow-md">
              <path d="M15 39s13-13.4 13-23.5C28 7.4 22.2 1.5 15 1.5S2 7.4 2 15.5C2 25.6 15 39 15 39z" fill="#dc2f2f" stroke="#fff" strokeWidth="2" />
              <circle cx="15" cy="15.5" r="5" fill="#fff" />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1150] p-3 pt-[max(12px,env(safe-area-inset-top))]">
            <p className="mx-auto max-w-sm rounded-2xl bg-[#1f2328] px-4 py-3 text-center text-[14px] text-white shadow-float">
              Move the map so the pin sits on the pothole, or tap the spot.
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[1150] p-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-sm gap-2">
              <button
                className="btn-outline flex-1 py-3 shadow-float"
                onClick={() => {
                  picking.done(null);
                  setPicking(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-[2] py-3 shadow-float"
                onClick={() => {
                  picking.done(mapCenter());
                  setPicking(null);
                }}
              >
                Use this spot
              </button>
            </div>
          </div>
        </>
      )}

      {/* panels */}
      {!driving && (
        <>
          {panel.kind === 'hazard' && selected && (
            <HazardDetails
              hazard={selected}
              myPos={loc.pos}
              nearby={nearbyCount}
              onClose={closePanel}
              onDirections={(h) => directionsTo({ label: 'Pothole', detail: `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}`, lat: h.lat, lng: h.lng })}
              onDelete={async (h) => {
                try {
                  await deleteHazard(h.id);
                  toast('Report deleted.', 'success');
                  setPanelState({ kind: 'none' });
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            />
          )}
          {panel.kind === 'place' && place && (
            <PlaceDetails place={place} myPos={loc.pos} hazards={hz.all} onClose={closePanel} onDirections={() => directionsTo(place)} />
          )}
          {panel.kind === 'directions' && (
            <Directions
              from={from}
              to={to}
              loc={loc}
              hazards={hz.all}
              routes={routes}
              routeIdx={routeIdx}
              onFrom={setFrom}
              onTo={setTo}
              onRoutes={setRoutes}
              onSelectRoute={(i) => {
                setRouteIdx(i);
                if (routes[i]) fitRoute(routes[i]);
              }}
              onStart={startDrive}
              onFocusHazard={(h) => focus([h.lat, h.lng], 17)}
              onClose={closePanel}
            />
          )}
          {panel.kind === 'report' && (
            <Suspense fallback={null}>
            <ReportFlow
              hidden={!!picking}
              loc={loc}
              mapCenter={mapCenter}
              onPickOnMap={pickOnMap}
              onNeedSignIn={() => setPanel({ kind: 'auth', reason: 'Your session ended. Sign in again to send the report.', then: 'report' })}
              onClose={closePanel}
              onDone={(h) => {
                toast('Thanks! Your report is on the map.', 'success');
                setPanelState({ kind: 'hazard', id: h.id });
                focus([h.lat, h.lng], 17);
              }}
            />
            </Suspense>
          )}
          {panel.kind === 'mine' && (
            <MyReports mine={hz.mine} myPos={loc.pos} onClose={closePanel} onOpen={openHazard} onReport={openReport} />
          )}
          {panel.kind === 'about' && <AboutPanel onClose={closePanel} />}
          {panel.kind === 'auth' && (
            <AuthPanel
              reason={panel.reason}
              onClose={closePanel}
              onDone={() => {
                const then = panel.then;
                setPanelState(then ? { kind: then } : { kind: 'none' });
                toast('Signed in.', 'success');
              }}
            />
          )}
        </>
      )}

      {driving && (
        <DriveOverlay drive={drive} total={route?.distance ?? 0} hazardCount={onRoute.length} voice={voice} onVoice={setVoice} onStop={stopDrive} />
      )}
    </div>
  );
}
