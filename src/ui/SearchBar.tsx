import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, CornerUpRight, Loader2, Search, X } from 'lucide-react';
import type { Place } from '../geo/services';
import type { LatLng } from '../geo/geo';
import { usePlaceSearch } from './usePlaceSearch';
import PlaceList from './PlaceList';
import Logo from './Logo';

interface Props {
  near: LatLng | null;
  selected: Place | null;
  onSelect: (p: Place) => void;
  onClear: () => void;
  onDirections: () => void;
  avatar: ReactNode;
}

export default function SearchBar({ near, selected, onSelect, onClear, onDirections, avatar }: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading, error, submit } = usePlaceSearch(text, near, focused);

  useEffect(() => setText(selected ? selected.label : ''), [selected]);
  useEffect(() => setActive(-1), [results]);

  const pick = (p: Place) => {
    setFocused(false);
    inputRef.current?.blur();
    onSelect(p);
  };

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && results[active]) return pick(results[active]);
    const r = await submit();
    if (r.length) pick(r[0]);
  };

  const open = focused && text.trim().length >= 3;

  return (
    <div className="relative w-full md:w-[400px]">
      <form
        onSubmit={onSubmit}
        role="search"
        className={`flex h-12 items-center gap-1 bg-raised pl-2 pr-1.5 shadow-float transition-[border-radius] ${open ? 'rounded-t-3xl' : 'rounded-full'}`}
      >
        {focused ? (
          <button type="button" className="rounded-full p-2 text-muted hover:bg-sunken" onMouseDown={(e) => e.preventDefault()} onClick={() => inputRef.current?.blur()} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="px-1.5">
            <Logo size={26} />
          </span>
        )}
        <label htmlFor="place-search" className="sr-only">
          Search for a place
        </label>
        <input
          ref={inputRef}
          id="place-search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search Safe Roads"
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-muted focus:outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-faint" aria-label="Searching" />}
        {text && (
          <button
            type="button"
            className="rounded-full p-2 text-muted hover:bg-sunken"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText('');
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {!text && !focused && (
          <button type="submit" className="hidden rounded-full p-2 text-muted hover:bg-sunken md:block" aria-label="Search">
            <Search className="h-5 w-5" />
          </button>
        )}
        <span className="mx-0.5 h-6 w-px bg-line" />
        <button type="button" onClick={onDirections} className="rounded-full p-2 text-brand-600 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-white/5" aria-label="Directions" title="Directions">
          <CornerUpRight className="h-5 w-5" />
        </button>
        <span className="md:hidden">{avatar}</span>
      </form>
      {open && (
        <div className="absolute inset-x-0 top-12 z-10 max-h-[60dvh] overflow-y-auto rounded-b-3xl border-t border-line bg-raised pb-2 shadow-float">
          {results.length > 0 && <PlaceList places={results} onPick={pick} activeIndex={active} />}
          {!loading && !results.length && (
            <p className="px-4 py-3 text-sm text-muted">{error ?? 'No suggestions yet. Press Enter to search.'}</p>
          )}
          {loading && !results.length && <p className="px-4 py-3 text-sm text-muted">Searching…</p>}
          <p className="px-4 pt-1 text-[11px] text-faint">Search by Photon &amp; Nominatim · © OpenStreetMap contributors</p>
        </div>
      )}
    </div>
  );
}
