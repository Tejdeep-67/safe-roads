import { Loader2 } from 'lucide-react';
import { DEFAULT_FILTERS, isDefault, type MapFilters } from '../hazards/filters';
import { KINDS, TYPE_ORDER } from '../hazards/kinds';
import type { HazardType } from '../hazards/types';
import Sheet from './Sheet';

export type OsmStatus = 'idle' | 'zoom' | 'loading' | 'ok' | 'error';

interface Props {
  filters: MapFilters;
  counts: Record<HazardType, number>;
  osm: { status: OsmStatus; count?: number };
  onChange: (f: MapFilters) => void;
  onClose: () => void;
}

function Check({ checked, onChange, children, hint }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{children}</span>
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default function LayersPanel({ filters, counts, osm, onChange, onClose }: Props) {
  const toggleType = (t: HazardType, on: boolean) => {
    const types = on ? [...filters.types, t] : filters.types.filter((x) => x !== t);
    onChange({ ...filters, types: types.length ? types : filters.types }); // keep at least one
  };
  const osmHint =
    osm.status === 'zoom'
      ? 'Zoom in a little to see them.'
      : osm.status === 'loading'
        ? 'Loading…'
        : osm.status === 'error'
          ? "Couldn't load them right now, try again in a moment."
          : osm.status === 'ok'
            ? osm.count
              ? `${osm.count} in this view. Grey squares on the map.`
              : 'None recorded in OpenStreetMap in this view (coverage varies by area).'
            : 'Speed bumps and humps that mapmakers recorded in OpenStreetMap. Not Safe Roads reports.';
  return (
    <Sheet label="Layers and filters" title="Layers & filters" subtitle="Choose what the map shows" onClose={onClose}>
      <fieldset>
        <legend className="field-label">Community reports</legend>
        {TYPE_ORDER.map((t) => (
          <Check key={t} checked={filters.types.includes(t)} onChange={(v) => toggleType(t, v)} hint={KINDS[t].hint}>
            {KINDS[t].label} <span className="text-muted">· {counts[t] ?? 0}</span>
          </Check>
        ))}
        <Check checked={filters.verifiedOnly} onChange={(v) => onChange({ ...filters, verifiedOnly: v })} hint="Confirmed by at least two different people.">
          Only verified reports
        </Check>
        <Check checked={filters.showFixed} onChange={(v) => onChange({ ...filters, showFixed: v })} hint="Faded pins for reports the community says were repaired.">
          Show fixed reports
        </Check>
      </fieldset>
      <fieldset className="mt-3 border-t border-line pt-3">
        <legend className="field-label">Other data</legend>
        <Check checked={filters.roadFeatures} onChange={(v) => onChange({ ...filters, roadFeatures: v })} hint={osmHint}>
          Road bumps from OpenStreetMap {osm.status === 'loading' && <Loader2 className="inline h-3.5 w-3.5 animate-spin" />}
        </Check>
      </fieldset>
      <div className="mt-3 flex gap-2">
        <button className="btn-outline" disabled={isDefault(filters)} onClick={() => onChange(DEFAULT_FILTERS)}>
          Reset
        </button>
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
