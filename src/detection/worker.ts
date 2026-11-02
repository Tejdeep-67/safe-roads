/// <reference lib="webworker" />
// Runs the ONNX model off the main thread so the UI and video stay smooth.
// Messages in:  init { modelUrl, preferGpu }  |  detect { id, bitmap, size, conf, masks }
// Messages out: progress | ready | result | error
import type * as Ort from 'onnxruntime-web';
import { buildMask, decodeOutput, estimateSeverity, letterbox, maskAreaFrac } from './postprocess';
import type { WorkerIn, WorkerOut, Backend } from './types';

declare const self: DedicatedWorkerGlobalScope;

let ort: typeof Ort;
let session: Ort.InferenceSession | null = null;
let backend: Backend = 'wasm';
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

const post = (msg: WorkerOut, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

async function fetchModel(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`could not download the model (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    post({ type: 'progress', loaded, total });
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return false;
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function init(modelUrl: string, preferGpu: boolean) {
  const t0 = performance.now();
  const model = await fetchModel(modelUrl);
  const tryGpu = preferGpu && (await hasWebGpu());
  if (tryGpu) {
    try {
      ort = await import('onnxruntime-web/webgpu');
      session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
      backend = 'webgpu';
    } catch (err) {
      console.warn('WebGPU failed, falling back to WASM', err);
      session = null;
    }
  }
  if (!session) {
    ort = await import('onnxruntime-web/wasm');
    const threads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    ort.env.wasm.numThreads = threads;
    session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    backend = 'wasm';
  }
  // first run is always slow (shader compile / memory setup), do it now
  const warm = new ort.Tensor('float32', new Float32Array(3 * 320 * 320), [1, 3, 320, 320]);
  await session.run({ [session.inputNames[0]]: warm });
  post({
    type: 'ready',
    backend,
    threads: backend === 'wasm' ? (ort.env.wasm.numThreads as number) : 0,
    loadMs: Math.round(performance.now() - t0),
  });
}

function toTensor(bitmap: ImageBitmap, size: number) {
  if (!canvas || canvas.width !== size) {
    canvas = new OffscreenCanvas(size, size);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  const lb = letterbox(bitmap.width, bitmap.height, size);
  const c = ctx!;
  c.fillStyle = 'rgb(114,114,114)';
  c.fillRect(0, 0, size, size);
  c.drawImage(bitmap, lb.padX, lb.padY, Math.round(bitmap.width * lb.scale), Math.round(bitmap.height * lb.scale));
  const px = c.getImageData(0, 0, size, size).data;
  const plane = size * size;
  const data = new Float32Array(3 * plane);
  for (let i = 0, j = 0; i < plane; i++, j += 4) {
    data[i] = px[j] / 255;
    data[plane + i] = px[j + 1] / 255;
    data[2 * plane + i] = px[j + 2] / 255;
  }
  return { tensor: new ort.Tensor('float32', data, [1, 3, size, size]), lb };
}

async function detect(msg: Extract<WorkerIn, { type: 'detect' }>) {
  if (!session) throw new Error('model not loaded');
  const { bitmap, size, conf, masks, id } = msg;
  const t0 = performance.now();
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const { tensor, lb } = toTensor(bitmap, size);
  bitmap.close();
  const t1 = performance.now();
  const out = await session.run({ [session.inputNames[0]]: tensor });
  const t2 = performance.now();
  const o0 = out[session.outputNames[0]];
  const o1 = out[session.outputNames[1]];
  const dets = decodeOutput(o0.data as Float32Array, o0.dims[2], lb, srcW, srcH, conf);
  const transfer: Transferable[] = [];
  for (const d of dets) {
    if (masks && o1) {
      d.mask = buildMask(d, o1.data as Float32Array, o1.dims[2], o1.dims[3], lb);
      if (d.mask) {
        d.areaFrac = maskAreaFrac(d.mask, srcW, srcH);
        transfer.push(d.mask.data.buffer);
      }
    }
    d.severity = estimateSeverity(d, srcW, srcH, d.areaFrac);
    delete d.coeffs;
  }
  tensor.dispose?.();
  o0.dispose?.();
  o1?.dispose?.();
  post(
    {
      type: 'result',
      id,
      dets,
      width: srcW,
      height: srcH,
      preMs: t1 - t0,
      inferMs: t2 - t1,
      totalMs: performance.now() - t0,
    },
    transfer,
  );
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') await init(msg.modelUrl, msg.preferGpu);
    else if (msg.type === 'detect') await detect(msg);
  } catch (err) {
    if (msg.type === 'detect') msg.bitmap?.close?.();
    post({ type: 'error', id: msg.type === 'detect' ? msg.id : undefined, message: String((err as Error)?.message || err) });
  }
};
