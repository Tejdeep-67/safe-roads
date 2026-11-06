// Hazards on the map = real reports from /api/hazards
// (Netlify Function + Blobs). The last good list is cached in localStorage so the map
// still shows something when the server can't be reached, and the UI says so.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { api, ApiError } from '../lib/api';
import { applyFilters, DEFAULT_FILTERS, parseFilters, type MapFilters } from './filters';
import type { Hazard, MyVote, NewHazard } from './types';

const CACHE_KEY = 'saferoads.cache.v3';
const FILTER_KEY = 'saferoads.filters';
export type SyncStatus = 'loading' | 'ok' | 'offline';

type Server = Omit<Hazard, 'localPhoto'>;
const fromServer = (h: Server): Hazard => ({ ...h });

const state = {
  shared: [] as Hazard[],
  status: 'loading' as SyncStatus,
  filters: parseFilters(localStorage.getItem(FILTER_KEY)) as MapFilters,
  version: 0,
};
const listeners = new Set<() => void>();
function emit() {
  state.version++;
  listeners.forEach((l) => l());
}

function readCache(): Hazard[] {
  try {
    const list = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(list) ? list.map((h: Hazard) => ({ ...h, mine: false, localPhoto: undefined })) : [];
  } catch {
    return [];
  }
}
function writeCache(list: Hazard[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(-1000).map(({ localPhoto, ...h }) => (void localPhoto, h))));
  } catch {
    /* storage full or disabled, not important */
  }
}

let inflight: Promise<void> | null = null;
export function refreshHazards() {
  inflight ??= api<{ hazards: Server[] }>('/api/hazards', { timeoutMs: 9000 })
    .then(({ hazards }) => {
      // keep the in-memory photo of anything I just reported
      const local = new Map(state.shared.filter((h) => h.localPhoto).map((h) => [h.id, h.localPhoto]));
      state.shared = hazards.map(fromServer).map((h) => (local.has(h.id) ? { ...h, localPhoto: local.get(h.id) } : h));
      state.status = 'ok';
      writeCache(state.shared);
    })
    .catch(() => {
      if (state.status !== 'ok') {
        state.shared = readCache();
        state.status = 'offline';
      }
    })
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

export async function addHazard(input: NewHazard): Promise<Hazard> {
  try {
    const { hazard } = await api<{ hazard: Server }>('/api/hazards', { method: 'POST', json: input, timeoutMs: 30000 });
    const h = { ...fromServer(hazard), localPhoto: input.photo };
    state.shared = [...state.shared.filter((x) => x.id !== h.id), h];
    state.status = 'ok';
    writeCache(state.shared);
    emit();
    return h;
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) state.status = 'offline';
    emit();
    throw e;
  }
}

export async function deleteHazard(id: string) {
  await api(`/api/hazards/${encodeURIComponent(id)}`, { method: 'DELETE' });
  state.shared = state.shared.filter((h) => h.id !== id);
  writeCache(state.shared);
  emit();
}

// after sign-in/out the "mine" flags change, so reload
export function forgetMine() {
  state.shared = state.shared.map((h) => ({ ...h, mine: false, myVote: null }));
  emit();
}

export function setFilters(f: MapFilters) {
  state.filters = f;
  localStorage.setItem(FILTER_KEY, JSON.stringify(f));
  emit();
}
export const resetFilters = () => setFilters(DEFAULT_FILTERS);

function replaceOne(h: Server) {
  const local = state.shared.find((x) => x.id === h.id)?.localPhoto;
  const next = { ...fromServer(h), localPhoto: local };
  state.shared = state.shared.some((x) => x.id === h.id) ? state.shared.map((x) => (x.id === h.id ? next : x)) : [...state.shared, next];
  writeCache(state.shared);
  emit();
  return next;
}

// confirm / fixed / flag a report made by someone else. Returns the report as the server now sees it.
export async function voteHazard(id: string, vote: Exclude<MyVote, null>, reason?: string): Promise<Hazard> {
  const { hazard } = await api<{ hazard: Server }>(`/api/hazards/${encodeURIComponent(id)}/vote`, { method: 'POST', json: { vote, reason } });
  if (vote === 'flag') {
    // flagged by me: it stays visible to others until enough people flag it, but I don't need to see it again
    state.shared = state.shared.filter((h) => h.id !== id);
    writeCache(state.shared);
    emit();
    return fromServer(hazard);
  }
  return replaceOne(hazard);
}
export async function unvoteHazard(id: string): Promise<Hazard> {
  const { hazard } = await api<{ hazard: Server }>(`/api/hazards/${encodeURIComponent(id)}/vote`, { method: 'DELETE' });
  return replaceOne(hazard);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let started = false;
export function useHazards() {
  const version = useSyncExternalStore(subscribe, () => state.version);
  useEffect(() => {
    if (started) return;
    started = true;
    refreshHazards();
    // pick up other people's reports while the app is open
    const t = setInterval(() => document.visibilityState === 'visible' && refreshHazards(), 90_000);
    const online = () => refreshHazards();
    window.addEventListener('online', online);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', online);
      started = false;
    };
  }, []);
  return useMemo(() => {
    void version;
    const all = state.shared;
    return {
      all, // every report I know about, whatever its status
      open: all.filter((h) => h.status === 'open'), // what routes and drive mode warn about
      pins: applyFilters(all, state.filters), // what is drawn on the map
      mine: all.filter((h) => h.mine),
      status: state.status,
      filters: state.filters,
    };
  }, [version]);
}
