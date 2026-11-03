import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

let nextId = 1;
const listeners = new Set<(t: Toast) => void>();

// eslint-disable-next-line react-refresh/only-export-components
export function toast(text: string, kind: Kind = 'info') {
  const t = { id: nextId++, kind, text };
  listeners.forEach((l) => l(t));
}

const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
const colors = { success: 'text-emerald-400', error: 'text-red-400', info: 'text-brand-200' };

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((s) => [...s.slice(-2), t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.kind === 'error' ? 6000 : 3800);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[72px] z-[3000] flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-8"
      aria-live="polite"
    >
      {items.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-2.5 rounded-xl bg-[#1f2328] px-4 py-3 text-sm text-white shadow-float"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colors[t.kind]}`} />
            <span className="flex-1 leading-snug">{t.text}</span>
            <button className="-m-1 p-1 text-white/60 hover:text-white" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
