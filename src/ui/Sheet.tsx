// One panel component for everything that opens over the map.
// Phone: a bottom sheet (tap or drag the handle down to shrink it, again to close).
// Desktop (md and up): a panel on the left under the search bar, like Google Maps.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  label: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  leading?: ReactNode; // e.g. a back button
  mobileMax?: string; // max height on phones, as a Tailwind class
}

export default function Sheet({ label, title, subtitle, onClose, children, footer, leading, mobileMax = 'max-h-[72dvh]' }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => (startY.current = e.touches[0].clientY);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    if (dy > 50) {
      if (collapsed) onClose?.();
      else setCollapsed(true);
    } else if (dy < -40) setCollapsed(false);
  };

  return (
    <section
      aria-label={label}
      className={`fixed inset-x-0 bottom-0 z-[1100] flex ${mobileMax} animate-sheet-up flex-col rounded-t-[22px] bg-surface shadow-sheet md:absolute md:inset-x-auto md:bottom-auto md:left-3 md:top-[76px] md:max-h-[calc(100%-88px)] md:w-[400px] md:animate-panel-in md:rounded-2xl md:shadow-panel`}
    >
      <div className="md:hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          className="flex w-full justify-center pb-1 pt-2.5"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand panel' : 'Shrink panel'}
          aria-expanded={!collapsed}
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </button>
      </div>
      {(title || onClose) && (
        <header
          className="flex items-start gap-2 px-4 pb-2 pt-1 md:pt-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {leading}
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[19px] font-semibold leading-tight text-ink">{title}</h2>}
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          {onClose && (
            <button onClick={onClose} className="-mr-1 rounded-full p-2 text-muted hover:bg-sunken" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </header>
      )}
      <div className={`${collapsed ? 'hidden md:block' : ''} min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-thin`}>
        {children}
      </div>
      {footer && (
        <div className={`${collapsed ? 'hidden md:block' : ''} border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]`}>
          {footer}
        </div>
      )}
      {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
    </section>
  );
}
