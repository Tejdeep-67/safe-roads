import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Info, ListChecks, LogIn, LogOut, Moon, ScanSearch, Sun, UserRound } from 'lucide-react';
import type { User } from '../auth/AuthProvider';

interface Props {
  user: User | null;
  dark: boolean;
  showSamples: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onMyReports: () => void;
  onAbout: () => void;
  onToggleDark: () => void;
  onToggleSamples: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export default function AccountMenu(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={p.user ? `Account: ${p.user.name}` : 'Account and menu'}
        className="flex h-9 w-9 items-center justify-center rounded-full md:h-12 md:w-12 md:bg-raised md:shadow-float"
      >
        {p.user ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[13px] font-semibold text-white md:h-9 md:w-9">
            {initials(p.user.name)}
          </span>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken text-muted md:h-9 md:w-9">
            <UserRound className="h-5 w-5" />
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-[1300] w-72 animate-pop-in overflow-hidden rounded-2xl bg-raised py-1 shadow-float md:top-14">
          {p.user ? (
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">{initials(p.user.name)}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{p.user.name}</span>
                <span className="block truncate text-sm text-muted">{p.user.email}</span>
              </span>
            </div>
          ) : (
            <button role="menuitem" className="menu-item font-medium text-brand-600 dark:text-brand-200" onClick={run(p.onSignIn)}>
              <LogIn className="h-5 w-5" /> Sign in
            </button>
          )}
          {p.user && (
            <button role="menuitem" className="menu-item" onClick={run(p.onMyReports)}>
              <ListChecks className="h-5 w-5 text-muted" /> My reports
            </button>
          )}
          <Link role="menuitem" to="/detect" className="menu-item" onClick={() => setOpen(false)}>
            <ScanSearch className="h-5 w-5 text-muted" /> Detection demo
          </Link>
          <button role="menuitemcheckbox" aria-checked={p.dark} className="menu-item" onClick={run(p.onToggleDark)}>
            {p.dark ? <Sun className="h-5 w-5 text-muted" /> : <Moon className="h-5 w-5 text-muted" />} {p.dark ? 'Light map' : 'Dark map'}
          </button>
          <button role="menuitemcheckbox" aria-checked={p.showSamples} className="menu-item" onClick={run(p.onToggleSamples)}>
            {p.showSamples ? <EyeOff className="h-5 w-5 text-muted" /> : <Eye className="h-5 w-5 text-muted" />}
            {p.showSamples ? 'Hide sample pins' : 'Show sample pins'}
          </button>
          <button role="menuitem" className="menu-item" onClick={run(p.onAbout)}>
            <Info className="h-5 w-5 text-muted" /> About Safe Roads
          </button>
          {p.user && (
            <button role="menuitem" className="menu-item border-t border-line" onClick={run(p.onSignOut)}>
              <LogOut className="h-5 w-5 text-muted" /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
