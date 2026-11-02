import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMap, Tooltip, ZoomControl } from 'react-leaflet';
import { Search, Crosshair, ArrowUpDown, Navigation, Square, Volume2, VolumeX, Play, Route as RouteIcon, AlertTriangle, Loader2 } from 'lucide-react';
import L, { GUNTUR, TILE_ATTRIBUTION, TILE_URL } from '../map/leaflet';
import { hazardIcon, popupHtml } from '../map/markers';
import { useHazards } from '../hazards/store';
import { DEMO_ROUTE } from '../hazards/sample';
import { formatDistance, hazardsNearRoute, type LatLng } from '../geo/geo';
import { getRoute, reverseLabel, searchPlaces, type Place, type RouteResult } from '../geo/services';
import { useDriveMode, WARN_AT_M } from '../geo/useDriveMode';
import SeverityBadge from '../components/SeverityBadge';
import { ALERT_BUFFER_M } from '../config';
import { toast } from '../components/Toaster';

const endIcon = (color: string, letter: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:999px;background:${color};color:#0a0b0d;display:grid;place-items:center;font:700 12px Inter Variable,sans-serif;border:3px solid #0a0b0d;box-shadow:0 0 0 2px ${color}">${letter}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
const startIcon = endIcon('#2dd4bf', 'A');
const finishIcon = endIcon('#f5b301', 'B');
const carIcon = L.divIcon({ className: '', html: '<div class="you-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function FitRoute({ coords }: { coords: LatLng[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
  }, [coords, map]);
  return null;
}

function Follow({ pos, on }: { pos: LatLng | null; on: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (on && pos) map.setView(pos, Math.max(map.getZoom(), 16), { animate: true });
  }, [pos, on, map]);
  return null;
}

