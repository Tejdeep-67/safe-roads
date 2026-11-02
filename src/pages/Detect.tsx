import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Film, ImageIcon, Play, Pause, Square, MapPin, Upload, Gauge, Cpu, Layers, RotateCcw } from 'lucide-react';
import exifr from 'exifr';
import { detector, type DetectorInfo } from '../detection/detector';
import { Tracker, type Track } from '../detection/tracker';
import { containRect, drawDetections, type DrawItem } from '../detection/draw';
import type { Detection, Severity } from '../detection/postprocess';
import { addHazard } from '../hazards/store';
import type { HazardSource } from '../hazards/types';
import SeverityBadge from '../components/SeverityBadge';
import LocationPicker from '../components/LocationPicker';
import { toast } from '../components/Toaster';

type Mode = 'camera' | 'video' | 'image';
type SizeOpt = 'auto' | 320 | 416 | 640;

const DEMO_IMAGES = [
  { src: '/demo/pothole-1.jpg', label: 'Road crack + pothole' },
  { src: '/demo/pothole-2.jpg', label: 'Street after rain' },
  { src: '/demo/pothole-3.jpg', label: 'Broken asphalt' },
];
// VP9 webm where supported (smaller, works in every Chromium build), H.264 mp4 otherwise (Safari).
const DEMO_VIDEO =
  typeof document !== 'undefined' && document.createElement('video').canPlayType('video/webm; codecs="vp9"')
    ? '/demo/road-demo.webm'
    : '/demo/road-demo.mp4';

interface Logged {
  id: number;
  severity: Severity;
  score: number;
  at: string; // video time or clock time
  thumb?: string;
  saved?: boolean;
}

interface Pending {
  logged?: Logged;
  severity: Severity;
  confidence: number | null;
  source: HazardSource;
  thumb?: string;
  initial: [number, number] | null;
  hint?: string;
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Detect() {
  const [mode, setMode] = useState<Mode>('video');
  const [info, setInfo] = useState<DetectorInfo | null>(detector.info);
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conf, setConf] = useState(0.35);
  const [sizeOpt, setSizeOpt] = useState<SizeOpt>('auto');
  const [masks, setMasks] = useState(true);
  const [frameByFrame, setFrameByFrame] = useState(true);
  const [autoLog, setAutoLog] = useState(false);
  const [running, setRunning] = useState(false);
  const [hasSource, setHasSource] = useState(false);
  const [stats, setStats] = useState({ fps: 0, ms: 0, now: 0, unique: 0 });
  const [logged, setLogged] = useState<Logged[]>([]);
  const [imageDets, setImageDets] = useState<Detection[] | null>(null);
  const [imageGps, setImageGps] = useState<[number, number] | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef(new Tracker({ minHits: 3, maxMisses: 10 }));
  const runningRef = useRef(false);
  const lastDraw = useRef<{ items: DrawItem[]; w: number; h: number } | null>(null);
  const retries = useRef(0);
  const times = useRef<number[]>([]);
  const geoRef = useRef<[number, number] | null>(null);
  const geoWatch = useRef<number | null>(null);
  const settings = useRef({ conf, masks, frameByFrame, autoLog, size: 416 });
  const objectUrl = useRef<string | null>(null);

  const inputSize = (forImage = false): number => {
    if (sizeOpt !== 'auto') return sizeOpt;
    if (forImage) return 640;
    if (info?.backend === 'webgpu') return 640;
    return (info?.threads ?? 1) > 1 ? 416 : 320;
  };

  settings.current = { conf, masks, frameByFrame, autoLog, size: inputSize() };

