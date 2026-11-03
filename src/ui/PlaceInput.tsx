import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Place } from '../geo/services';
import type { LatLng } from '../geo/geo';
import { usePlaceSearch } from './usePlaceSearch';
import PlaceList from './PlaceList';

interface Props {
  id: string;
  label: string;
  value: Place | null;
  near: LatLng | null;
  placeholder: string;
  onChange: (p: Place | null) => void;
  autoFocus?: boolean;
  icon: React.ReactNode;
}

export default function PlaceInput({ id, label, value, near, placeholder, onChange, autoFocus, icon }: Props) {
  const [text, setText] = useState(value?.label ?? '');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const { results, loading, error, submit } = usePlaceSearch(text, near, focused);

  useEffect(() => setText(value?.label ?? ''), [value]);

  const pick = (p: Place) => {
    onChange(p);
    setFocused(false);
    ref.current?.blur();
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
        {icon}
        <input
          ref={ref}
          id={id}
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const r = await submit();
              if (r.length) pick(r[0]);
            }
          }}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-faint" />}
        {text && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText('');
              onChange(null);
              ref.current?.focus();
            }}
            className="-mr-1 rounded-full p-1.5 text-muted hover:bg-sunken"
            aria-label={`Clear ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {focused && text.trim().length >= 3 && !value && (
        <div className="absolute inset-x-0 top-12 z-20 max-h-72 overflow-y-auto rounded-xl bg-raised shadow-float">
          {results.length ? (
            <PlaceList places={results} onPick={pick} />
          ) : (
            <p className="px-4 py-3 text-sm text-muted">{loading ? 'Searching…' : error ?? 'No suggestions yet. Press Enter to search.'}</p>
          )}
        </div>
      )}
    </div>
  );
}