function PlaceInput({ label, value, onChange, onLocate }: { label: string; value: Place | null; onChange: (p: Place | null) => void; onLocate?: () => void }) {
  const [text, setText] = useState(value?.label ?? '');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    setText(value?.label ?? '');
  }, [value]);

  const run = async () => {
    if (text.trim().length < 3) return toast('Type at least 3 letters', 'info');
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy(true);
    try {
      const r = await searchPlaces(text, ctl.current.signal);
      setResults(r);
      if (!r.length) toast('No places found. Try adding the city name.', 'info');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <span className="label">{label}</span>
      <form
        className="mt-1.5 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <input
          className="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null);
          }}
          placeholder="Search a place, e.g. Benz Circle Vijayawada"
          aria-label={label}
        />
        {onLocate && (
          <button type="button" className="btn-ghost !px-3" onClick={onLocate} title="Use my location" aria-label="Use my location">
            <Crosshair className="h-4 w-4" />
          </button>
        )}
        <button type="submit" className="btn-ghost !px-3" aria-label={`Search ${label}`} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>
      {results && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-[700] mt-1 overflow-hidden rounded-xl border border-white/10 bg-asphalt-800 shadow-card">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                className="w-full px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                onClick={() => {
                  onChange(r);
                  setResults(null);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RoutePlanner() {
  const { hazards } = useHazards();
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buffer, setBuffer] = useState(ALERT_BUFFER_M);
  const [voice, setVoice] = useState(true);

  const near = useMemo(() => (route ? hazardsNearRoute(route.coords, hazards, buffer) : []), [route, hazards, buffer]);
  const { drive, startGps, startSim, stop } = useDriveMode(route?.coords ?? null, near, { voice });
  const mapWrap = useRef<HTMLDivElement>(null);
  // on phones the map sits below the list, so bring it into view when driving starts
  useEffect(() => {
    if (drive.active && window.innerWidth < 1024) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      mapWrap.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }, [drive.active]);
  const nearIds = useMemo(() => new Set(near.map((n) => n.item.id)), [near]);

  const plan = async (a = from, b = to) => {
    if (!a || !b) return;
    setLoading(true);
    setError(null);
    try {
      setRoute(await getRoute(a, b));
    } catch (e) {
      setError((e as Error).message);
      setRoute(null);
    } finally {
      setLoading(false);
    }
  };

  // plan automatically when both ends are picked
  useEffect(() => {
    if (from && to) plan(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const locate = () => {
    if (!navigator.geolocation) return toast('Location is not available in this browser', 'error');
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const label = await reverseLabel(p.coords.latitude, p.coords.longitude);
        setFrom({ label, lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => toast('Could not get your location', 'error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const counts = { high: 0, medium: 0, low: 0 };
  near.forEach((n) => counts[n.item.severity]++);
  const km = route ? route.distance / 1000 : 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
      <div className="mb-5">
        <p className="label">Route alerts</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Only the potholes on your way</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Pick where you start and where you are going. You get the hazards within {buffer} m of the route, in the order you
          will reach them.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="card space-y-3 p-4">
            <PlaceInput label="From" value={from} onChange={setFrom} onLocate={locate} />
            <div className="flex justify-center">
              <button
                className="rounded-full border border-white/10 p-1.5 text-zinc-400 transition hover:rotate-180 hover:text-white"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
                aria-label="Swap start and destination"
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>
            <PlaceInput label="To" value={to} onChange={setTo} />
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                className="btn-ghost flex-1 text-xs"
                onClick={() => {
                  setFrom(DEMO_ROUTE.from);
                  setTo(DEMO_ROUTE.to);
                }}
              >
                <RouteIcon className="h-4 w-4 text-amber" /> Demo: Guntur bus stand → RVR &amp; JC
              </button>
            </div>
            <label className="block pt-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Alert distance from route</span>
                <span className="font-mono text-zinc-200">{buffer} m</span>
              </div>
              <input type="range" min={10} max={60} step={5} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className="mt-2 w-full" />
            </label>
            {error && (
              <p className="flex items-center gap-2 text-sm text-rose-300">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}
          </div>

          {route && (
            <div className="card animate-fade-up p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-asphalt-900/70 p-3">
                  <div className="font-display text-xl font-bold text-white">{km.toFixed(1)}</div>
                  <div className="text-[11px] text-zinc-500">km</div>
                </div>
                <div className="rounded-xl bg-asphalt-900/70 p-3">
                  <div className="font-display text-xl font-bold text-white">{Math.round(route.duration / 60)}</div>
                  <div className="text-[11px] text-zinc-500">min drive</div>
                </div>
                <div className="rounded-xl bg-asphalt-900/70 p-3">
                  <div className="font-display text-xl font-bold text-amber">{near.length}</div>
                  <div className="text-[11px] text-zinc-500">hazards</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                {counts.high} high · {counts.medium} medium · {counts.low} low
                {km > 0 && ` · ${(near.length / km).toFixed(1)} per km`}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {!drive.active ? (
                  <>
                    <button className="btn-primary flex-1" onClick={startGps}>
                      <Navigation className="h-4 w-4" /> Start drive mode
                    </button>
                    <button className="btn-ghost flex-1" onClick={() => startSim()}>
                      <Play className="h-4 w-4" /> Simulate drive
                    </button>
                  </>
                ) : (
                  <button className="btn-ghost flex-1 !border-rose-400/40 text-rose-200" onClick={stop}>
                    <Square className="h-4 w-4" /> Stop drive mode
                  </button>
                )}
                <button className="btn-ghost !px-3" onClick={() => setVoice((v) => !v)} aria-label={voice ? 'Mute voice alerts' : 'Turn on voice alerts'} aria-pressed={voice}>
                  {voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              </div>
              {drive.error && <p className="mt-2 text-sm text-rose-300">{drive.error}</p>}
              <p className="mt-2 text-[11px] text-zinc-500">
                Drive mode uses your GPS and speaks up {WARN_AT_M} m before each hazard (and vibrates on phones). Simulate drive
                moves a car along the route so you can try it from a desk.
              </p>

              <ol className="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {near.map((n, i) => {
                  const passed = drive.active && n.along < drive.along - 5;
                  return (
                    <li
                      key={n.item.id}
                      className={`flex items-center gap-3 rounded-xl border border-white/[.06] px-3 py-2 text-sm transition ${
                        passed ? 'opacity-40' : drive.next?.item.id === n.item.id ? 'border-amber/40 bg-amber/5' : 'bg-asphalt-900/60'
                      }`}
                    >
                      <span className="w-5 text-xs text-zinc-500">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-zinc-200">{n.item.note || 'Pothole'}</div>
                        <div className="text-xs text-zinc-500">
                          at {formatDistance(n.along)} · {Math.round(n.dist)} m off the line{n.item.origin === 'sample' ? ' · sample' : ''}
                        </div>
                      </div>
                      <SeverityBadge severity={n.item.severity} />
                    </li>
                  );
                })}
                {near.length === 0 && <li className="py-4 text-center text-sm text-zinc-500">No reported hazards on this route. Drive safe!</li>}
              </ol>
            </div>
          )}
        </div>

        <div ref={mapWrap} className="relative isolate h-[70vh] scroll-mt-16 overflow-hidden rounded-2xl border border-white/[.08] lg:h-[calc(100dvh-180px)] lg:min-h-[560px]">
          <MapContainer center={GUNTUR} zoom={12} className="h-full w-full" zoomControl={false}>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
            <ZoomControl position="bottomright" />
            {route && (
              <>
                <Polyline positions={route.coords} pathOptions={{ color: '#f5b301', weight: 12, opacity: 0.18 }} />
                <Polyline positions={route.coords} pathOptions={{ color: '#f5b301', weight: 4, opacity: 0.95 }} />
                <Marker position={route.coords[0]} icon={startIcon} />
                <Marker position={route.coords[route.coords.length - 1]} icon={finishIcon} />
              </>
            )}
            {hazards
              .filter((h) => !nearIds.has(h.id))
              .map((h) => (
                <CircleMarker key={h.id} center={[h.lat, h.lng]} radius={3.5} pathOptions={{ color: '#71717a', weight: 1, fillOpacity: 0.5 }}>
                  <Tooltip>Not on this route</Tooltip>
                </CircleMarker>
              ))}
            {near.map((n) => (
              <Marker key={n.item.id} position={[n.item.lat, n.item.lng]} icon={hazardIcon(n.item)} eventHandlers={{ add: (e) => e.target.bindPopup(popupHtml(n.item)) }} />
            ))}
            {drive.position && <Marker position={drive.position} icon={carIcon} zIndexOffset={1000} />}
            <FitRoute coords={route?.coords ?? null} />
            <Follow pos={drive.position} on={drive.active} />
          </MapContainer>

          {drive.active && (
            <div className="absolute inset-x-3 top-3 z-[600] animate-fade-up" aria-live="polite">
              <div
                className={`card mx-auto max-w-md p-4 ${
                  drive.distToNext !== null && drive.distToNext <= WARN_AT_M ? 'border-rose-500/50 shadow-[0_0_40px_-10px_rgba(244,63,94,.6)]' : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse2 rounded-full bg-signal" />
                    {drive.source === 'sim' ? 'Simulated drive' : 'Drive mode'}
                    {drive.speedKmh != null && ` · ${Math.round(drive.speedKmh)} km/h`}
                  </span>
                  <span>
                    {drive.passed}/{near.length} passed
                  </span>
                </div>
                {drive.next && drive.distToNext !== null ? (
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-zinc-500">Next pothole in</div>
                      <div className={`font-display text-4xl font-bold ${drive.distToNext <= WARN_AT_M ? 'text-rose-400' : 'text-white'}`}>
                        {formatDistance(drive.distToNext)}
                      </div>
                    </div>
                    <SeverityBadge severity={drive.next.item.severity} />
                  </div>
                ) : (
                  <div className="mt-2 font-display text-xl font-semibold text-signal">No more hazards ahead</div>
                )}
                {drive.offRoute > 60 && <p className="mt-2 text-xs text-amber">You are {Math.round(drive.offRoute)} m away from the route.</p>}
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 z-[600] grid place-items-center bg-asphalt-950/40 backdrop-blur-[2px]">
              <Loader2 className="h-8 w-8 animate-spin text-amber" />
            </div>
          )}
          <div className="pointer-events-none absolute bottom-6 left-3 z-[500] rounded-lg bg-asphalt-950/80 px-2 py-1 text-[10px] text-zinc-400">
            Routing: OSRM · Search: Nominatim
          </div>
        </div>
      </div>
    </section>
  );
}
