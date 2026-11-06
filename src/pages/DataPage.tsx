// Open data page for councils, road authorities, researchers and journalists:
// live numbers from the reports, a download builder for the feed, and the API in short.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Download, Loader2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { KINDS, TYPE_ORDER } from '../hazards/kinds';
import type { HazardType } from '../hazards/types';
import { cleanBbox, DEFAULT_QUERY, feedPath, type FeedFormat, type FeedQuery } from '../lib/feedUrl';
import { toast } from '../ui/Toaster';

interface Stats {
  total: number;
  verified: number;
  by_status: { open: number; resolved: number; stale: number };
  by_type: Record<HazardType, number>;
  by_severity: { low: number; medium: number; high: number };
  resolved_share: number | null;
  weekly: { week_start: string; reported: number }[];
  hotspots: { lat: number; lng: number; open_reports: number; high_severity: number; verified: number }[];
  hotspot_rule: string;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-raised p-4 shadow-float">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-none text-ink">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-[14px]">
          <span className="w-40 shrink-0 truncate text-ink">{r.label}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="w-8 shrink-0 text-right tabular-nums text-muted">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DataPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState<FeedQuery>(DEFAULT_QUERY);
  const [bboxText, setBboxText] = useState('');
  const [match, setMatch] = useState<number | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    document.title = 'Open data · Safe Roads';
    api<Stats>('/api/stats').then(setStats, (e: ApiError) => setError(e.message));
  }, []);

  const query = useMemo<FeedQuery>(() => ({ ...q, bbox: cleanBbox(bboxText) }), [q, bboxText]);
  const bboxBad = bboxText.trim() !== '' && cleanBbox(bboxText) === '';
  const path = (f: FeedFormat) => feedPath(f, query);

  // how many reports match the current choices (the feed sends the total in a header)
  useEffect(() => {
    if (bboxBad) return;
    setMatch(null);
    const t = setTimeout(() => {
      fetch(feedPath('json', query, 1))
        .then((r) => (r.ok ? Number(r.headers.get('x-total-count')) : null))
        .then((n) => setMatch(Number.isFinite(n) ? n : null))
        .catch(() => setMatch(null));
    }, 300);
    return () => clearTimeout(t);
  }, [query, bboxBad]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const copy = async (f: FeedFormat) => {
    try {
      await navigator.clipboard.writeText(origin + path(f));
      toast('Link copied.', 'success');
    } catch {
      toast('Could not copy, select the link and copy it.', 'error');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-full p-2 hover:bg-sunken" aria-label="Back to the map">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[18px] font-semibold leading-tight">Open data</h1>
            <p className="text-[13px] text-muted">Community road hazard reports, free to use with credit (CC BY 4.0)</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <section aria-labelledby="now">
          <h2 id="now" className="mb-3 text-[16px] font-semibold">Right now</h2>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
          {!stats && !error && <p className="flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading numbers…</p>}
          {stats && stats.total === 0 && (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-[15px] text-muted">
              No reports yet. Nothing is shown here until people start reporting, and nothing is made up to fill the gap.
            </p>
          )}
          {stats && stats.total > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Reports" value={stats.total} hint="all time, in the feed" />
                <Stat label="Open" value={stats.by_status.open} />
                <Stat label="Verified by 2+ people" value={stats.verified} />
                <Stat label="Marked fixed" value={stats.by_status.resolved} hint={stats.resolved_share === null ? undefined : `${stats.resolved_share}% of all reports`} />
              </div>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-[14px] font-semibold">By kind</h3>
                  <Bars rows={TYPE_ORDER.map((t) => ({ label: KINDS[t].label, value: stats.by_type[t] ?? 0 }))} />
                  <h3 className="mb-2 mt-4 text-[14px] font-semibold">By severity</h3>
                  <Bars rows={[{ label: 'Minor', value: stats.by_severity.low }, { label: 'Moderate', value: stats.by_severity.medium }, { label: 'Severe', value: stats.by_severity.high }]} />
                </div>
                <div>
                  <h3 className="mb-2 text-[14px] font-semibold">New reports per week (last 12 weeks)</h3>
                  <Bars rows={stats.weekly.map((w) => ({ label: w.week_start, value: w.reported }))} />
                </div>
              </div>
              <h3 className="mb-1 mt-6 text-[14px] font-semibold">Hotspots</h3>
              <p className="mb-2 text-[13px] text-muted">A hotspot is: {stats.hotspot_rule}.</p>
              {stats.hotspots.length === 0 ? (
                <p className="text-[14px] text-muted">No spot has two or more open reports yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-[14px]">
                    <thead className="bg-sunken text-[13px] text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Open reports</th>
                        <th className="px-3 py-2 font-medium">Severe</th>
                        <th className="px-3 py-2 font-medium">Verified</th>
                        <th className="px-3 py-2 font-medium">Centre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.hotspots.map((h) => (
                        <tr key={`${h.lat},${h.lng}`} className="border-t border-line">
                          <td className="px-3 py-2 font-medium tabular-nums">{h.open_reports}</td>
                          <td className="px-3 py-2 tabular-nums">{h.high_severity}</td>
                          <td className="px-3 py-2 tabular-nums">{h.verified}</td>
                          <td className="px-3 py-2">
                            <Link className="text-brand-600 hover:underline dark:text-brand-200" to={`/?lat=${h.lat}&lng=${h.lng}&z=17`}>
                              {h.lat.toFixed(4)}, {h.lng.toFixed(4)}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="dl">
          <h2 id="dl" className="mb-1 text-[16px] font-semibold">Download</h2>
          <p className="mb-3 text-[14px] text-muted">Pick what you need. Every choice becomes part of the link, so you can paste it into QGIS, Excel, Google Sheets or a script.</p>
          <div className="space-y-4 rounded-2xl border border-line p-4">
            <fieldset>
              <legend className="field-label">Kinds</legend>
              <div className="flex flex-wrap gap-2">
                {TYPE_ORDER.map((t) => (
                  <button key={t} aria-pressed={q.types.includes(t)} onClick={() => setQ({ ...q, types: toggle(q.types, t) })} className={`rounded-full border px-3 py-1.5 text-sm ${q.types.includes(t) ? 'border-transparent bg-brand-600 text-white' : 'border-line hover:bg-sunken'}`}>
                    {KINDS[t].label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[12px] text-muted">None selected means all kinds.</p>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">Status</span>
                <select className="input" value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value as FeedQuery['status'] })}>
                  <option value="open">Open</option>
                  <option value="resolved">Fixed</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className="block">
                <span className="field-label">Changed since</span>
                <input className="input" type="date" value={q.since} onChange={(e) => setQ({ ...q, since: e.target.value })} />
              </label>
              <label className="flex items-end gap-2 pb-3">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={q.verifiedOnly} onChange={(e) => setQ({ ...q, verifiedOnly: e.target.checked })} />
                <span className="text-[15px]">Verified only</span>
              </label>
            </div>
            <label className="block">
              <span className="field-label">Area (optional): west, south, east, north</span>
              <input className="input" inputMode="decimal" placeholder="80.35, 16.25, 80.50, 16.37" value={bboxText} onChange={(e) => setBboxText(e.target.value)} aria-invalid={bboxBad} />
              {bboxBad && <span className="mt-1 block text-[13px] text-red-600">Four numbers: west, south, east, north (longitude, latitude).</span>}
            </label>
            <p className="text-[14px]" aria-live="polite">
              {bboxBad ? '' : match === null ? 'Counting…' : <><strong>{match}</strong> {match === 1 ? 'report matches' : 'reports match'}.</>}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['geojson', 'csv', 'json'] as FeedFormat[]).map((f) => (
                <div key={f} className="flex items-center gap-1">
                  <a className="btn-primary flex-1" href={bboxBad ? undefined : path(f)} download aria-disabled={bboxBad}>
                    <Download className="h-4 w-4" /> {f === 'geojson' ? 'GeoJSON' : f.toUpperCase()}
                  </a>
                  <button className="btn-outline px-3" onClick={() => copy(f)} aria-label={`Copy the ${f} link`} disabled={bboxBad}>
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <code className="block break-all rounded-lg bg-sunken p-2 text-[12px] text-muted">{origin}{path('geojson')}</code>
          </div>
        </section>

        <section aria-labelledby="api" className="text-[14px]">
          <h2 id="api" className="mb-2 text-[16px] font-semibold">The API in short</h2>
          <ul className="space-y-2 text-muted">
            <li><code className="text-ink">GET /api/feed/geojson</code>, <code className="text-ink">/csv</code>, <code className="text-ink">/json</code>: hazards, filters <code>bbox</code>, <code>type</code>, <code>severity</code>, <code>status</code>, <code>verified</code>, <code>since</code>, <code>limit</code> (up to 5000).</li>
            <li><code className="text-ink">GET /api/stats</code>: the numbers above as JSON.</li>
            <li>No key needed. Browsers can call it from any site (CORS). Answers are cached for a minute and support <code>ETag</code>, so poll politely: 120 requests per 5 minutes per address.</li>
          </ul>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-sunken p-3 text-[12px] text-ink">{`curl "${origin}/api/feed/geojson?type=pothole&verified=1" -o potholes.geojson`}</pre>
          <p className="mt-3 text-muted">
            Privacy: the feed has location, kind, severity, status and how many people agree. It has no names, accounts, photos, free-text notes or exact times (minutes only). Reports flagged by the community are left out.
            Positions are rounded to about 1 metre. Votes are not location-checked, so treat "verified" as "two different accounts agree", not as an inspection.
          </p>
          <p className="mt-2 text-muted">
            Licence: <a className="text-brand-600 hover:underline dark:text-brand-200" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Please credit "Safe Roads community reports (thesaferoads.netlify.app)".
          </p>
        </section>
      </main>
    </div>
  );
}
