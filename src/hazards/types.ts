import type { Severity } from '../detection/postprocess';

export type HazardSource = 'camera' | 'video' | 'photo' | 'manual';
// the built-in sample set, or a real report from the shared store
export type HazardOrigin = 'sample' | 'shared';

export interface Hazard {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
  confidence: number | null;
  potholes: number;
  source: HazardSource;
  note: string;
  createdAt: string;
  by: string | null; // first name of the person who reported it
  mine: boolean;
  hasPhoto: boolean;
  origin: HazardOrigin;
  localPhoto?: string; // data url kept in memory right after reporting, so the photo shows instantly
}

export interface NewHazard {
  lat: number;
  lng: number;
  severity: Severity;
  confidence: number | null;
  potholes: number;
  source: HazardSource;
  note: string;
  photo?: string; // jpeg data url
}

export const photoUrl = (h: Hazard) => h.localPhoto ?? (h.hasPhoto ? `/api/photos/${h.id}` : null);
