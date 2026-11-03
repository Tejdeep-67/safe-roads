import { CornerUpRight } from 'lucide-react';
import type { Place } from '../geo/services';
import { formatDistance, haversine, type LatLng } from '../geo/geo';
import type { Hazard } from '../hazards/types';
import Sheet from './Sheet';

interface Props {
  place: Place;
  myPos: LatLng | null;
  hazards: Hazard[];
  onDirections: () => void;
  onClose: () => void;
}

export default function PlaceDetails({ place, myPos, hazards, onDirections, onClose }: Props) {
  const here: LatLng = [place.lat, place.lng];
  const near = hazards.filter((h) => haversine(here, [h.lat, h.lng]) <= 1000);
  const real = near.filter((h) => h.origin !== 'sample').length;
  const dist = myPos ? haversine(myPos, here) : null;
  return (
    <Sheet label="Place" title={place.label} subtitle={place.detail} onClose={onClose}>
      <p className="text-[14px] text-muted">
        {near.length === 0
          ? 'No potholes reported within 1 km.'
          : `${near.length} pothole${near.length > 1 ? 's' : ''} within 1 km${real < near.length ? ` (${near.length - real} sample)` : ''}.`}
        {dist !== null && ` ${formatDistance(dist)} from you.`}
      </p>
      <div className="mt-4">
        <button className="btn-primary" onClick={onDirections}>
          <CornerUpRight className="h-4 w-4" /> Directions
        </button>
      </div>
    </Sheet>
  );
}
