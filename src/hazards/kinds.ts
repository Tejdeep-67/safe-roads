import type { HazardType } from './types';

export interface Kind {
  label: string; // "Pothole"
  plural: string;
  hint: string; // one line shown in the report form
}

export const KINDS: Record<HazardType, Kind> = {
  pothole: { label: 'Pothole', plural: 'potholes', hint: 'A hole or broken patch in the road surface.' },
  waterlogging: { label: 'Waterlogging', plural: 'waterlogged spots', hint: 'Water that stays on the road and hides the surface.' },
  broken_edge: { label: 'Broken road edge', plural: 'broken road edges', hint: 'Cave-in, cut or missing edge at the side of the road.' },
  open_manhole: { label: 'Open manhole', plural: 'open manholes', hint: 'A missing or sunken cover.' },
  speed_bump: { label: 'Unmarked speed bump', plural: 'unmarked speed bumps', hint: 'A bump with no paint or sign that you only notice when you hit it.' },
};

export const TYPE_ORDER = Object.keys(KINDS) as HazardType[];
export const kindLabel = (t: HazardType) => KINDS[t]?.label ?? 'Hazard';
export const kindLower = (t: HazardType) => kindLabel(t).toLowerCase();
