// The detection demo: one page, one view. Pick a demo photo, the demo video, your camera
// or your own file and watch the model draw boxes. Everything runs on this device.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Film, ImageIcon, Loader2, Square, Upload } from 'lucide-react';
import { detector, type DetectorInfo } from '../detection/detector';
import { Tracker } from '../detection/tracker';
import { containRect, drawDetections, type DrawItem } from '../detection/draw';
import type { Detection } from '../detection/postprocess';
import Logo from '../ui/Logo';

type Source = 'photo' | 'video' | 'camera' | null;
const DEMO_PHOTOS = ['/demo/pothole-1.jpg', '/demo/pothole-2.jpg', '/demo/pothole-3.jpg'];

export default function DetectDemo() {
  const [info, setInfo] = useState<DetectorInfo | null>(detector.info);
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>(null);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ fps: 0, now: 0, unique: 0, ms: 0 });
  const [photoResult, setPhotoResult] = useState<{ n: number; top: number } | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const tracker = useRef(new Tracker({ minHits: 3, maxMisses: 10 }));
  const last = useRef<{ items: DrawItem[]; w: number; h: number } | null>(null);
  const times = useRef<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const sourceRef = useRef<Source>(null);
  sourceRef.current = source;

  useEffect(() => {
    document.title = 'Detection demo · Safe Roads';
    return () => {
      document.title = 'Safe Roads · pothole map';
    };
  }, []);

  const loadModel = useCallback(() => {
    setLoadError(null);
    detector.onProgress = (l, t) => setLoadPct(t ? Math.round((l / t) * 100) : null);
    return detector
      .load()
      .then((i) => {
        setInfo(i);
        return i;
      })
      .catch((e) => {
        setLoadError(`The model couldn't load on this device (${(e as Error).message}).`);
        throw e;
      });
  }, []);
  useEffect(() => {
    loadModel().catch(() => undefined);
  }, [loadModel]);

  // ---------- drawing ----------
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const img = imageRef.current;
    if (sourceRef.current === 'photo' && img) {
      const view = containRect(img.naturalWidth, img.naturalHeight, w, h);
      ctx.drawImage(img, view.dx, view.dy, view.dw, view.dh);
    }
    const d = last.current;
    if (d) drawDetections(ctx, d.items, d.w, d.h, containRect(d.w, d.h, w, h), { masks: true });
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(redraw);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [redraw]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
  }, []);
  useEffect(() => () => stop(), [stop]);

  const reset = () => {
    stop();
    tracker.current.reset();
    last.current = null;
    times.current = [];
    setStats({ fps: 0, now: 0, unique: 0, ms: 0 });
    setPhotoResult(null);
    setCamError(null);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };

  // ---------- photo ----------
  const runPhoto = async (url: string) => {
    reset();
    setSource('photo');
    sourceRef.current = 'photo';
    setBusy(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      imageRef.current = img;
      redraw();
      const i = detector.info ?? (await loadModel());
      const t0 = performance.now();
      const res = await detector.detect(img, i.backend === 'webgpu' ? 640 : 416, 0.3, true);
      last.current = { items: res.dets.map((det: Detection) => ({ det })), w: res.width, h: res.height };
      setPhotoResult({ n: res.dets.length, top: res.dets.length ? Math.max(...res.dets.map((d) => d.score)) : 0 });
      setStats((s) => ({ ...s, ms: performance.now() - t0 }));
      redraw();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- video / camera loop ----------
  const loop = useCallback(
    async (isCamera: boolean) => {
      const v = videoRef.current!;
      runningRef.current = true;
      setRunning(true);
      let lastStats = 0;
      const i = detector.info ?? (await loadModel());
      const size = i.backend === 'webgpu' ? 640 : i.threads > 1 ? 416 : 320;
      while (runningRef.current) {
        if (v.readyState < 2 || v.seeking) {
          await new Promise((r) => setTimeout(r, 30));
          continue;
        }
        if (!isCamera && v.currentTime + 1 / 15 >= v.duration) break;
        try {
          const t0 = performance.now();
          const res = await detector.detect(v, size, 0.35, true);
          if (!runningRef.current) break;
          const tracks = tracker.current.update(res.dets).filter((t) => t.misses === 0);
          last.current = {
            items: tracks.map((t) => ({ det: t.box, label: t.confirmed ? `#${t.id}` : undefined, confirmed: t.confirmed })),
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
            setStats({ fps, now: tracks.length, unique: tracker.current.confirmedTotal, ms: now - t0 });
          }
          if (isCamera) await new Promise((r) => requestAnimationFrame(r));
          else {
            // step through the file at 15 frames per second of video, so slow devices see every part of it
            await new Promise<void>((resolve) => {
              const done = () => {
                v.removeEventListener('seeked', done);
                resolve();
              };
              v.addEventListener('seeked', done);
              v.currentTime = Math.min(v.duration, v.currentTime + 1 / 15);
            });
          }
        } catch (e) {
          if ((e as Error).name === 'InvalidStateError') {
            await new Promise((r) => setTimeout(r, 50));
            continue;
          }
          setLoadError(`Detection stopped: ${(e as Error).message}`);
          break;
        }
      }
      runningRef.current = false;
      setRunning(false);
      setStats((s) => ({ ...s, unique: tracker.current.confirmedTotal }));
    },
    [loadModel, redraw],
  );

  const runVideo = async (url: string) => {
    reset();
    setSource('video');
    sourceRef.current = 'video';
    const v = videoRef.current!;
    v.srcObject = null;
    v.src = url;
    v.muted = true;
    await new Promise((r) => (v.readyState >= 1 ? r(null) : v.addEventListener('loadedmetadata', r, { once: true })));
    v.currentTime = 0;
    loop(false);
  };

  const runCamera = async () => {
    reset();
    setSource('camera');
    sourceRef.current = 'camera';
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This browser does not give camera access here (it needs HTTPS and a recent browser).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.removeAttribute('src');
      v.srcObject = stream;
      await v.play();
      loop(true);
    } catch (e) {
      const name = (e as DOMException).name;
      setCamError(
        name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow it in your browser settings, or try the demo video.'
          : name === 'NotFoundError'
            ? 'No camera found on this device. Try the demo video instead.'
            : `Couldn't start the camera (${name}).`,
      );
    }
  };

  const onFile = (f: File) => {
    const url = URL.createObjectURL(f);
    if (f.type.startsWith('video/')) {
      runVideo(url).then(() => (objectUrl.current = url));
    } else {
      runPhoto(url).then(() => (objectUrl.current = url));
    }
  };

  const isVideo = source === 'video' || source === 'camera';

  return (
    <div className="min-h-[100dvh] bg-sunken">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-surface/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <Link to="/" className="rounded-full p-2 text-muted hover:bg-sunken" aria-label="Back to the map">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Logo size={26} />
        <h1 className="text-[17px] font-semibold text-ink">Detection demo</h1>
        <span className="ml-auto text-[12px] text-muted">
          {info ? `Model ready · ${info.backend === 'webgpu' ? 'WebGPU' : `WASM ×${info.threads}`}` : loadError ? 'Model failed' : `Loading model${loadPct !== null ? ` ${loadPct}%` : '…'}`}
        </span>
      </header>

      <main className="mx-auto max-w-3xl p-3 md:p-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button className="btn-primary py-3" onClick={() => runPhoto(DEMO_PHOTOS[Math.floor(Math.random() * DEMO_PHOTOS.length)])} disabled={busy}>
            <ImageIcon className="h-4 w-4" /> Demo photo
          </button>
          <button className="btn-tonal py-3" onClick={() => runVideo('/demo/road-demo.mp4')}>
            <Film className="h-4 w-4" /> Demo video
          </button>
          <button className="btn-tonal py-3" onClick={runCamera}>
            <Camera className="h-4 w-4" /> Camera
          </button>
          <button className="btn-outline py-3" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Your file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onFile(f);
            }}
          />
        </div>

        <div ref={stageRef} className="relative mt-3 aspect-video w-full overflow-hidden rounded-2xl bg-[#111]">
          <video ref={videoRef} className={`absolute inset-0 h-full w-full object-contain ${isVideo ? '' : 'hidden'}`} playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" data-testid="demo-canvas" />
          {!source && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/80">
              <p className="text-[15px]">Pick a demo above to see the model find potholes.</p>
              <p className="mt-1 text-[13px] text-white/50">The 14 MB model downloads once, then runs on your device. Nothing is uploaded.</p>
            </div>
          )}
          {(busy || (!info && source && !loadError)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {info ? 'Looking for potholes…' : `Loading model${loadPct !== null ? ` ${loadPct}%` : '…'}`}
            </div>
          )}
          {camError && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-red-600 px-3 py-2 text-sm text-white">{camError}</div>}
          {running && (
            <button className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white" onClick={stop}>
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label={isVideo ? 'Potholes counted' : 'Potholes found'} value={isVideo ? String(stats.unique) : photoResult ? String(photoResult.n) : '–'} />
          <Stat label={isVideo ? 'Frames / s' : 'Top score'} value={isVideo ? (stats.fps ? stats.fps.toFixed(1) : '–') : photoResult?.n ? `${Math.round(photoResult.top * 100)}%` : '–'} />
          <Stat label="Time per frame" value={stats.ms ? `${Math.round(stats.ms)} ms` : '–'} />
        </div>
        {source === 'photo' && photoResult && photoResult.n === 0 && (
          <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm text-ink">The model didn't find a pothole in this one. It misses small and far-away potholes quite often (see the numbers below).</p>
        )}
        {loadError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{loadError}</p>}

        <section className="mt-5 rounded-2xl bg-surface p-4 text-[14px] leading-relaxed text-muted">
          <h2 className="mb-1 text-[15px] font-semibold text-ink">About the model</h2>
          <p>
            YOLOv8n-seg, fine-tuned on a public pothole dataset (I didn't train it myself), exported to ONNX and run with ONNX Runtime Web in a Web Worker. In
            videos a small IoU tracker counts each pothole once, after it shows up in 3 frames.
          </p>
          <p className="mt-2">
            Tested by me on 100 unseen images (Roboflow “Potholes Detection” test split, 269 potholes, CC BY 4.0): <strong className="text-ink">mAP50 0.34</strong>,
            precision 0.68, recall 0.28 at 640 px. Good when it fires, but it misses many potholes, especially small ones. Severity is a size-based guess.
          </p>
          <p className="mt-2 text-[12px] text-faint">Demo media: see the credits in the project README.</p>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-3">
      <div className="text-[22px] font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-[12px] text-muted">{label}</div>
    </div>
  );
}
