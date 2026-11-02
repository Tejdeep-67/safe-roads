import type { Severity } from '../detection/postprocess';

const styles: Record<Severity, string> = {
  low: 'bg-yellow-400/10 text-yellow-300 ring-yellow-400/30',
  medium: 'bg-orange-400/10 text-orange-300 ring-orange-400/30',
  high: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${styles[severity]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}
