import type { Detection } from './postprocess';

export type Backend = 'webgpu' | 'wasm';

export type WorkerIn =
  | { type: 'init'; modelUrl: string; preferGpu: boolean }
  | { type: 'detect'; id: number; bitmap: ImageBitmap; size: number; conf: number; masks: boolean };

export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; backend: Backend; threads: number; loadMs: number }
  | {
      type: 'result';
      id: number;
      dets: Detection[];
      width: number;
      height: number;
      preMs: number;
      inferMs: number;
      totalMs: number;
    }
  | { type: 'error'; id?: number; message: string };

export interface DetectResult {
  dets: Detection[];
  width: number;
  height: number;
  inferMs: number;
  totalMs: number;
}