  // ---- model loading -------------------------------------------------------
  const loadModel = useCallback(() => {
    setLoadError(null);
    detector.onProgress = (loaded, total) => setLoadPct(total ? Math.round((loaded / total) * 100) : null);
    detector
      .load()
      .then((i) => {
        setInfo(i);
        setLoadPct(null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // ---- drawing -------------------------------------------------------------
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const d = lastDraw.current;
    if (!d) return;
    const view = containRect(d.w, d.h, rect.width, rect.height);
    drawDetections(ctx, d.items, d.w, d.h, view, { masks: settings.current.masks });
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => redraw());
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [masks, redraw]);

  // ---- helpers -------------------------------------------------------------
  const cropThumb = (source: CanvasImageSource, det: Detection): string | undefined => {
    try {
      const c = document.createElement('canvas');
      const w = det.x2 - det.x1;
      const h = det.y2 - det.y1;
      const pad = 0.25;
      const sx = Math.max(0, det.x1 - w * pad);
      const sy = Math.max(0, det.y1 - h * pad);
      c.width = 96;
      c.height = 72;
      c.getContext('2d')!.drawImage(source, sx, sy, w * (1 + 2 * pad), h * (1 + 2 * pad), 0, 0, 96, 72);
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return undefined;
    }
  };

  const stopEverything = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.srcObject = null;
      v.load();
    }
    if (geoWatch.current !== null) navigator.geolocation?.clearWatch(geoWatch.current);
    geoWatch.current = null;
  }, []);

  useEffect(() => () => stopEverything(), [stopEverything]);

  const resetResults = () => {
    trackerRef.current.reset();
    lastDraw.current = null;
    times.current = [];
    setLogged([]);
    setImageDets(null);
    setImageGps(null);
    setStats({ fps: 0, ms: 0, now: 0, unique: 0 });
    redraw();
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    stopEverything();
    resetResults();
    setHasSource(false);
    setCamError(null);
    setMode(m);
  };

  // ---- video / camera loop -------------------------------------------------
  const onConfirmed = useCallback((tr: Track, source: HTMLVideoElement, isCamera: boolean) => {
    const at = isCamera ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : fmtTime(source.currentTime);
    const item: Logged = { id: tr.id, severity: tr.severity, score: tr.bestScore, at, thumb: cropThumb(source, tr.box) };
    if (isCamera && settings.current.autoLog && geoRef.current) {
      const [lat, lng] = geoRef.current;
      addHazard({ lat, lng, severity: tr.severity, confidence: tr.bestScore, source: 'camera', thumb: item.thumb });
      item.saved = true;
      toast(`Pothole #${tr.id} logged at your location`, 'success');
    }
    setLogged((l) => [item, ...l].slice(0, 40));
  }, []);

