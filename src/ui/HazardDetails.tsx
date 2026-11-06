import { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, CornerUpRight, Flag, Loader2, Trash2, Undo2 } from 'lucide-react';
import type { Hazard } from '../hazards/types';
import { photoUrl } from '../hazards/types';
import { kindLabel } from '../hazards/kinds';
import { trustLine } from '../hazards/trust';
import { FLAG_REASONS } from '../hazards/flagReasons';
import { SEV_COLOR, SEV_LABEL } from '../map/markers';
import { formatDistance, haversine, type LatLng } from '../geo/geo';
import { reverseLabel } from '../geo/services';
import { timeAgo } from '../lib/format';
import Sheet from './Sheet';

interface Props {
  hazard: Hazard;
  myPos: LatLng | null;
  nearby: number; // other reports within 15 m
  signedIn: boolean;
  onDirections: (h: Hazard) => void;
  onDelete: (h: Hazard) => Promise<void>;
  onVote: (h: Hazard, vote: 'confirm' | 'fixed' | 'flag' | 'clear', reason?: string) => Promise<void>;
  onNeedSignIn: () => void;
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

export default function HazardDetails({ hazard: h, myPos, nearby, signedIn, onDirections, onDelete, onVote, onNeedSignIn, onClose }: Props) {
  const [place, setPlace] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [imgOk, setImgOk] = useState(true);
  const img = photoUrl(h);

  useEffect(() => {
    setPlace(null);
    setConfirming(false);
    setFlagging(false);
    setImgOk(true);
    let live = true;
    reverseLabel(h.lat, h.lng).then((l) => live && setPlace(l));
    return () => {
      live = false;
    };
  }, [h.id, h.lat, h.lng]);

  const dist = myPos ? haversine(myPos, [h.lat, h.lng]) : null;
  const run = async (key: string, vote: 'confirm' | 'fixed' | 'flag' | 'clear', reason?: string) => {
    if (!signedIn) return onNeedSignIn();
    setBusy(key);
    try {
      await onVote(h, vote, reason);
      setFlagging(false);
    } finally {
      setBusy(null);
    }
  };
  const fixed = h.status === 'resolved';
  const kind = kindLabel(h.type);

  return (
    <Sheet
      label={`${kind} details`}
      title={h.type === 'pothole' && h.potholes > 1 ? `${h.potholes} potholes` : kind}
      subtitle={place ?? `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}`}
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SeverityChip severity={h.severity} />
        {fixed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[13px] font-medium text-green-800 dark:bg-green-500/20 dark:text-green-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Fixed
          </span>
        ) : h.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[13px] font-medium text-brand-700 dark:bg-brand-600/20 dark:text-brand-200">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        ) : null}
        {dist !== null && <span className="rounded-full bg-sunken px-2.5 py-1 text-[13px] text-muted">{formatDistance(dist)} away</span>}
      </div>

      {img && imgOk && (
        <img src={img} alt={`Photo of the reported ${kind.toLowerCase()}`} onError={() => setImgOk(false)} className="mb-3 aspect-[16/10] w-full rounded-xl bg-sunken object-cover" />
      )}

      <dl className="space-y-1.5 text-[14px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{h.mine ? 'Reported by you' : 'Reported by a community member'}</dt>
          <dd className="text-muted">{timeAgo(h.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Community check</dt>
          <dd className="text-right font-medium text-ink">{trustLine(h)}</dd>
        </div>
        {h.confidence !== null && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Model confidence</dt>
            <dd className="font-medium text-ink">{Math.round(h.confidence * 100)}%</dd>
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

      {!h.mine && (
        <div className="mt-4 rounded-xl border border-line p-3">
          <p className="text-[13px] font-medium text-ink">Have you seen this one?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className={h.myVote === 'confirm' ? 'btn-primary' : 'btn-outline'}
              aria-pressed={h.myVote === 'confirm'}
              disabled={busy !== null}
              onClick={() => run('confirm', h.myVote === 'confirm' ? 'clear' : 'confirm')}
            >
              {busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Still there
            </button>
            <button
              className={h.myVote === 'fixed' ? 'btn-primary' : 'btn-outline'}
              aria-pressed={h.myVote === 'fixed'}
              disabled={busy !== null}
              onClick={() => run('fixed', h.myVote === 'fixed' ? 'clear' : 'fixed')}
            >
              {busy === 'fixed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} It's fixed
            </button>
          </div>
          {!signedIn && <p className="mt-2 text-[12px] text-muted">Sign in to confirm or flag reports. Two different people are needed to verify or close one.</p>}
        </div>
      )}
      {h.mine && !fixed && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line p-3">
          <span className="text-[13px] text-muted">Got repaired? Say so, a second person closes it.</span>
          <button className={h.myVote === 'fixed' ? 'btn-primary' : 'btn-outline'} disabled={busy !== null} onClick={() => run('fixed', h.myVote === 'fixed' ? 'clear' : 'fixed')}>
            {h.myVote === 'fixed' ? <Undo2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {h.myVote === 'fixed' ? 'Undo' : "It's fixed"}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => onDirections(h)}>
          <CornerUpRight className="h-4 w-4" /> Directions
        </button>
        {h.mine && !confirming && (
          <button className="btn-danger" onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
        {!h.mine && !flagging && (
          <button className="btn-outline" onClick={() => (signedIn ? setFlagging(true) : onNeedSignIn())}>
            <Flag className="h-4 w-4" /> Report a problem
          </button>
        )}
      </div>

      {flagging && (
        <div className="mt-3 rounded-xl bg-sunken p-3" role="group" aria-label="What is wrong with this report?">
          <p className="text-sm font-medium text-ink">What is wrong with this report?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FLAG_REASONS.map((r) => (
              <button key={r.id} className="btn-outline px-3 py-1.5" disabled={busy !== null} onClick={() => run('flag', 'flag', r.id)}>
                {busy === 'flag' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {r.label}
              </button>
            ))}
          </div>
          <button className="mt-2 text-sm text-muted hover:underline" onClick={() => setFlagging(false)}>
            Cancel
          </button>
          <p className="mt-1 text-[12px] text-muted">Enough flags from different people hide a report until a moderator has looked at it.</p>
        </div>
      )}

      {confirming && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 dark:bg-red-500/10">
          <span className="text-sm text-red-700 dark:text-red-200">Delete this report?</span>
          <span className="flex gap-2">
            <button className="btn-outline px-3 py-1.5" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Cancel
            </button>
            <button
              className="btn px-3 py-1.5 bg-red-600 text-white hover:bg-red-700"
              disabled={busy !== null}
              onClick={async () => {
                setBusy('delete');
                try {
                  await onDelete(h);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === 'delete' && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </button>
          </span>
        </div>
      )}
    </Sheet>
  );
}
