// Main-thread side of the detection worker. One shared instance for the whole app
// so the model is only downloaded and compiled once.
import type { Backend, DetectResult, WorkerOut } from './types';

export const MODEL_URL = '/models/pothole-yolov8n-seg.onnx';

export interface DetectorInfo {
  backend: Backend;
  threads: number;
  loadMs: number;
}

type Pending = { resolve: (r: DetectResult) => void; reject: (e: Error) => void };

class Detector {
  private worker: Worker | null = null;
  private ready: Promise<DetectorInfo> | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  info: DetectorInfo | null = null;
  onProgress?: (loaded: number, total: number) => void;

  load(preferGpu = true): Promise<DetectorInfo> {
    if (this.ready) return this.ready;
    this.ready = new Promise<DetectorInfo>((resolve, reject) => {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker = w;
      w.onmessage = (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        if (m.type === 'progress') this.onProgress?.(m.loaded, m.total);
        else if (m.type === 'ready') {
          this.info = { backend: m.backend, threads: m.threads, loadMs: m.loadMs };
          resolve(this.info);
        } else if (m.type === 'result') {
          const p = this.pending.get(m.id);
          this.pending.delete(m.id);
          p?.resolve({ dets: m.dets, width: m.width, height: m.height, inferMs: m.inferMs, totalMs: m.totalMs });
        } else if (m.type === 'error') {
          if (m.id !== undefined) {
            const p = this.pending.get(m.id);
            this.pending.delete(m.id);
            p?.reject(new Error(m.message));
          } else {
            this.ready = null; // allow a retry
            this.worker?.terminate();
            reject(new Error(m.message));
          }
        }
      };
      w.onerror = (e) => {
        this.ready = null;
        reject(new Error(e.message || 'worker failed to start'));
      };
      w.postMessage({ type: 'init', modelUrl: MODEL_URL, preferGpu });
    });
    return this.ready;
  }

  get busy() {
    return this.pending.size > 0;
  }

  async detect(source: ImageBitmapSource, size: number, conf: number, masks: boolean): Promise<DetectResult> {
    await this.load();
    const bitmap = await createImageBitmap(source);
    const id = this.nextId++;
    return new Promise<DetectResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'detect', id, bitmap, size, conf, masks }, [bitmap]);
    });
  }
}

export const detector = new Detector();
