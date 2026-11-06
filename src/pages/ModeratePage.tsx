// Moderator queue: reports that people flagged. Only accounts listed in MODERATOR_EMAILS can open it.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { kindLabel } from '../hazards/kinds';
import { photoUrl, type Hazard } from '../hazards/types';
import { SEV_LABEL } from '../map/markers';
import { timeAgo } from '../lib/format';
import { toast } from '../ui/Toaster';

type Item = Hazard & { flags: number; reasons: Record<string, number>; hidden: boolean; reviewed: boolean; resolvedNote: string | null };
const REASON: Record<string, string> = { fake: "isn't real", wrong_place: 'wrong place', spam: 'spam', offensive: 'offensive', other: 'other' };

export default function ModeratePage() {
  const { user, status } = useAuth();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ queue: Item[] }>('/api/moderation').then((r) => setQueue(r.queue), (e: ApiError) => setError(e.message));
  }, []);
  useEffect(() => {
    document.title = 'Moderation · Safe Roads';
    if (status === 'ready' && user) load();
  }, [status, user, load]);

  const act = async (id: string, action: 'approve' | 'remove' | 'resolve' | 'reopen') => {
    setBusy(id + action);
    try {
      await api(`/api/moderation/${encodeURIComponent(id)}`, { method: 'POST', json: { action } });
      toast(action === 'remove' ? 'Removed.' : 'Done.', 'success');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-full p-2 hover:bg-sunken" aria-label="Back to the map">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[18px] font-semibold leading-tight">Moderation</h1>
            <p className="text-[13px] text-muted">Reports that people flagged. Three different flags hide a report from everyone else.</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {status === 'ready' && !user && <p className="text-muted">Sign in with a moderator account on the map first.</p>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
        {user && !queue && !error && <p className="flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
        {queue && queue.length === 0 && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nothing waiting. No report has been flagged.</p>}
        <ul className="space-y-4">
          {queue?.map((h) => {
            const img = photoUrl(h);
            return (
              <li key={h.id} className="rounded-2xl border border-line p-4">
                <div className="flex gap-3">
                  {img && <img src={img} alt="" className="h-24 w-24 shrink-0 rounded-xl bg-sunken object-cover" loading="lazy" />}
                  <div className="min-w-0 flex-1 text-[14px]">
                    <p className="font-medium">
                      {SEV_LABEL[h.severity]} {kindLabel(h.type).toLowerCase()}
                      {h.hidden && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-500/20 dark:text-red-200">hidden</span>}
                      {h.status === 'resolved' && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-500/20 dark:text-green-200">fixed</span>}
                    </p>
                    <p className="text-muted">{timeAgo(h.createdAt)} · <Link className="text-brand-600 hover:underline dark:text-brand-200" to={`/?lat=${h.lat}&lng=${h.lng}&z=18`}>{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</Link></p>
                    <p className="text-muted">
                      {h.flags} {h.flags === 1 ? 'flag' : 'flags'}: {Object.entries(h.reasons).map(([k, n]) => `${REASON[k] ?? k} ×${n}`).join(', ') || '—'}
                    </p>
                    {h.note && <p className="mt-1 rounded-lg bg-sunken px-2 py-1">“{h.note}”</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-outline" disabled={busy !== null} onClick={() => act(h.id, 'approve')}>{busy === h.id + 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Looks fine, keep it</button>
                  {h.status === 'resolved' ? (
                    <button className="btn-outline" disabled={busy !== null} onClick={() => act(h.id, 'reopen')}><RotateCcw className="h-4 w-4" /> Reopen</button>
                  ) : (
                    <button className="btn-outline" disabled={busy !== null} onClick={() => act(h.id, 'resolve')}><CheckCircle2 className="h-4 w-4" /> Mark fixed</button>
                  )}
                  <button className="btn-danger" disabled={busy !== null} onClick={() => confirm('Delete this report and its photo?') && act(h.id, 'remove')}><Trash2 className="h-4 w-4" /> Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
