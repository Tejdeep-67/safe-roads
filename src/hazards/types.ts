import type { Severity } from '../detection/postprocess';

export type HazardSource = 'camera' | 'video' | 'photo' | 'manual';
export type HazardType = 'pothole' | 'waterlogging' | 'broken_edge' | 'open_manhole' | 'speed_bump';
export type HazardStatus = 'open' | 'resolved' | 'stale';
export type MyVote = 'confirm' | 'fixed' | 'flag' | null;

export interface Hazard {
  id: string;
  lat: number;
  lng: number;
  type: HazardType;
  severity: Severity;
  confidence: number | null;
  potholes: number;
  source: HazardSource;
  note: string;
  createdAt: string;
  updatedAt: string;
  status: HazardStatus;
  verified: boolean; // at least two different people confirmed it (the reporter counts)
  confirmations: number;
  fixedVotes: number;
  mine: boolean;
  myVote: MyVote;
  hasPhoto: boolean;
  localPhoto?: string; // data url kept in memory right after reporting, so the photo shows instantly
}

export interface NewHazard {
  lat: number;
  lng: number;
  type: HazardType;
  severity: Severity;
  confidence: number | null;
  potholes: number;
  source: HazardSource;
  note: string;
  photo?: string; // jpeg data url
}

export const photoUrl = (h: Hazard) => h.localPhoto ?? (h.hasPhoto ? `/api/photos/${h.id}` : null);