  const runLoop = useCallback(
    async (isCamera: boolean) => {
      const v = videoRef.current;
      if (!v) return;
      const tracker = trackerRef.current;
      retries.current = 0;
      tracker.onConfirm = (tr) => onConfirmed(tr, v, isCamera);
      runningRef.current = true;
      setRunning(true);
      let lastStats = 0;

      while (runningRef.current) {
        if (v.readyState < 2 || v.seeking) {
          await new Promise((r) => setTimeout(r, 30));
          continue;
        }
        if (!isCamera && v.ended) break;
        // frame stepping needs a seekable source; otherwise fall back to normal playback
        const stepMode = !isCamera && settings.current.frameByFrame && v.seekable.length > 0;
        if (!isCamera && !stepMode && v.paused && !v.ended) await v.play().catch(() => undefined);
        if (!stepMode && v.paused && !isCamera) {
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }
        try {
          const s = settings.current;
          const t0 = performance.now();
          const res = await detector.detect(v, s.size, s.conf, s.masks);
          if (!runningRef.current) break;
          retries.current = 0;
          const tracks = tracker.update(res.dets);
          const visible = tracks.filter((t) => t.misses === 0);
          lastDraw.current = {
            items: visible.map((t) => ({ det: t.box, label: t.confirmed ? `#${t.id}` : undefined, confirmed: t.confirmed })),
            w: res.width,
            h: res.height,
          };
          redraw();
          const now = performance.now();
          times.current.push(now);
          while (times.current.length && now - times.current[0] > 2000) times.current.shift();
          if (now - lastStats > 250) {
            lastStats = now;
            const fps = times.current.length > 1 ? ((times.current.length - 1) * 1000) / (now - times.current[0]) : 0;
            setStats({ fps, ms: now - t0, now: visible.length, unique: tracker.confirmedTotal });
          }
          if (stepMode) {
            // step to the next frame (~15 per second of video) and wait for it
            if (v.currentTime + 1 / 15 >= v.duration) break;
            await new Promise<void>((resolve) => {
              const done = () => {
                v.removeEventListener('seeked', done);
                resolve();
              };
              v.addEventListener('seeked', done);
              v.currentTime = Math.min(v.duration, v.currentTime + 1 / 15);
            });
          } else {
            await new Promise((r) => requestAnimationFrame(r));
          }
        } catch (e) {
          // a frame can become unusable for a moment while the video is seeking; just try again
          if ((e as Error).name === 'InvalidStateError' && retries.current++ < 20) {
            await new Promise((r) => setTimeout(r, 50));
            continue;
          }
          console.error(e);
          toast(`Detection failed: ${(e as Error).message}`, 'error');
          break;
        }
      }
      runningRef.current = false;
      setRunning(false);
      if (!isCamera) setStats((s) => ({ ...s, unique: trackerRef.current.confirmedTotal }));
    },
    [onConfirmed, redraw],
  );

