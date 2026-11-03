import { AlertTriangle, CheckCircle2, Volume2, VolumeX, X } from 'lucide-react';
import type { DriveState } from '../geo/useDriveMode';
import { formatDistance } from '../geo/geo';
import { SEV_COLOR, SEV_LABEL } from '../map/markers';

interface Props {
  drive: DriveState;
  total: number;
  hazardCount: number;
  voice: boolean;
  onVoice: (v: boolean) => void;
  onStop: () => void;
}

export default function DriveOverlay({ drive, total, hazardCount, voice, onVoice, onStop }: Props) {
  const next = drive.next;
  const dist = drive.distToNext;
  const close = dist !== null && dist < 150;
  const left = Math.max(0, total - drive.along);
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[1200] p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div
          className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-2xl px-4 py-3.5 text-white shadow-float"
          style={{ background: next && close ? SEV_COLOR[next.item.severity] : '#1e45ad' }}
          role="status"
          aria-live="assertive"
        >
          {next ? <AlertTriangle className="h-8 w-8 shrink-0" /> : <CheckCircle2 className="h-8 w-8 shrink-0" />}
          <div className="min-w-0">
            {next && dist !== null ? (
              <>
                <p className="text-[26px] font-bold leading-none">{formatDistance(dist)}</p>
                <p className="mt-1 text-[15px] font-medium opacity-95">
                  {SEV_LABEL[next.item.severity]} pothole ahead{next.item.origin === 'sample' ? ' (sample)' : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-[20px] font-bold leading-tight">No potholes ahead</p>
                <p className="mt-0.5 text-[14px] opacity-90">{hazardCount ? `${drive.passed} of ${hazardCount} passed` : 'Nothing reported on this route'}</p>
              </>
            )}
          </div>
        </div>
        {drive.error && <p className="pointer-events-auto mx-auto mt-2 max-w-xl rounded-xl bg-red-600 px-4 py-2 text-sm text-white">{drive.error}</p>}
        {drive.offRoute > 60 && (
          <p className="mx-auto mt-2 max-w-xl rounded-xl bg-[#1f2328] px-4 py-2 text-sm text-white">You seem to be off the route ({formatDistance(drive.offRoute)} away).</p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[1200] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-sheet">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold text-ink">{formatDistance(left)} left</p>
            <p className="text-[13px] text-muted">
              {drive.source === 'sim' ? 'Demo drive' : 'GPS'}
              {drive.speedKmh !== null ? ` · ${Math.round(drive.speedKmh)} km/h` : ''}
            </p>
          </div>
          <button
            className="fab h-12 w-12"
            onClick={() => onVoice(!voice)}
            aria-pressed={voice}
            aria-label={voice ? 'Mute voice alerts' : 'Turn on voice alerts'}
          >
            {voice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button className="btn h-12 rounded-full bg-red-600 px-5 text-white hover:bg-red-700" onClick={onStop}>
            <X className="h-5 w-5" /> Exit
          </button>
        </div>
      </div>
    </>
  );
}
