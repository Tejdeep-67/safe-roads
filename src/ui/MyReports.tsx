import { kindLabel } from '../hazards/kinds';
import { useEffect, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { deleteHazard, refreshHazards } from '../hazards/store';
import type { Hazard } from '../hazards/types';
import { photoUrl } from '../hazards/types';
import { SEV_COLOR, SEV_LABEL } from '../map/markers';
import { formatDistance, haversine, type LatLng } from '../geo/geo';
import { timeAgo } from '../lib/format';
import { toast } from './Toaster';
import Sheet from './Sheet';

interface Props {
  mine: Hazard[];
  myPos: LatLng | null;
  onOpen: (h: Hazard) => void;
  onReport: () => void;
  onClose: () => void;
}

export default function MyReports({ mine, myPos, onOpen, onReport, onClose }: Props) {
  const { user, deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [delAccount, setDelAccount] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    refreshHazards();
  }, []);

  const list = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const remove = async (h: Hazard) => {
    setBusy(h.id);
    try {
      await deleteHazard(h.id);
      toast('Report deleted.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <Sheet label="My reports" title="My reports" subtitle={user ? `${list.length} report${list.length === 1 ? '' : 's'} by ${user.name}` : undefined} onClose={onClose}>
      {list.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[15px] text-muted">You haven't reported any hazards yet.</p>
          <button className="btn-primary mt-4" onClick={onReport}>
            <Camera className="h-4 w-4" /> Report a hazard
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((h) => {
            const img = photoUrl(h);
            return (
              <li key={h.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(h)}>
                    {img ? (
                      <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-sunken object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-sunken">
                        <span className="h-4 w-4 rounded-full" style={{ background: SEV_COLOR[h.severity] }} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium text-ink">
                        {SEV_LABEL[h.severity]} {kindLabel(h.type).toLowerCase()}{h.potholes > 1 ? ` ×${h.potholes}` : ''}
                      </span>
                      <span className="block truncate text-[13px] text-muted">
                        {h.status === 'resolved' ? 'Fixed · ' : h.verified ? `Verified by ${h.confirmations} · ` : 'Not yet confirmed · '}
                        {timeAgo(h.createdAt)}
                        {myPos ? ` · ${formatDistance(haversine(myPos, [h.lat, h.lng]))} away` : ''}
                        {h.note ? ` · ${h.note}` : ''}
                      </span>
                    </span>
                  </button>
                  {confirm === h.id ? (
                    <span className="flex shrink-0 gap-1">
                      <button className="btn-outline px-3 py-1.5" onClick={() => setConfirm(null)}>
                        Keep
                      </button>
                      <button className="btn bg-red-600 px-3 py-1.5 text-white hover:bg-red-700" onClick={() => remove(h)} disabled={busy === h.id}>
                        {busy === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                      </button>
                    </span>
                  ) : (
                    <button className="shrink-0 rounded-full p-2 text-muted hover:bg-sunken hover:text-red-600" onClick={() => setConfirm(h.id)} aria-label="Delete report">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 border-t border-line pt-4">
        {!delAccount ? (
          <button className="text-sm text-muted hover:text-red-600" onClick={() => setDelAccount(true)}>
            Delete my account
          </button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              setBusy('account');
              try {
                const n = await deleteAccount(pw);
                toast(`Account deleted${n ? ` with ${n} report${n > 1 ? 's' : ''}` : ''}.`, 'success');
                refreshHazards();
                onClose();
              } catch (e2) {
                setErr((e2 as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            <p className="text-sm text-ink">This deletes your account, all your reports and your confirmations of other people's reports. Enter your password to confirm.</p>
            <input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" required />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-outline" onClick={() => setDelAccount(false)}>
                Cancel
              </button>
              <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={busy === 'account'}>
                {busy === 'account' && <Loader2 className="h-4 w-4 animate-spin" />} Delete account
              </button>
            </div>
          </form>
        )}
      </div>
    </Sheet>
  );
}