  // ---- sources -------------------------------------------------------------
  const startCamera = async () => {
    setCamError(null);
    resetResults();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This browser does not give camera access (it needs HTTPS and a recent browser).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setHasSource(true);
      runLoop(true);
    } catch (e) {
      const name = (e as DOMException).name;
      setCamError(
        name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow it in the browser settings, or try the demo video.'
          : name === 'NotFoundError'
            ? 'No camera found on this device. Try the demo video instead.'
            : `Could not start the camera (${name || 'unknown error'}).`,
      );
    }
  };

  const toggleAutoLog = (on: boolean) => {
    setAutoLog(on);
    if (on && navigator.geolocation && geoWatch.current === null) {
      geoWatch.current = navigator.geolocation.watchPosition(
        (p) => (geoRef.current = [p.coords.latitude, p.coords.longitude]),
        () => {
          toast('Location is off, so potholes cannot be logged automatically.', 'error');
          setAutoLog(false);
        },
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    }
  };

  const loadVideo = async (url: string) => {
    stopEverything();
    resetResults();
    const v = videoRef.current!;
    v.srcObject = null;
    v.src = url;
    v.muted = true;
    v.currentTime = 0;
    setHasSource(true);
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error('This video format is not supported by the browser.'));
    }).catch((e: Error) => {
      toast(e.message, 'error');
      setHasSource(false);
      throw e;
    });
    if (!settings.current.frameByFrame) await v.play();
    runLoop(false);
  };

  const onVideoFile = (f?: File) => {
    if (!f) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(f);
    loadVideo(objectUrl.current).catch(() => undefined);
  };

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (running) {
      runningRef.current = false;
      v.pause();
    } else {
      if (v.ended || v.currentTime >= v.duration - 0.1) {
        v.currentTime = 0;
        trackerRef.current.reset();
        setLogged([]);
      }
      if (!frameByFrame) v.play();
      runLoop(false);
    }
  };

  const detectImage = async (src: string, file?: File) => {
    resetResults();
    setHasSource(true);
    const img = imgRef.current!;
    img.src = src;
    await img.decode().catch(() => undefined);
    if (!img.naturalWidth) {
      toast('Could not read that image.', 'error');
      return;
    }
    // GPS from the photo, if the camera saved it
    if (file) {
      try {
        const gps = await exifr.gps(file);
        if (gps && Number.isFinite(gps.latitude)) setImageGps([gps.latitude, gps.longitude]);
      } catch {
        /* no exif */
      }
    }
    try {
      const t0 = performance.now();
      const res = await detector.detect(img, inputSize(true), conf, masks);
      setImageDets(res.dets);
      lastDraw.current = { items: res.dets.map((d) => ({ det: d })), w: res.width, h: res.height };
      redraw();
      setStats({ fps: 0, ms: performance.now() - t0, now: res.dets.length, unique: res.dets.length });
    } catch (e) {
      toast(`Detection failed: ${(e as Error).message}`, 'error');
    }
  };

  const onImageFile = (f?: File) => {
    if (!f) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(f);
    detectImage(objectUrl.current, f);
  };

  // re-run the photo when the threshold changes
  useEffect(() => {
    if (mode !== 'image' || !imgRef.current?.naturalWidth || !hasSource) return;
    const t = setTimeout(() => detectImage(imgRef.current!.src), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conf]);

  // ---- saving to the map ---------------------------------------------------
  const openPicker = (p: Pending) => {
    if (p.initial) return setPending(p);
    if (!navigator.geolocation) return setPending(p);
    navigator.geolocation.getCurrentPosition(
      (pos) => setPending({ ...p, initial: [pos.coords.latitude, pos.coords.longitude] }),
      () => setPending(p),
      { timeout: 4000, maximumAge: 60000 },
    );
  };

  const savePending = (lat: number, lng: number, severity: Severity, note: string) => {
    if (!pending) return;
    addHazard({ lat, lng, severity, confidence: pending.confidence, source: pending.source, note, thumb: pending.thumb });
    if (pending.logged) setLogged((l) => l.map((x) => (x.id === pending.logged!.id ? { ...x, saved: true } : x)));
    toast('Saved to the hazard map', 'success');
    setPending(null);
  };

  const worstImageSeverity = (): Severity => {
    const order: Severity[] = ['low', 'medium', 'high'];
    return (imageDets ?? []).reduce<Severity>((w, d) => (order.indexOf(d.severity!) > order.indexOf(w) ? d.severity! : w), 'low');
  };

  const ready = !!info;
  const isVideoLike = mode !== 'image';

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Live detection</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Find potholes in real time</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Everything runs on this device. Your camera feed, videos and photos are never uploaded.
          </p>
        </div>
        <ModelStatus info={info} pct={loadPct} error={loadError} onRetry={loadModel} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* STAGE */}
        <div>
          <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-asphalt-900 p-1" role="tablist" aria-label="Source">
            {(
              [
                ['video', 'Video', Film],
                ['camera', 'Camera', Camera],
                ['image', 'Photo', ImageIcon],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  mode === m ? 'bg-amber text-asphalt-950 shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div
            ref={stageRef}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border sm:aspect-video border-white/[.08] bg-asphalt-900 shadow-card"
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 h-full w-full object-contain ${isVideoLike && hasSource ? '' : 'invisible'}`}
            />
            <img
              ref={imgRef}
              alt="Selected road photo"
              className={`absolute inset-0 h-full w-full object-contain ${mode === 'image' && hasSource ? '' : 'invisible'}`}
            />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

            {!hasSource && (
              <EmptyStage
                mode={mode}
                ready={ready}
                camError={camError}
                onCamera={startCamera}
                onDemoVideo={() => loadVideo(DEMO_VIDEO).catch(() => undefined)}
                onVideoFile={onVideoFile}
                onImageFile={onImageFile}
                onDemoImage={(src) => detectImage(src)}
              />
            )}

            {hasSource && (
              <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
                {isVideoLike && <span className="chip !bg-black/60 backdrop-blur">{stats.fps.toFixed(1)} fps</span>}
                <span className="chip !bg-black/60 backdrop-blur">{Math.round(stats.ms)} ms</span>
                {info && <span className="chip !bg-black/60 uppercase backdrop-blur">{info.backend}</span>}
                {running && (
                  <span className="chip !bg-black/60 text-rose-300 backdrop-blur">
                    <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-rose-400" /> live
                  </span>
                )}
              </div>
            )}
            {hasSource && (
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl bg-black/65 px-3 py-2 text-right backdrop-blur">
                <div className="font-display text-2xl font-bold leading-none text-amber">{stats.unique}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400">{isVideoLike ? 'unique potholes' : 'potholes'}</div>
              </div>
            )}
          </div>

          {/* transport controls */}
          {hasSource && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mode === 'video' && (
                <button className="btn-primary" onClick={toggleVideo} disabled={!ready}>
                  {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {running ? 'Pause' : 'Run detection'}
                </button>
              )}
              {mode === 'camera' && (
                <button className="btn-ghost" onClick={() => { stopEverything(); setHasSource(false); }}>
                  <Square className="h-4 w-4" /> Stop camera
                </button>
              )}
              {mode === 'image' && imageDets && imageDets.length > 0 && (
                <button
                  className="btn-primary"
                  onClick={() =>
                    openPicker({
                      severity: worstImageSeverity(),
                      confidence: Math.max(...imageDets.map((d) => d.score)),
                      source: 'photo',
                      thumb: imgRef.current ? cropThumb(imgRef.current, imageDets[0]) : undefined,
                      initial: imageGps,
                      hint: imageGps ? 'Location read from the photo. Drag the map or tap to adjust.' : 'This photo has no GPS data. Tap the map where it was taken.',
                    })
                  }
                >
                  <MapPin className="h-4 w-4" /> Add to hazard map
                </button>
              )}
              <button className="btn-ghost" onClick={() => { stopEverything(); resetResults(); setHasSource(false); }}>
                <RotateCcw className="h-4 w-4" /> Choose another
              </button>
              {mode === 'image' && imageGps && (
                <span className="chip">
                  <MapPin className="h-3 w-3 text-signal" /> GPS in photo: {imageGps[0].toFixed(4)}, {imageGps[1].toFixed(4)}
                </span>
              )}
              {mode === 'image' && imageDets && imageDets.length === 0 && (
                <span className="text-sm text-zinc-400">No potholes found at this threshold. Try lowering the confidence.</span>
              )}
            </div>
          )}
        </div>

        {/* SIDE PANEL */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Gauge className="h-4 w-4 text-amber" /> Settings
            </h2>
            <label className="mt-4 block">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Confidence threshold</span>
                <span className="font-mono text-zinc-200">{Math.round(conf * 100)}%</span>
              </div>
              <input type="range" min={0.15} max={0.9} step={0.05} value={conf} onChange={(e) => setConf(Number(e.target.value))} className="mt-2 w-full" />
            </label>
            <div className="mt-4">
              <div className="text-xs text-zinc-400">
                Model input size
                <span className="mt-0.5 block text-[11px] text-zinc-500">Bigger is slower but finds smaller potholes</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {(['auto', 320, 416, 640] as SizeOpt[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSizeOpt(s)}
                    aria-pressed={sizeOpt === s}
                    className={`rounded-lg py-1.5 text-xs font-semibold ring-1 transition ${
                      sizeOpt === s ? 'bg-white/10 text-white ring-amber/60' : 'text-zinc-400 ring-white/10 hover:text-white'
                    }`}
                  >
                    {s === 'auto' ? `auto (${inputSize(mode === 'image')})` : s}
                  </button>
                ))}
              </div>
            </div>
            <Toggle label="Show segmentation masks" checked={masks} onChange={setMasks} icon={<Layers className="h-3.5 w-3.5" />} />
            {mode === 'video' && (
              <Toggle
                label="Frame by frame (exact overlays)"
                hint="Off = real-time playback, boxes may lag on slow devices"
                checked={frameByFrame}
                onChange={(on) => {
                  setFrameByFrame(on);
                  const v = videoRef.current;
                  if (v && running) {
                    if (on) v.pause();
                    else v.play();
                  }
                }}
              />
            )}
            {mode === 'camera' && (
              <Toggle label="Auto-log potholes with my location" hint="Uses GPS. Each new pothole is pinned on the map." checked={autoLog} onChange={toggleAutoLog} icon={<MapPin className="h-3.5 w-3.5" />} />
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{isVideoLike ? 'Potholes found' : 'Detections'}</h2>
              <span className="text-xs text-zinc-500">{isVideoLike ? `${logged.length} counted` : `${imageDets?.length ?? 0} boxes`}</span>
            </div>
            {isVideoLike ? (
              logged.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">
                  A pothole is counted once it shows up in 3 frames in a row, so the same one is not counted again on every
                  frame.
                </p>
              ) : (
                <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {logged.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-asphalt-900/70 p-2">
                      {l.thumb ? <img src={l.thumb} alt="" className="h-10 w-14 rounded-md object-cover" /> : <div className="h-10 w-14 rounded-md bg-asphalt-700" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          #{l.id} <SeverityBadge severity={l.severity} />
                        </div>
                        <div className="text-xs text-zinc-500">
                          {Math.round(l.score * 100)}% · at {l.at}
                        </div>
                      </div>
                      <button
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-amber disabled:text-signal"
                        disabled={l.saved}
                        title={l.saved ? 'Saved to map' : 'Add to map'}
                        aria-label={l.saved ? 'Saved to map' : `Add pothole ${l.id} to map`}
                        onClick={() =>
                          openPicker({ logged: l, severity: l.severity, confidence: l.score, source: mode === 'camera' ? 'camera' : 'video', thumb: l.thumb, initial: geoRef.current })
                        }
                      >
                        <MapPin className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : imageDets && imageDets.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {imageDets.map((d, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border border-white/[.06] bg-asphalt-900/70 px-3 py-2 text-sm">
                    <span className="text-zinc-300">Pothole {i + 1}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-400">{Math.round(d.score * 100)}%</span>
                      <SeverityBadge severity={d.severity!} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">Pick a photo to see what the model finds.</p>
            )}
          </div>

          <p className="px-1 text-xs leading-relaxed text-zinc-500">
            Severity is a rough guess from how much of the frame the pothole covers, corrected for how far down the
            frame it is (closer looks bigger). It is not a depth measurement.
          </p>
        </aside>
      </div>

      {pending && (
        <LocationPicker
          initial={pending.initial}
          initialSeverity={pending.severity}
          hint={pending.hint}
          onCancel={() => setPending(null)}
          onSave={(r) => savePending(r.lat, r.lng, r.severity, r.note)}
        />
      )}
    </section>
  );
}

function ModelStatus({ info, pct, error, onRetry }: { info: DetectorInfo | null; pct: number | null; error: string | null; onRetry: () => void }) {
  if (error)
    return (
      <div className="card flex items-center gap-3 px-4 py-3 text-sm">
        <span className="text-rose-300">Model failed to load: {error}</span>
        <button className="btn-ghost !py-1.5" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  if (!info)
    return (
      <div className="card w-full max-w-xs px-4 py-3 sm:w-72">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-amber" /> {pct === null || pct >= 100 ? 'Starting the model…' : 'Downloading model (14 MB)'}
          </span>
          <span className="font-mono">{pct !== null ? `${pct}%` : ''}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-amber transition-all duration-300" style={{ width: `${pct ?? 15}%` }} />
        </div>
      </div>
    );
  return (
    <div className="card flex items-center gap-3 px-4 py-3 text-xs text-zinc-400">
      <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_10px_#2dd4bf]" />
      Model ready · <span className="font-semibold uppercase text-zinc-200">{info.backend}</span>
      {info.backend === 'wasm' && <span>· {info.threads} thread{info.threads > 1 ? 's' : ''}</span>}
      <span>· loaded in {(info.loadMs / 1000).toFixed(1)} s</span>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, icon }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <label className="mt-4 flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="flex items-center gap-1.5 text-sm text-zinc-200">
          {icon}
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-asphalt-600 transition peer-checked:bg-amber peer-focus-visible:ring-2 peer-focus-visible:ring-amber/50" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

interface EmptyProps {
  mode: Mode;
  ready: boolean;
  camError: string | null;
  onCamera: () => void;
  onDemoVideo: () => void;
  onVideoFile: (f?: File) => void;
  onImageFile: (f?: File) => void;
  onDemoImage: (src: string) => void;
}

function EmptyStage({ mode, ready, camError, onCamera, onDemoVideo, onVideoFile, onImageFile, onDemoImage }: EmptyProps) {
  return (
    <div className="absolute inset-0 overflow-y-auto text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_40%,rgba(245,179,1,0.07),transparent)]" />
      {/* min-h-full + justify-center keeps it centred but still scrollable when it doesn't fit */}
      <div className="relative flex min-h-full flex-col items-center justify-center gap-3 p-4 sm:gap-4">
      {mode === 'camera' && (
        <>
          <Camera className="h-10 w-10 text-amber" />
          <p className="max-w-sm text-sm text-zinc-400">Uses the rear camera on phones. Mount the phone on the dashboard, facing the road.</p>
          <button className="btn-primary" onClick={onCamera} disabled={!ready}>
            {ready ? 'Start camera' : 'Loading model…'}
          </button>
          {camError && <p className="max-w-sm text-sm text-rose-300">{camError}</p>}
        </>
      )}
      {mode === 'video' && (
        <>
          <Film className="h-10 w-10 text-amber" />
          <p className="max-w-sm text-sm text-zinc-400">Run the model on a road video, frame by frame, with an FPS counter and pothole count.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-primary" onClick={onDemoVideo} disabled={!ready}>
              <Play className="h-4 w-4" /> {ready ? 'Try demo video' : 'Loading model…'}
            </button>
            <label className={`btn-ghost cursor-pointer ${!ready ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload className="h-4 w-4" /> Upload video
              <input type="file" accept="video/*" className="sr-only" disabled={!ready} onChange={(e) => onVideoFile(e.target.files?.[0])} />
            </label>
          </div>
          <p className="text-[11px] text-zinc-500">
            Demo clip: “Rainwater-Filled Potholes on a Community Road” by Knowledge and philosophy,{' '}
            <a className="underline hover:text-amber" href="https://commons.wikimedia.org/wiki/File:Rainwater-Filled_Potholes_on_a_Community_Road.webm" target="_blank" rel="noreferrer">
              CC BY-SA 4.0
            </a>
            , trimmed.
          </p>
        </>
      )}
      {mode === 'image' && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_IMAGES.map((d) => (
              <button
                key={d.src}
                onClick={() => onDemoImage(d.src)}
                disabled={!ready}
                className="group relative overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:ring-amber/60 disabled:opacity-50"
                title={d.label}
              >
                <img src={d.src} alt={d.label} className="h-12 w-[4.5rem] object-cover transition duration-300 group-hover:scale-105 sm:h-20 sm:w-28" loading="lazy" />
              </button>
            ))}
          </div>
          <p className="text-sm text-zinc-400">{ready ? 'Tap a demo photo, or use your own' : 'Loading model…'}</p>
          <label className={`btn-ghost cursor-pointer ${!ready ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="h-4 w-4" /> Upload photo
            <input type="file" accept="image/*" className="sr-only" disabled={!ready} onChange={(e) => onImageFile(e.target.files?.[0])} />
          </label>
          <p className="text-xs text-zinc-500">Photos with GPS data are placed on the map automatically.</p>
        </>
      )}
      </div>
    </div>
  );
}
