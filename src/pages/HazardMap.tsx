import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { Plus, Crosshair, Layers, Flame, ChevronUp, Cloud, HardDrive, RefreshCw } from 'lucide-react';
import L, { GUNTUR, TILE_ATTRIBUTION, TILE_URL } from '../map/leaflet';
import HazardLayer from '../map/HazardLayer';
import { useHazards, addHazard } from '../hazards/store';
import type { Hazard, HazardOrigin } from '../hazards/types';
import type { Severity } from '../detection/postprocess';
import SeverityBadge from '../components/SeverityBadge';
import LocationPicker from '../components/LocationPicker';
import { toast } from '../components/Toaster';

const youIcon = L.divIcon({ className: '', html: '<div class="you-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function LocateButton({ onFound }: { onFound: (p: [number, number]) => void }) {
  const map = useMap();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost absolute right-3 top-3 z-[500] !bg-asphalt-900/90 !px-3 !py-2 text-xs backdrop-blur"
      disabled={busy}
      onClick={() => {
        if (!navigator.geolocation) return toast('Location is not available in this browser', 'error');
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
            onFound(pos);
            map.flyTo(pos, 15);
            setBusy(false);
          },
          () => {
            toast('Could not get your location', 'error');
            setBusy(false);
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }}
    >
      <Crosshair className="h-4 w-4" /> {busy ? 'Locating…' : 'Near me'}
    </button>
  );
}

