import { useEffect, useState } from 'react';
import { CornerUpRight, Loader2, Trash2 } from 'lucide-react';
import type { Hazard } from '../hazards/types';
import { photoUrl } from '../hazards/types';
import { SEV_COLOR, SEV_LABEL } from '../map/markers';
import { formatDistance, haversine, type LatLng } from '../geo/geo';
import { reverseLabel } from '../geo/services';
import { timeAgo } from '../lib/format';
import Sheet from './Sheet';

interface Props {
  hazard: Hazard;
  myPos: LatLng | null;
  nearby: number; // other reports within 15 m
  onDirections: (h: Hazard) => void;
  onDelete: (h: Hazard) => Promise<void>;
  onClose: () => void;
}

export function SeverityChip({ severity }: { severity: Hazard['severity'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-[13px] font-medium text-ink">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEV_COLOR[severity] }} />
      {SEV_LABEL[severity]}
    </span>
  );
}

export default function HazardDetails({ hazard: h, myPos, nearby, onDirections, onDelete, onClose }: Props) {
  const [place, setPlace] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const img = photoUrl(h);

  useEffect(() => {
    setPlace(null);
    setConfirming(false);
    setImgOk(true);
    if (h.origin === 'sample') return;
    let live = true;
    reverseLabel(h.lat, h.lng).then((l) => live && setPlace(l));
    return () => {
      live = false;
    };
  }, [h.id, h.lat, h.lng, h.origin]);

  const dist = myPos ? haversine(myPos, [h.lat, h.lng]) : null;
  const who = h.origin === 'sample' ? 'Sample data, not a real report' : h.mine ? 'Reported by you' : h.by ? `Reported by ${h.by}` : 'Reported before sign-in existed';

  return (
    <Sheet
      label="Pothole details"
      title={h.potholes > 1 ? `${h.potholes} potholes` : 'Pothole'}
      subtitle={place ?? (h.origin === 'sample' ? 'Sample pin' : `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}`)}
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SeverityChip severity={h.severity} />
        {dist !== null && <span className="rounded-full bg-sunken px-2.5 py-1 text-[13px] text-muted">{formatDistance(dist)} away</span>}
        {h.origin === 'sample' && <span className="rounded-full border border-dashed border-line px-2.5 py-1 text-[13px] text-muted">sample</span>}
      </div>

      {img && imgOk && (
        <img src={img} alt="Photo of the reported pothole" onError={() => setImgOk(false)} className="mb-3 aspect-[4/3] w-full rounded-xl bg-sunken object-cover" />
      )}

      <dl className="space-y-1.5 text-[14px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{who}</dt>
          <dd className="text-muted">{timeAgo(h.createdAt)}</dd>
        </div>
        {h.confidence !== null && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Model confidence</dt>
            <dd className="font-medium text-ink">{Math.round(h.confidence * 100)}%</dd>
          </div>
        )}
        {h.source === 'manual' && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Severity</dt>
            <dd className="text-ink">chosen by the reporter</dd>
          </div>
        )}
        {nearby > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Also reported nearby</dt>
            <dd className="font-medium text-ink">
              {nearby} other {nearby === 1 ? 'report' : 'reports'}
            </dd>
          </div>
        )}
      </dl>
      {h.note && <p className="mt-3 rounded-xl bg-sunken px-3 py-2 text-[14px] text-ink">“{h.note}”</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => onDirections(h)}>
          <CornerUpRight className="h-4 w-4" /> Directions
        </button>
        {h.mine && !confirming && (
          <button className="btn-danger" onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 dark:bg-red-500/10">
          <span className="text-sm text-red-700 dark:text-red-200">Delete this report?</span>
          <span className="flex gap-2">
            <button className="btn-outline px-3 py-1.5" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn px-3 py-1.5 bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(h);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </button>
          </span>
        </div>
      )}
    </Sheet>
  );
}
