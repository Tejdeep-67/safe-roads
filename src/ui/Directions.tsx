import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpDown, Car, CircleDot, Loader2, LocateFixed, MapPin, Navigation2 } from 'lucide-react';
import type { Place, RouteResult } from '../geo/services';
import { formatDuration, getRoutes } from '../geo/services';
import { formatDistance, hazardsNearRoute, type LatLng, type NearHazard } from '../geo/geo';
import type { Hazard } from '../hazards/types';
import type { MyLocation } from '../geo/useMyLocation';
import { SEV_COLOR, SEV_LABEL } from '../map/markers';
import Sheet from './Sheet';
import PlaceInput from './PlaceInput';

// eslint-disable-next-line react-refresh/only-export-components
export const ROUTE_BUFFER_M = 30;
export type From = 'me' | Place | null;

interface Props {
  from: From;
  to: Place | null;
  loc: MyLocation;
  hazards: Hazard[];
  routes: RouteResult[];
  routeIdx: number;
  onFrom: (f: From) => void;
  onTo: (p: Place | null) => void;
  onRoutes: (r: RouteResult[]) => void;
  onSelectRoute: (i: number) => void;
  onStart: (simulate: boolean) => void;
  onFocusHazard: (h: Hazard) => void;
  onClose: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function routeHazards(route: RouteResult | undefined, hazards: Hazard[]): NearHazard<Hazard>[] {
  return route ? hazardsNearRoute(route.coords, hazards, ROUTE_BUFFER_M) : [];
}

export default function Directions(p: Props) {
  const { from, to, loc, hazards, routes, routeIdx } = p;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromPoint, setFromPoint] = useState<LatLng | null>(null);

  // resolve "Your location" to coordinates (asks for permission the first time)
  useEffect(() => {
    let live = true;
    if (from === 'me') {
      if (loc.pos) setFromPoint(loc.pos);
      else
        loc.locate().then((ll) => {
          if (!live) return;
          if (ll) setFromPoint(ll);
          else {
            setFromPoint(null);
            p.onFrom(null);
          }
        });
    } else setFromPoint(from ? [from.lat, from.lng] : null);
    return () => {
      live = false;
    };
    // loc.pos changes as you move; the route shouldn't be refetched for that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  useEffect(() => {
    if (!fromPoint || !to) {
      p.onRoutes([]);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    getRoutes(fromPoint, [to.lat, to.lng], ctl.signal)
      .then((r) => {
        // fewest bad potholes first is not always fastest, so keep OSRM's order (fastest first)
        p.onRoutes(r);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') {
          setError((e as Error).message);
          p.onRoutes([]);
        }
      })
      .finally(() => !ctl.signal.aborted && setLoading(false));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPoint?.[0], fromPoint?.[1], to?.lat, to?.lng]);

  const counts = routes.map((r) => routeHazards(r, hazards));
  const near = counts[routeIdx] ?? [];
  const route = routes[routeIdx];
  const fewest = counts.length > 1 ? counts.reduce((best, c, i) => (c.length < counts[best].length ? i : best), 0) : -1;

  const fromValue: Place | null = from === 'me' ? { label: 'Your location', lat: 0, lng: 0 } : from;

  return (
    <Sheet
      label="Directions"
      title="Directions"
      mobileMax="max-h-[52dvh]"
      leading={
        <button onClick={p.onClose} className="-ml-1 rounded-full p-2 text-muted hover:bg-sunken" aria-label="Back to map">
          <ArrowLeft className="h-5 w-5" />
        </button>
      }
      footer={
        route ? (
          <div className="flex items-center gap-2">
            <button className="btn-primary flex-1 py-3 text-[15px]" onClick={() => p.onStart(false)}>
              <Navigation2 className="h-4 w-4" /> Start
            </button>
            <button className="btn-outline py-3" onClick={() => p.onStart(true)} title="Drive along the route without moving (for testing on a laptop)">
              <Car className="h-4 w-4" /> Demo drive
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <PlaceInput
            id="dir-from"
            label="Start"
            value={fromValue}
            near={loc.pos}
            placeholder="Choose a starting point"
            onChange={(v) => p.onFrom(v)}
            icon={from === 'me' ? <LocateFixed className="h-4 w-4 shrink-0 text-brand-600" /> : <CircleDot className="h-4 w-4 shrink-0 text-muted" />}
          />
          <PlaceInput
            id="dir-to"
            label="Destination"
            value={to}
            near={loc.pos}
            placeholder="Choose a destination"
            onChange={p.onTo}
            autoFocus={!to}
            icon={<MapPin className="h-4 w-4 shrink-0 text-red-600" />}
          />
        </div>
        <button
          className="rounded-full p-2 text-muted hover:bg-sunken"
          aria-label="Swap start and destination"
          onClick={() => {
            const newFrom = to;
            const newTo = from === 'me' ? (loc.pos ? { label: 'Your location', lat: loc.pos[0], lng: loc.pos[1] } : null) : from;
            p.onFrom(newFrom);
            p.onTo(newTo);
          }}
        >
          <ArrowUpDown className="h-5 w-5" />
        </button>
      </div>
      {from !== 'me' && (
        <button className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-200" onClick={() => p.onFrom('me')}>
          Use my location as start
        </button>
      )}
      {loc.error && from === null && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{loc.error}</p>}
      {loc.status === 'locating' && from === 'me' && <p className="mt-3 text-sm text-muted">Finding your location…</p>}

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Finding routes…
        </p>
      )}
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</p>}

      {routes.length > 0 && !loading && (
        <>
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Routes">
            {routes.map((r, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={i === routeIdx}
                onClick={() => p.onSelectRoute(i)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                  i === routeIdx ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-600/10' : 'border-line hover:bg-sunken'
                }`}
              >
                <span>
                  <span className="block text-[15px] font-semibold text-ink">
                    {formatDuration(r.duration)} <span className="font-normal text-muted">· {formatDistance(r.distance)}</span>
                  </span>
                  <span className="block text-[13px] text-muted">
                    {i === 0 ? 'Fastest' : 'Alternative'}
                    {i === fewest && counts[i].length < counts[0].length ? ' · fewest potholes' : ''}
                  </span>
                </span>
                <span className={`text-sm font-medium ${counts[i].length ? 'text-sev-medium' : 'text-emerald-600'}`}>
                  {counts[i].length ? `${counts[i].length} pothole${counts[i].length > 1 ? 's' : ''}` : 'No potholes'}
                </span>
              </button>
            ))}
          </div>

          <h3 className="mb-1 mt-5 text-sm font-semibold text-ink">On this route (within {ROUTE_BUFFER_M} m)</h3>
          {near.length === 0 ? (
            <p className="text-sm text-muted">No reported potholes on this route. Drive safe anyway.</p>
          ) : (
            <ol className="divide-y divide-line">
              {near.map((n) => (
                <li key={n.item.id}>
                  <button className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-sunken" onClick={() => p.onFocusHazard(n.item)}>
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SEV_COLOR[n.item.severity] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-ink">
                        {SEV_LABEL[n.item.severity]} pothole{n.item.origin === 'sample' ? ' (sample)' : ''}
                      </span>
                      {n.item.note && <span className="block truncate text-[13px] text-muted">{n.item.note}</span>}
                    </span>
                    <span className="shrink-0 text-sm text-muted">at {formatDistance(n.along)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-faint">Routes by OSRM · © OpenStreetMap contributors</p>
        </>
      )}
    </Sheet>
  );
}