const ago = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 30) return `${Math.floor(d)} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const ORIGIN_LABEL: Record<HazardOrigin, string> = { sample: 'Sample', local: 'Mine', shared: 'Shared' };

export default function HazardMap() {
  const { hazards, status, refresh } = useHazards();
  const [sev, setSev] = useState<Record<Severity, boolean>>({ low: true, medium: true, high: true });
  const [origins, setOrigins] = useState<Record<HazardOrigin, boolean>>({ sample: true, local: true, shared: true });
  const [days, setDays] = useState<number>(0);
  const [view, setView] = useState<'markers' | 'heat'>('markers');
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [you, setYou] = useState<[number, number] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const cutoff = days ? Date.now() - days * 86400000 : 0;
    return hazards
      .filter((h) => sev[h.severity] && origins[h.origin] && (!cutoff || new Date(h.createdAt).getTime() >= cutoff))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [hazards, sev, origins, days]);

  const counts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0 };
    filtered.forEach((h) => c[h.severity]++);
    return c;
  }, [filtered]);

  const select = (h: Hazard) => {
    setSelected(null);
    setTimeout(() => setSelected(h.id), 0);
    setSheetOpen(false);
  };

  return (
    <section className="relative h-[calc(100dvh-56px-64px)] md:h-[calc(100dvh-56px)] md:p-4">
      <div className="relative flex h-full gap-4">
        {/* PANEL */}
        <aside
          className={`card absolute inset-x-0 bottom-0 z-[600] flex max-h-[70%] flex-col rounded-b-none transition-transform duration-300 md:static md:max-h-none md:w-[360px] md:shrink-0 md:translate-y-0 md:rounded-2xl ${
            sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-64px)]'
          }`}
        >
          <button
            className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3 text-left md:cursor-default"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
          >
            <div>
              <h1 className="text-lg font-semibold">Hazard map</h1>
              <p className="text-xs text-zinc-500">
                {filtered.length} shown · <span className="text-rose-300">{counts.high} high</span> · {counts.medium} medium · {counts.low} low
              </p>
            </div>
            <ChevronUp className={`h-5 w-5 text-zinc-500 transition md:hidden ${sheetOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                status === 'shared' ? 'border-signal/25 bg-signal/5 text-teal-200' : 'border-white/10 bg-white/[.03] text-zinc-400'
              }`}
            >
              {status === 'shared' ? <Cloud className="mt-0.5 h-4 w-4 shrink-0" /> : <HardDrive className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="flex-1">
                {status === 'checking' && 'Connecting to the shared map…'}
                {status === 'shared' && 'Shared map is online. New reports are visible to everyone.'}
                {status === 'local' && 'Shared map not reachable here, so new reports are saved on this device only.'}
              </span>
              <button onClick={refresh} className="text-zinc-500 hover:text-white" aria-label="Refresh reports">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div>
              <span className="label">Severity</span>
              <div className="mt-2 flex gap-1.5">
                {(['high', 'medium', 'low'] as Severity[]).map((s) => (
                  <button
                    key={s}
                    aria-pressed={sev[s]}
                    onClick={() => setSev((v) => ({ ...v, [s]: !v[s] }))}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize ring-1 transition ${
                      sev[s] ? 'bg-white/[.08] text-white ring-white/20' : 'text-zinc-500 ring-white/[.06] line-through'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Source</span>
              <div className="mt-2 flex gap-1.5">
                {(['sample', 'shared', 'local'] as HazardOrigin[]).map((o) => (
                  <button
                    key={o}
                    aria-pressed={origins[o]}
                    onClick={() => setOrigins((v) => ({ ...v, [o]: !v[o] }))}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ring-1 transition ${
                      origins[o] ? 'bg-white/[.08] text-white ring-white/20' : 'text-zinc-500 ring-white/[.06] line-through'
                    }`}
                  >
                    {ORIGIN_LABEL[o]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <label className="flex-1">
                <span className="label">Reported</span>
                <select className="input mt-2 !py-2" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  <option value={0}>Any time</option>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                </select>
              </label>
              <div className="flex-1">
                <span className="label">View</span>
                <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-asphalt-900 p-1">
                  <button onClick={() => setView('markers')} aria-pressed={view === 'markers'} className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold ${view === 'markers' ? 'bg-amber text-asphalt-950' : 'text-zinc-400'}`}>
                    <Layers className="h-3.5 w-3.5" /> Pins
                  </button>
                  <button onClick={() => setView('heat')} aria-pressed={view === 'heat'} className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold ${view === 'heat' ? 'bg-amber text-asphalt-950' : 'text-zinc-400'}`}>
                    <Flame className="h-3.5 w-3.5" /> Heat
                  </button>
                </div>
              </div>
            </div>

            <button className="btn-primary w-full" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Report a hazard
            </button>

            <ul className="space-y-2" aria-label="Hazard list">
              {filtered.slice(0, 150).map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => select(h)}
                    className="w-full rounded-xl border border-white/[.06] bg-asphalt-900/60 p-3 text-left transition hover:border-amber/30 hover:bg-asphalt-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={h.severity} />
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${h.origin === 'sample' ? 'text-zinc-500' : 'text-signal'}`}>
                        {h.origin === 'sample' ? 'sample data' : ORIGIN_LABEL[h.origin]}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-sm text-zinc-200">{h.note || 'Pothole'}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {ago(h.createdAt)} · {h.source}
                      {h.confirmations > 1 ? ` · ${h.confirmations} reports` : ''}
                    </p>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">No hazards match these filters.</li>}
            </ul>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Points marked “sample data” are made-up examples I placed along real roads in Guntur and Vijayawada so the map
              isn&apos;t empty. They are not real reports.
            </p>
          </div>
        </aside>

        {/* MAP */}
        <div className="relative isolate flex-1 overflow-hidden md:rounded-2xl md:border md:border-white/[.08]">
          <MapContainer center={GUNTUR} zoom={12} className="h-full w-full" preferCanvas={false}>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
            <HazardLayer hazards={filtered} view={view} selectedId={selected} />
            {you && <Marker position={you} icon={youIcon} />}
            <LocateButton onFound={setYou} />
          </MapContainer>
          <div className="pointer-events-none absolute bottom-[76px] left-3 z-[500] flex gap-3 rounded-xl bg-asphalt-950/80 px-3 py-2 text-[11px] text-zinc-300 backdrop-blur md:bottom-6">
            {(['high', 'medium', 'low'] as Severity[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5 capitalize">
                <span className={`h-2.5 w-2.5 rounded-full ${s === 'high' ? 'bg-rose-500' : s === 'medium' ? 'bg-orange-400' : 'bg-yellow-400'}`} /> {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {adding && (
        <LocationPicker
          initial={you}
          onCancel={() => setAdding(false)}
          onSave={(r) => {
            addHazard({ lat: r.lat, lng: r.lng, severity: r.severity, note: r.note, confidence: null, source: 'manual' });
            setAdding(false);
            toast(status === 'shared' ? 'Reported. Thanks for keeping roads safe!' : 'Saved on this device', 'success');
          }}
        />
      )}
    </section>
  );
}
