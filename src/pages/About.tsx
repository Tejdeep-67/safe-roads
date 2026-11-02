import { Link } from 'react-router-dom';
import { Github, ArrowRight } from 'lucide-react';
import Reveal from '../components/Reveal';
import Footer from '../components/Footer';
import { REPO_URL } from '../config';

const pipeline = [
  ['Frame', 'Camera, video frame or photo is grabbed as an ImageBitmap and sent to a Web Worker.'],
  ['Letterbox', 'Resized to 320, 416 or 640 px keeping the aspect ratio, padded with grey, scaled to 0..1.'],
  ['YOLOv8n-seg', 'onnxruntime-web runs the model on WebGPU, or multi-threaded WebAssembly as a fallback.'],
  ['Decode + NMS', 'Boxes above the confidence threshold, then non-max suppression (IoU 0.45) removes duplicates.'],
  ['Masks', 'Each box has 32 mask coefficients; multiplied with the prototype masks they give the pothole shape.'],
  ['Track', 'An IoU tracker links boxes across frames so one pothole is counted once, after 3 frames.'],
];

const results = [
  ['640 px', '0.341', '0.158', '0.68', '0.28'],
  ['416 px', '0.363', '0.172', '0.72', '0.26'],
  ['320 px', '0.340', '0.156', '0.72', '0.23'],
];

const credits = [
  ['Demo photo (street after rain)', 'Raammm10431, CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:BACHES_1.jpg'],
  ['Demo photo (road crack + pothole)', 'Dan crxs, CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Bache_mediano.jpg'],
  ['Demo photo (broken asphalt)', 'Anonymous, CC0', 'https://commons.wikimedia.org/wiki/File:Otro_bache.jpg'],
  ['Test dataset', 'Potholes Detection (Roboflow Universe, project-ssayl), CC BY 4.0', 'https://universe.roboflow.com/project-ssayl/potholes-detection-d4rma'],
  ['Training data of the model', 'Pothole Image Segmentation Dataset (Kaggle)', 'https://www.kaggle.com/datasets/farzadnekouei/pothole-image-segmentation-dataset'],
  ['Map tiles', '© OpenStreetMap contributors (ODbL)', 'https://www.openstreetmap.org/copyright'],
  ['Routing / search', 'OSRM demo server, Nominatim', 'https://project-osrm.org/'],
];

export default function About() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
        <Reveal>
          <p className="label">How it works</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">From a camera frame to a warning on your route</h1>
          <p className="mt-4 max-w-3xl text-zinc-400">
            Safe Roads started as a semester project with a Flask backend that ran the model on uploaded photos. I rebuilt
            it so the detection runs inside the browser: it works on a free static host, it is fast enough for live video,
            and nobody&apos;s camera feed has to be uploaded anywhere.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pipeline.map(([t, d], i) => (
            <Reveal key={t} delay={i * 70}>
              <div className="card h-full p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber/10 font-display text-sm font-bold text-amber ring-1 ring-amber/20">{i + 1}</span>
                  <h2 className="text-base font-semibold">{t}</h2>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <h2 className="text-2xl font-bold sm:text-3xl">The model, honestly</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            The weights are a YOLOv8n-seg model (3.26M parameters, one class) fine-tuned on the public Kaggle pothole
            segmentation dataset. I exported it to ONNX and checked that it gives the same output as the PyTorch model.
            To see how it does on data it has never seen, I measured it on the 100-image test split of a different
            public dataset (269 labelled potholes) using the same pre- and post-processing as this app:
          </p>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-asphalt-850 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Input</th>
                  <th className="px-4 py-3 font-semibold">mAP@50</th>
                  <th className="px-4 py-3 font-semibold">mAP@50-95</th>
                  <th className="px-4 py-3 font-semibold">Precision @0.35</th>
                  <th className="px-4 py-3 font-semibold">Recall @0.35</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r[0]} className="border-t border-white/[.05]">
                    {r.map((c, i) => (
                      <td key={i} className={`px-4 py-3 ${i === 0 ? 'font-medium text-white' : 'font-mono text-zinc-300'}`}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
            In plain words: when it flags a pothole it is right about two times out of three, but it misses most small and
            far-away potholes (recall 0.19 for small ones, 0.41 for large ones). That is why the map counts repeat reports
            from different people instead of trusting a single detection. Severity is a heuristic from the size of the mask
            and its position in the frame, not a measured depth.
          </p>
        </Reveal>

        <Reveal className="mt-16 grid gap-5 md:grid-cols-2">
          <div className="card p-6">
            <h2 className="text-xl font-semibold">Route alerts</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              The route comes from OSRM as a polyline. For every hazard I find the closest point on each segment
              (point-to-segment distance in a local flat projection, which is accurate to well under a metre over a few
              km) and keep it if it is within the buffer (30 m by default). The distance along the route sorts them in the
              order you reach them. Drive mode does the same for your GPS position every update and speaks 150 m before
              the next hazard.
            </p>
          </div>
          <div className="card p-6">
            <h2 className="text-xl font-semibold">Shared map</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Reports are saved in your browser first. When the site runs on Netlify, a small serverless function stores
              them in Netlify Blobs so everyone sees them; it validates input, rate-limits each IP and merges reports within
              15 m into one with a higher count. Photos never leave your device. If the function can&apos;t be reached the
              app keeps working with local storage.
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-16">
          <h2 className="text-2xl font-bold">Limitations</h2>
          <ul className="mt-4 grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
            {[
              'Recall is low on small or distant potholes, and night / rain footage is much worse.',
              'Severity is a size-based guess, not depth.',
              'Phone GPS is off by 5-15 m, so pins are approximate.',
              'The shared store has basic rate limiting but no accounts or moderation yet.',
              'Speed depends a lot on the device; old phones without WebGPU run at a few FPS.',
              'The sample hazards around Guntur and Vijayawada are made up so the map is not empty.',
            ].map((t) => (
              <li key={t} className="flex gap-2 rounded-xl border border-white/[.06] bg-asphalt-900/50 p-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-16">
          <h2 className="text-2xl font-bold">Credits</h2>
          <ul className="mt-4 divide-y divide-white/[.05] overflow-hidden rounded-2xl border border-white/[.07] text-sm">
            {credits.map(([what, who, url]) => (
              <li key={what} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-zinc-300">{what}</span>
                <a href={url} target="_blank" rel="noreferrer" className="text-zinc-500 underline-offset-2 hover:text-amber hover:underline">
                  {who}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">Built with React, TypeScript, Vite, Tailwind CSS, Leaflet, onnxruntime-web and Ultralytics YOLOv8.</p>
        </Reveal>

        <Reveal className="mt-12 flex flex-wrap gap-3">
          <Link to="/detect" className="btn-primary">
            Try the detector <ArrowRight className="h-4 w-4" />
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn-ghost">
            <Github className="h-4 w-4" /> Source code
          </a>
        </Reveal>
      </section>
      <Footer />
    </>
  );
}
