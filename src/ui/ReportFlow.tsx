// Report a pothole in a few taps:
// photo (camera or gallery) -> the model looks for potholes -> location from the photo's
// GPS, else the phone's GPS, else you place it on the map -> confirm.
// You can also report without a photo, so reporting never dead-ends.
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, Crosshair, ImagePlus, Loader2, MapPin, PencilLine, Sparkles } from 'lucide-react';
import type { Severity, Detection } from '../detection/postprocess';
import { detector } from '../detection/detector';
import { gpsFromPhoto, loadBitmap, shrinkPhoto } from '../report/photo';
import type { LatLng } from '../geo/geo';
import type { MyLocation } from '../geo/useMyLocation';
import { addHazard } from '../hazards/store';
import type { Hazard } from '../hazards/types';
import { ApiError } from '../lib/api';
import { SEV_COLOR, SEV_LABEL } from '../map/markers';
import Sheet from './Sheet';
import PhotoPreview from './PhotoPreview';

type LocSource = 'photo' | 'gps' | 'map';
interface Loc {
  ll: LatLng;
  source: LocSource;
}

interface Props {
  hidden: boolean;
  loc: MyLocation;
  mapCenter: () => LatLng;
  onPickOnMap: (start: LatLng | null, done: (ll: LatLng | null) => void) => void;
  onDone: (h: Hazard) => void;
  onNeedSignIn: () => void;
  onClose: () => void;
}

const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };
const LOC_TEXT: Record<LocSource, string> = { photo: "From the photo's GPS", gps: 'Your current location', map: 'Placed on the map' };

