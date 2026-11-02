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

export function toast(text: string, kind: Kind = 'info') {
  const t = { id: nextId++, kind, text };
  listeners.forEach((l) => l(t));
}

const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
const colors = { success: 'text-signal', error: 'text-rose-400', info: 'text-amber' };

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((s) => [...s.slice(-3), t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 4200);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[3000] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {items.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md animate-fade-up items-start gap-2.5 rounded-xl border border-white/10 bg-asphalt-800/95 px-4 py-3 text-sm text-zinc-100 shadow-card backdrop-blur"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colors[t.kind]}`} />
            <span className="flex-1">{t.text}</span>
            <button
              className="text-zinc-500 hover:text-zinc-200"
              onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
