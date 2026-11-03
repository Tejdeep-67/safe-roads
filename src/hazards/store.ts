// Hazards on the map = the built-in sample set + real reports from /api/hazards
// (Netlify Function + Blobs). The last good list is cached in localStorage so the map
// still shows something when the server can't be reached, and the UI says so.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { api, ApiError } from '../lib/api';
import { SAMPLE_HAZARDS } from './sample';
import type { Hazard, NewHazard } from './types';

const CACHE_KEY = 'saferoads.cache.v2';
export type SyncStatus = 'loading' | 'ok' | 'offline';

type Server = Omit<Hazard, 'origin' | 'localPhoto'>;
const fromServer = (h: Server): Hazard => ({ ...h, origin: 'shared' });

const state = {
  shared: [] as Hazard[],
  status: 'loading' as SyncStatus,
  showSamples: localStorage.getItem('saferoads.samples') !== 'off',
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
  state.shared = state.shared.map((h) => ({ ...h, mine: false }));
  emit();
}

export function setShowSamples(on: boolean) {
  state.showSamples = on;
  localStorage.setItem('saferoads.samples', on ? 'on' : 'off');
  emit();
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
    const all = state.showSamples ? [...SAMPLE_HAZARDS, ...state.shared] : state.shared;
    return {
      all,
      shared: state.shared,
      mine: state.shared.filter((h) => h.mine),
      status: state.status,
      showSamples: state.showSamples,
    };
  }, [version]);
}