export default function ReportFlow({ hidden, loc, onPickOnMap, onDone, onNeedSignIn, onClose, mapCenter }: Props) {
  const [step, setStep] = useState<'choose' | 'review'>('choose');
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [dets, setDets] = useState<Detection[] | null>(null);
  const [detecting, setDetecting] = useState<string | null>(null);
  const [detError, setDetError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Severity>('medium');
  const [place, setPlace] = useState<Loc | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<Hazard | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const run = useRef(0);

  useEffect(() => () => void (run.current = -1), []);

  const findDeviceLocation = async (id: number) => {
    setLocating(true);
    const ll = await loc.locate();
    if (run.current !== id) return;
    setLocating(false);
    if (ll) setPlace({ ll, source: 'gps' });
  };

  const startWithFile = async (file: Blob) => {
    const id = ++run.current;
    setStep('review');
    setError(null);
    setDup(null);
    setDets(null);
    setDetError(null);
    setPlace(null);
    setDetecting('Preparing photo…');
    let canvas: HTMLCanvasElement;
    try {
      const bitmap = await loadBitmap(file);
      const small = await shrinkPhoto(bitmap);
      bitmap.close?.();
      if (run.current !== id) return;
      canvas = small.canvas;
      setImage(canvas);
      setPhoto(small.dataUrl);
    } catch {
      setDetecting(null);
      setDetError("This file couldn't be opened as a photo. Try a JPG or PNG, or report without a photo.");
      setImage(null);
      setPhoto(null);
      return;
    }

    // location: EXIF GPS first, then the device
    gpsFromPhoto(file).then((ll) => {
      if (run.current !== id) return;
      if (ll) setPlace({ ll, source: 'photo' });
      else findDeviceLocation(id);
    });

    // detection in the worker
    try {
      if (!detector.info) {
        detector.onProgress = (loaded, total) =>
          run.current === id && setDetecting(total ? `Loading the pothole model… ${Math.round((loaded / total) * 100)}%` : 'Loading the pothole model…');
        setDetecting('Loading the pothole model…');
      }
      const info = await detector.load();
      if (run.current !== id) return;
      setDetecting('Looking for potholes…');
      const res = await detector.detect(canvas, info.backend === 'webgpu' ? 640 : 416, 0.3, true);
      if (run.current !== id) return;
      setDets(res.dets);
      if (res.dets.length) {
        const worst = res.dets.reduce<Severity>((w, d) => (RANK[d.severity ?? 'low'] > RANK[w] ? d.severity ?? 'low' : w), 'low');
        setSeverity(worst);
      }
    } catch {
      if (run.current === id) setDetError("The detector couldn't run on this device, so pick the severity yourself.");
    } finally {
      if (run.current === id) setDetecting(null);
    }
  };

  const startWithoutPhoto = () => {
    const id = ++run.current;
    setStep('review');
    setImage(null);
    setPhoto(null);
    setDets(null);
    setDetError(null);
    setDetecting(null);
    setError(null);
    setDup(null);
    setPlace(null);
    findDeviceLocation(id);
  };

  const useDemoPhoto = async () => {
    try {
      const res = await fetch('/demo/pothole-1.jpg');
      startWithFile(await res.blob());
    } catch {
      setError("Couldn't load the demo photo.");
    }
  };

  const pickOnMap = () => onPickOnMap(place?.ll ?? loc.pos ?? mapCenter(), (ll) => ll && setPlace({ ll, source: 'map' }));

  const submit = async () => {
    if (!place) return;
    setBusy(true);
    setError(null);
    setDup(null);
    const top = dets?.length ? Math.max(...dets.map((d) => d.score)) : null;
    try {
      const h = await addHazard({
        lat: place.ll[0],
        lng: place.ll[1],
        severity,
        confidence: top,
        potholes: dets?.length ?? 0,
        source: photo ? 'photo' : 'manual',
        note: note.trim(),
        photo: photo ?? undefined,
      });
      onDone(h);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onNeedSignIn();
      } else if (e instanceof ApiError && e.status === 409 && (e.data as { hazard?: Hazard })?.hazard) {
        setDup({ ...(e.data as { hazard: Hazard }).hazard, origin: 'shared' });
        setError('You already reported a pothole at this spot.');
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const found = dets?.length ?? 0;
  const top = found ? Math.round(Math.max(...dets!.map((d) => d.score)) * 100) : 0;

  const fileInputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) startWithFile(f);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) startWithFile(f);
        }}
      />
    </>
  );

  if (step === 'choose') {
    return (
      <div className={hidden ? 'hidden' : ''}>
        <Sheet label="Report a pothole" title="Report a pothole" subtitle="A photo helps others see how bad it is." onClose={onClose}>
          {fileInputs}
          <div className="grid grid-cols-2 gap-2">
            <button className="flex flex-col items-center gap-2 rounded-2xl bg-brand-600 px-3 py-5 text-white hover:bg-brand-700" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-7 w-7" />
              <span className="text-[15px] font-semibold">Take photo</span>
            </button>
            <button className="flex flex-col items-center gap-2 rounded-2xl bg-sunken px-3 py-5 text-ink hover:bg-line/60" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-7 w-7 text-brand-600 dark:text-brand-200" />
              <span className="text-[15px] font-semibold">Choose photo</span>
            </button>
          </div>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={startWithoutPhoto}>
              <PencilLine className="h-5 w-5 text-muted" />
              <span>
                <span className="block text-[15px] text-ink">Report without a photo</span>
                <span className="block text-[13px] text-muted">Mark the spot and choose how bad it is</span>
              </span>
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={useDemoPhoto}>
              <Sparkles className="h-5 w-5 text-muted" />
              <span>
                <span className="block text-[15px] text-ink">Try with a demo photo</span>
                <span className="block text-[13px] text-muted">No camera handy? See the detector work</span>
              </span>
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </Sheet>
      </div>
    );
  }

  return (
    <div className={hidden ? 'hidden' : ''}>
      <Sheet
        label="Report a pothole"
        title="Report a pothole"
        onClose={onClose}
        footer={
          <button className="btn-primary w-full py-3 text-[15px]" disabled={!place || busy || !!detecting} onClick={submit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Sending…' : place ? 'Report pothole' : 'Set the location first'}
          </button>
        }
      >
        {fileInputs}
        {image && (
          <div className="relative">
            <PhotoPreview image={image} dets={dets} className="aspect-[4/3]" />
            {detecting && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-sm font-medium text-white">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {detecting}
              </div>
            )}
          </div>
        )}
        {!image && detecting && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> {detecting}
          </p>
        )}

        {image && !detecting && dets && (
          <p className="mt-3 text-[15px] text-ink" data-testid="detect-result">
            {found ? (
              <>
                <strong>
                  Found {found} pothole{found > 1 ? 's' : ''}
                </strong>{' '}
                ({top}% sure). Severity is a guess from its size, so change it if it's wrong.
              </>
            ) : (
              <>
                <strong>The model didn't find a pothole here.</strong> It misses some, especially small or far-away ones. If there is one, you can still report it.
              </>
            )}
          </p>
        )}
        {detError && (
          <p className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {detError}
          </p>
        )}
        {image && !detecting && (
          <button className="mt-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-200" onClick={() => galleryRef.current?.click()}>
            Use a different photo
          </button>
        )}

        <fieldset className="mt-4">
          <legend className="field-label">How bad is it?</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={severity === s}
                onClick={() => setSeverity(s)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition ${
                  severity === s ? 'border-transparent text-white' : 'border-line text-ink hover:bg-sunken'
                }`}
                style={severity === s ? { background: SEV_COLOR[s] } : undefined}
              >
                {severity !== s && <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEV_COLOR[s] }} />}
                {SEV_LABEL[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <span className="field-label">Location</span>
          <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <MapPin className={`h-5 w-5 shrink-0 ${place ? 'text-brand-600' : 'text-faint'}`} />
            <div className="min-w-0 flex-1 text-[14px]">
              {place ? (
                <>
                  <span className="block text-ink">{LOC_TEXT[place.source]}</span>
                  <span className="block text-[12px] text-muted">
                    {place.ll[0].toFixed(5)}, {place.ll[1].toFixed(5)}
                    {place.source === 'gps' && loc.accuracy ? ` · ±${Math.round(loc.accuracy)} m` : ''}
                  </span>
                </>
              ) : locating ? (
                <span className="text-muted">Getting your location…</span>
              ) : (
                <span className="text-muted">{loc.error ? 'No GPS. Place it on the map instead.' : 'Not set yet'}</span>
              )}
            </div>
            <button className={place ? 'btn-outline px-3 py-1.5' : 'btn-tonal px-3 py-1.5'} onClick={pickOnMap}>
              <Crosshair className="h-4 w-4" /> {place ? 'Adjust' : 'Set on map'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="field-label" htmlFor="report-note">
            Note <span className="font-normal text-faint">(optional)</span>
          </label>
          <input id="report-note" className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. left lane, near the bus stop" />
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
            {dup && (
              <button className="ml-2 font-semibold underline" onClick={() => onDone(dup)}>
                Show it
              </button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
