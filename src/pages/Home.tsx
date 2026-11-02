import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Map as MapIcon, Navigation, ShieldCheck, Cpu, Github } from 'lucide-react';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import { useHazards } from '../hazards/store';
import { ALERT_BUFFER_M, MODEL_FACTS, REPO_URL } from '../config';
import Footer from '../components/Footer';

// real output of the model on this photo (model/evaluate.py style decode, conf 0.35)
const HERO_BOXES = [
  { x1: 0.022, y1: 0.593, x2: 0.59, y2: 0.999, score: 0.94, sev: 'high' },
  { x1: 0.161, y1: 0.25, x2: 0.438, y2: 0.347, score: 0.54, sev: 'medium' },
];

function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-amber/10 blur-3xl" aria-hidden="true" />
      <figure className="card relative overflow-hidden p-2">
        <div className="relative overflow-hidden rounded-xl">
          <img
            src="/demo/pothole-2.jpg"
            alt="A street with water-filled potholes, with the model's detections drawn on top"
            width={1170}
            height={703}
            className="block aspect-[1170/703] w-full object-cover"
            fetchPriority="high"
          />
          {/* scan line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 animate-scan bg-gradient-to-b from-transparent via-amber/20 to-transparent" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            {HERO_BOXES.map((b, i) => (
              <rect
                key={i}
                x={b.x1 * 100}
                y={b.y1 * 100}
                width={(b.x2 - b.x1) * 100}
                height={(b.y2 - b.y1) * 100}
                rx="1"
                fill={b.sev === 'high' ? 'rgba(244,63,94,.14)' : 'rgba(251,146,60,.12)'}
                stroke={b.sev === 'high' ? '#f43f5e' : '#fb923c'}
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
                style={{ strokeWidth: 2.5 }}
              />
            ))}
          </svg>
          {HERO_BOXES.map((b, i) => (
            <span
              key={i}
              className={`absolute -translate-y-full rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-asphalt-950 ${
                b.sev === 'high' ? 'bg-rose-500' : 'bg-orange-400'
              }`}
              style={{ left: `${b.x1 * 100}%`, top: `${b.y1 * 100}%` }}
            >
              pothole {Math.round(b.score * 100)}% · {b.sev}
            </span>
          ))}
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse2 rounded-full bg-signal" /> Real output of the model on this photo
          </span>
          <span>Photo: Raammm10431, CC BY-SA 4.0</span>
        </figcaption>
      </figure>
    </div>
  );
}

const steps = [
  {
    icon: Camera,
    title: 'Detect',
    text: 'Point your phone camera at the road, or drop in a video or photo. A YOLOv8 segmentation model finds potholes frame by frame, right on your device.',
  },
  {
    icon: MapIcon,
    title: 'Map',
    text: 'Each pothole is logged with its GPS position (live location, photo EXIF or a pin you drop) and a severity estimate, on a map everyone can see.',
  },
  {
    icon: Navigation,
    title: 'Warn',
    text: `Plan a route and you only get the hazards within ${ALERT_BUFFER_M} m of it. In drive mode your phone speaks up before you reach one.`,
  },
];

export default function Home() {
  const { hazards } = useHazards();
  return (
    <>
      {/* HERO */}
      <section className="grain relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(245,179,1,0.10),transparent_70%)]" />
          <div className="lane absolute left-[8%] top-0 hidden h-full w-1 animate-lane-dash opacity-20 lg:block" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
          <div>
            <p className="chip mb-6 animate-fade-up">
              <Cpu className="h-3.5 w-3.5 text-amber" /> Runs fully in your browser · no uploads
            </p>
            <h1 className="animate-fade-up text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl [animation-delay:80ms]">
              Spot potholes <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-amber via-amber-soft to-amber bg-clip-text text-transparent">before your wheels do.</span>
            </h1>
            <p className="mt-5 max-w-xl animate-fade-up text-base leading-relaxed text-zinc-400 sm:text-lg [animation-delay:160ms]">
              Safe Roads detects potholes in real time from your camera, pins them on a shared hazard map and warns you
              when your route goes near one.
            </p>
            <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:240ms]">
              <Link to="/detect" className="btn-primary !px-5 !py-3 text-[15px]">
                Try live detection <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/map" className="btn-ghost !px-5 !py-3 text-[15px]">
                Open hazard map
              </Link>
            </div>
            <p className="mt-4 text-xs text-zinc-500">No camera? The detect page has demo photos and a demo video.</p>
          </div>
          <div className="animate-fade-up [animation-delay:200ms]">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-white/[.06] bg-asphalt-900/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4">
          {[
            { value: MODEL_FACTS.params / 1e6, decimals: 1, suffix: 'M', label: 'model parameters' },
            { value: MODEL_FACTS.sizeMB, suffix: ' MB', label: 'model, cached after first load' },
            { value: ALERT_BUFFER_M, suffix: ' m', label: 'route alert buffer' },
            { value: hazards.length, suffix: '', label: 'hazards on the map now' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="px-2 py-8 text-center md:py-10">
              <div className="font-display text-3xl font-bold text-white sm:text-4xl">
                <CountUp value={s.value} decimals={s.decimals ?? 0} />
                <span className="text-amber">{s.suffix}</span>
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="label">How it works</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">Three steps, one idea: warn people about the road before they hit it.</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <div className="card group h-full p-6 transition duration-300 hover:-translate-y-1 hover:border-amber/30">
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber/10 text-amber ring-1 ring-amber/20 transition group-hover:bg-amber group-hover:text-asphalt-950">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-4xl font-bold text-white/[.06]">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HONEST MODEL */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="card grid gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="label flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-signal" /> About the model
              </p>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">A small model that is honest about its limits</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                The detector is a YOLOv8n segmentation model fine-tuned on a public pothole dataset, exported to ONNX and
                run with onnxruntime-web (WebGPU when your browser has it, otherwise WebAssembly). I tested it myself on a
                different public dataset it had never seen, and it finds clear potholes well but misses small and
                far-away ones.
              </p>
              <Link to="/about" className="btn-ghost mt-6">
                Read how it works <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-4 self-center">
              {[
                ['mAP@50', MODEL_FACTS.testMap50.toFixed(2), `on ${MODEL_FACTS.testImages} unseen test images`],
                ['Input', '320–640 px', 'picked by device speed'],
                ['Backend', 'WebGPU / WASM', 'chosen automatically'],
                ['Privacy', 'On-device', 'frames never leave the browser'],
              ].map(([k, v, d]) => (
                <div key={k} className="rounded-xl border border-white/[.06] bg-asphalt-900/70 p-4">
                  <dt className="text-xs text-zinc-500">{k}</dt>
                  <dd className="mt-1 font-display text-xl font-semibold text-white">{v}</dd>
                  <dd className="mt-0.5 text-[11px] text-zinc-500">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-amber/20 bg-gradient-to-br from-amber/15 via-asphalt-850 to-asphalt-900 p-8 sm:p-12">
            <div className="hazard-stripes absolute right-0 top-0 h-2 w-full opacity-60" aria-hidden="true" />
            <h2 className="text-2xl font-bold sm:text-3xl">Going somewhere around Guntur or Vijayawada?</h2>
            <p className="mt-2 max-w-xl text-zinc-400">
              Check your route against the hazard map, or start drive mode and let your phone call out potholes ahead.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/route" className="btn-primary">
                Plan a route <Navigation className="h-4 w-4" />
              </Link>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn-ghost">
                <Github className="h-4 w-4" /> View the code
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </>
  );
}
