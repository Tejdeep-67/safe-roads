// "My location": asks for the GPS only when the user taps the button (or starts a
// report/route), then keeps the blue dot fresh with watchPosition.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from './geo';

export type LocStatus = 'idle' | 'locating' | 'on' | 'denied' | 'unavailable';

export interface MyLocation {
  pos: LatLng | null;
  accuracy: number | null;
  status: LocStatus;
  error: string | null;
  locate: () => Promise<LatLng | null>;
  lastError: () => string | null;
}

const MESSAGES: Record<number, string> = {
  1: 'Location is blocked for this site. Allow it in your browser settings, or search for a place instead.',
  2: "Couldn't get your location right now (no GPS fix). Try again outdoors, or search for a place.",
  3: 'Getting your location took too long. Try again.',
};

export function useMyLocation(): MyLocation {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<LocStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const errRef = useRef<string | null>(null);
  const fail = (msg: string) => {
    errRef.current = msg;
    setError(msg);
  };

  const startWatch = useCallback(() => {
    if (watchId.current !== null || !navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setAccuracy(p.coords.accuracy);
      },
      () => {
        /* keep the last fix; the one-shot request reports errors */
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }, []);

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  const locate = useCallback(() => {
    return new Promise<LatLng | null>((resolve) => {
      if (!navigator.geolocation || !window.isSecureContext) {
        setStatus('unavailable');
        fail('This browser can’t share your location here. Search for a place instead.');
        resolve(null);
        return;
      }
      setStatus('locating');
      errRef.current = null;
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const ll: LatLng = [p.coords.latitude, p.coords.longitude];
          setPos(ll);
          setAccuracy(p.coords.accuracy);
          setStatus('on');
          startWatch();
          resolve(ll);
        },
        (e) => {
          setStatus(e.code === 1 ? 'denied' : 'unavailable');
          fail(MESSAGES[e.code] ?? MESSAGES[2]);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      );
    });
  }, [startWatch]);

  const lastError = useCallback(() => errRef.current, []);
  return { pos, accuracy, status, error, locate, lastError };
}
