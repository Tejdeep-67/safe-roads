import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Crosshair, X } from 'lucide-react';
import L, { GUNTUR, TILE_ATTRIBUTION, TILE_URL } from '../map/leaflet';
import type { Severity } from '../detection/postprocess';

const pin = L.divIcon({ className: '', html: '<div class="hz-pin" style="color:#f5b301"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function ClickToPlace({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

export interface PickResult {
  lat: number;
  lng: number;
  severity: Severity;
  note: string;
}

interface Props {
  initial?: [number, number] | null;
  initialSeverity?: Severity;
  hint?: string;
  onCancel: () => void;
  onSave: (r: PickResult) => void;
}

export default function LocationPicker({ initial, initialSeverity = 'medium', hint, onCancel, onSave }: Props) {
  const [pos, setPos] = useState<[number, number] | null>(initial ?? null);
  const [severity, setSeverity] = useState<Severity>(initialSeverity);
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="fixed inset-0 z-[2500] grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-label="Add hazard to map">
      <div className="card w-full max-w-lg animate-fade-up rounded-b-none p-4 sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add to hazard map</h2>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-zinc-400">{hint ?? 'Tap the map where the pothole is.'}</p>
        <div className="relative h-64 overflow-hidden rounded-xl border border-white/10">
          <MapContainer center={pos ?? GUNTUR} zoom={pos ? 16 : 13} className="h-full w-full" attributionControl={false}>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <ClickToPlace onPick={setPos} />
            {pos && <Marker position={pos} icon={pin} />}
          </MapContainer>
          <button
            onClick={useMyLocation}
            className="btn-ghost absolute right-2 top-2 z-[500] !bg-asphalt-900/90 !px-2.5 !py-1.5 text-xs"
            disabled={locating}
          >
            <Crosshair className="h-3.5 w-3.5" /> {locating ? 'Locating…' : 'My location'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
          <div>
            <span className="label">Severity</span>
            <div className="mt-1.5 flex gap-1.5">
              {(['low', 'medium', 'high'] as Severity[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ring-1 transition ${
                    severity === s ? 'bg-amber text-asphalt-950 ring-amber' : 'text-zinc-300 ring-white/10 hover:ring-white/25'
                  }`}
                  aria-pressed={severity === s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="label">Note (optional)</span>
            <input className="input mt-1.5 !py-2" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. near the bus stop" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!pos} onClick={() => pos && onSave({ lat: pos[0], lng: pos[1], severity, note })}>
            Save hazard
          </button>
        </div>
      </div>
    </div>
  );
}
