import { MapPin } from 'lucide-react';
import type { Place } from '../geo/services';

export default function PlaceList({ places, onPick, activeIndex = -1 }: { places: Place[]; onPick: (p: Place) => void; activeIndex?: number }) {
  return (
    <ul role="listbox" className="py-1">
      {places.map((p, i) => (
        <li key={`${p.lat},${p.lng},${i}`} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(p)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken ${i === activeIndex ? 'bg-sunken' : ''}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] text-ink">{p.label}</span>
              {p.detail && <span className="block truncate text-[13px] text-muted">{p.detail}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
