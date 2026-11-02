import type { Severity } from '../detection/postprocess';

export type HazardSource = 'camera' | 'video' | 'photo' | 'manual';
// where a report came from: the built-in sample set, this browser only, or the shared store
export type HazardOrigin = 'sample' | 'local' | 'shared';

export interface Hazard {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
  confidence: number | null;
  source: HazardSource;
  note?: string;
  createdAt: string;
  confirmations: number;
  origin: HazardOrigin;
  thumb?: string; // small jpeg data url, only kept locally
}

export type NewHazard = Pick<Hazard, 'lat' | 'lng' | 'severity' | 'confidence' | 'source' | 'note' | 'thumb'>;
