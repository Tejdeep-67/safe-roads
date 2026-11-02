// Drive mode: follow the user's position along the route and warn before each hazard.
// Position comes from the GPS (watchPosition) or from a simulator that drives along
// the route, so it can be demoed on a laptop.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cumulative, locateOnRoute, pointAlong, type LatLng, type NearHazard } from './geo';
import type { Hazard } from '../hazards/types';

export const WARN_AT_M = 150; // first warning
export const CLOSE_AT_M = 40; // second, short warning

export interface DriveState {
  active: boolean;
  source: 'gps' | 'sim' | null;
  position: LatLng | null;
  along: number;
  offRoute: number;
  speedKmh: number | null;
  next: NearHazard<Hazard> | null;
  distToNext: number | null;
  passed: number;
  error: string | null;
}

const initial: DriveState = {
  active: false,
  source: null,
  position: null,
  along: 0,
  offRoute: 0,
  speedKmh: null,
  next: null,
  distToNext: null,
  passed: 0,
  error: null,
};

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-IN') ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export function useDriveMode(route: LatLng[] | null, hazards: NearHazard<Hazard>[], opts: { voice: boolean }) {
  const [state, setState] = useState<DriveState>(initial);
  const cum = useRef<number[]>([]);
  const warned = useRef(new Map<string, number>()); // hazard id -> warning level given (1 or 2)
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const voiceRef = useRef(opts.voice);
  voiceRef.current = opts.voice;

  useEffect(() => {
    cum.current = route ? cumulative(route) : [];
  }, [route]);

  const update = useCallback(
    (pos: LatLng, speedKmh: number | null, source: 'gps' | 'sim') => {
      if (!route) return;
      const loc = locateOnRoute(pos, route, cum.current);
      // hazards still ahead of us (5 m grace so one right under the car still counts)
      const ahead = hazards.filter((h) => h.along > loc.along - 5);
      const next = ahead[0] ?? null;
      const dist = next ? Math.max(0, next.along - loc.along) : null;
      if (next && dist !== null) {
        const level = warned.current.get(next.item.id) ?? 0;
        const sev = next.item.severity;
        if (level < 1 && dist <= WARN_AT_M) {
          warned.current.set(next.item.id, 1);
          if (voiceRef.current) speak(`${sev === 'high' ? 'Careful. ' : ''}Pothole ahead in ${Math.round(dist / 10) * 10} metres. ${sev} severity.`);
          navigator.vibrate?.([200, 100, 200]);
        } else if (level < 2 && dist <= CLOSE_AT_M) {
          warned.current.set(next.item.id, 2);
          if (voiceRef.current) speak('Pothole now.');
          navigator.vibrate?.(400);
        }
      }
      setState((s) => ({
        ...s,
        position: pos,
        along: loc.along,
        offRoute: loc.dist,
        speedKmh,
        next,
        distToNext: dist,
        passed: hazards.length - ahead.length,
        source,
      }));
    },
    [route, hazards],
  );

  // the GPS / timer callbacks always call the latest version
  const updateRef = useRef(update);
  updateRef.current = update;

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (simTimer.current !== null) clearInterval(simTimer.current);
    watchId.current = null;
    simTimer.current = null;
    wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setState((s) => ({ ...s, active: false, source: null }));
  }, []);

  const begin = async () => {
    warned.current.clear();
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      wakeLock.current = (await wl?.request('screen')) ?? null;
    } catch {
      /* not supported, fine */
    }
    // a silent utterance so mobile browsers allow speech later (needs a user gesture)
    if (voiceRef.current && 'speechSynthesis' in window) speak(' ');
  };

  const startGps = useCallback(async () => {
    if (!route) return;
    stop();
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Location is not available in this browser.' }));
      return;
    }
    await begin();
    setState({ ...initial, active: true, source: 'gps' });
    watchId.current = navigator.geolocation.watchPosition(
      (p) => updateRef.current([p.coords.latitude, p.coords.longitude], p.coords.speed != null ? p.coords.speed * 3.6 : null, 'gps'),
      (err) => {
        setState((s) => ({ ...s, error: err.code === 1 ? 'Location permission denied.' : 'Could not get your location.' }));
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, stop]);

  const startSim = useCallback(
    async (kmh = 40, speedup = 6) => {
      if (!route) return;
      stop();
      await begin();
      setState({ ...initial, active: true, source: 'sim' });
      let along = 0;
      const total = cum.current[cum.current.length - 1] ?? 0;
      const tick = 200;
      simTimer.current = window.setInterval(() => {
        along += ((kmh / 3.6) * speedup * tick) / 1000;
        if (along >= total) {
          updateRef.current(route[route.length - 1], kmh, 'sim');
          stop();
          return;
        }
        updateRef.current(pointAlong(route, along, cum.current), kmh, 'sim');
      }, tick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, stop],
  );

  useEffect(() => stop, [stop]);
  useEffect(() => {
    stop();
    setState(initial);
  }, [route, stop]);

  return { drive: state, startGps, startSim, stop };
}
