import { useEffect, useRef, useState } from 'react';
import { searchPlaces, suggestPlaces, type Place } from '../geo/services';
import type { LatLng } from '../geo/geo';

// suggestions while typing (debounced), plus a full search on Enter
export function usePlaceSearch(query: string, near: LatLng | null, enabled: boolean) {
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    ctl.current?.abort();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const c = new AbortController();
    ctl.current = c;
    setLoading(true);
    const t = setTimeout(() => {
      suggestPlaces(q, nearRef.current, c.signal)
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setError('Search is not responding. Try again in a moment.');
        })
        .finally(() => !c.signal.aborted && setLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [query, enabled]);

  // Enter: use what we have, else ask Nominatim once
  const submit = async (): Promise<Place[]> => {
    if (results.length) return results;
    setLoading(true);
    try {
      const r = await searchPlaces(query);
      setResults(r);
      setError(r.length ? null : `No places found for “${query.trim()}”.`);
      return r;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, submit, clear: () => setResults([]) };
}
