import type { Hazard, HazardType } from './types';
import { TYPE_ORDER } from './kinds';

export interface MapFilters {
  types: HazardType[]; // which kinds of hazard to draw
  showFixed: boolean; // also draw reports the community marked as fixed
  verifiedOnly: boolean;
  roadFeatures: boolean; // OpenStreetMap speed bumps layer
}

export const DEFAULT_FILTERS: MapFilters = { types: [...TYPE_ORDER], showFixed: false, verifiedOnly: false, roadFeatures: false };

export function parseFilters(raw: string | null): MapFilters {
  try {
    const v = JSON.parse(raw || 'null');
    if (!v || typeof v !== 'object') return DEFAULT_FILTERS;
    const types = Array.isArray(v.types) ? v.types.filter((t: unknown): t is HazardType => TYPE_ORDER.includes(t as HazardType)) : DEFAULT_FILTERS.types;
    return {
      types: types.length ? types : DEFAULT_FILTERS.types,
      showFixed: v.showFixed === true,
      verifiedOnly: v.verifiedOnly === true,
      roadFeatures: v.roadFeatures === true,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export const isDefault = (f: MapFilters) =>
  f.types.length === TYPE_ORDER.length && !f.showFixed && !f.verifiedOnly && !f.roadFeatures;

// what is drawn on the map: my own reports are always drawn so a report never seems to vanish
export function applyFilters(list: Hazard[], f: MapFilters): Hazard[] {
  return list.filter((h) => {
    if (h.mine) return true;
    if (!f.types.includes(h.type)) return false;
    if (h.status === 'resolved' && !f.showFixed) return false;
    if (f.verifiedOnly && !h.verified) return false;
    return true;
  });
}

export const activeFilterCount = (f: MapFilters) =>
  (f.types.length === TYPE_ORDER.length ? 0 : 1) + Number(f.showFixed) + Number(f.verifiedOnly) + Number(f.roadFeatures);
