// Hazard reports live in three places:
//  - the built-in sample set (read only)
//  - localStorage, so your own reports survive a refresh even with no backend
//  - the shared store behind /api/hazards (Netlify Function + Blobs), when it is reachable
// If the function can't be reached (local dev, static preview, offline) the app just keeps
// working from localStorage and says so in the UI.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SAMPLE_HAZARDS } from './sample';
import type { Hazard, NewHazard } from './types';

const LS_KEY = 'saferoads.reports.v1';
const API = '/api/hazards';

export type SyncStatus = 'checking' | 'shared' | 'local';

function loadLocal(): Hazard[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list = raw ? (JSON.parse(raw) as Hazard[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveLocal(list: Hazard[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(-300)));
  } catch {
    // storage full (thumbnails) - drop thumbnails and try again
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list.slice(-300).map(({ thumb: _t, ...h }) => h)));
    } catch {
      /* give up quietly */
    }
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 5000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

function isJson(res: Response) {
  return (res.headers.get('content-type') || '').includes('application/json');
}

type Listener = () => void;

// tiny shared state so every page sees the same list
const state = {
  local: [] as Hazard[],
  shared: [] as Hazard[],
  status: 'checking' as SyncStatus,
  loaded: false,
  listeners: new Set<Listener>(),
};
const emit = () => state.listeners.forEach((l) => l());

async function refreshShared() {
  try {
    const res = await fetchWithTimeout(API);
    // on a static host the SPA fallback answers with index.html, so check the type too
    if (!res.ok || !isJson(res)) throw new Error('no api');
    const body = await res.json();
    state.shared = (body.hazards as Hazard[]).map((h) => ({ ...h, origin: 'shared' as const }));
    state.status = 'shared';
  } catch {
    state.status = 'local';
  }
  emit();
}

function ensureLoaded() {
  if (state.loaded) return;
  state.loaded = true;
  state.local = loadLocal();
  refreshShared();
}

export async function addHazard(input: NewHazard): Promise<Hazard> {
  const local: Hazard = {
    ...input,
    id: crypto.randomUUID?.() ?? String(Date.now()),
    createdAt: new Date().toISOString(),
    confirmations: 1,
    origin: 'local',
  };
  state.local = [...state.local, local];
  saveLocal(state.local);
  emit();
  if (state.status === 'shared') {
    try {
      const { thumb: _thumb, ...body } = input; // photos stay on the device
      const res = await fetchWithTimeout(API, { method: 'POST', body: JSON.stringify(body) });
      if (res.ok && isJson(res)) {
        const { hazard } = await res.json();
        // remember which shared report this local one became
        state.local = state.local.map((h) => (h.id === local.id ? { ...h, sharedId: hazard.id } as Hazard : h));
        saveLocal(state.local);
        await refreshShared();
      }
    } catch {
      /* keep the local copy */
    }
  }
  return local;
}

export function removeLocalHazard(id: string) {
  state.local = state.local.filter((h) => h.id !== id);
  saveLocal(state.local);
  emit();
}

export function useHazards() {
  const [, force] = useState(0);
  useEffect(() => {
    ensureLoaded();
    const l = () => force((n) => n + 1);
    state.listeners.add(l);
    return () => {
      state.listeners.delete(l);
    };
  }, []);
  const refresh = useCallback(() => refreshShared(), []);
  const all = useMemo(() => {
    // a local report that was also saved to the shared store shows up once
    const sharedIds = new Set(state.shared.map((h) => h.id));
    const local = state.local.filter((h) => !sharedIds.has((h as Hazard & { sharedId?: string }).sharedId ?? ''));
    return [...SAMPLE_HAZARDS, ...state.shared, ...local];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.local, state.shared]);
  return { hazards: all, status: state.status, refresh, localCount: state.local.length, sharedCount: state.shared.length };
}
