// Pre/post-processing for the YOLOv8-seg model.
// The ONNX model gives two outputs:
//   output0: [1, 37, N]  -> per anchor: cx, cy, w, h, pothole score, 32 mask coefficients
//   output1: [1, 32, S/4, S/4] -> mask prototypes
// Everything here is plain math so it can run in the worker and be unit tested.

export type Severity = 'low' | 'medium' | 'high';

export interface Letterbox {
  size: number; // model input is size x size
  scale: number;
  padX: number;
  padY: number;
}

export interface Detection {
  // box in source image pixels
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  coeffs?: Float32Array;
  mask?: MaskCrop;
  severity?: Severity;
  areaFrac?: number; // fraction of the frame covered (mask if we have it, else box)
}

export interface MaskCrop {
  // binary mask (0/255) cropped to the box, in proto-grid resolution
  data: Uint8Array;
  w: number;
  h: number;
  // where the crop goes in source pixels
  x: number;
  y: number;
  dw: number;
  dh: number;
}

export const NUM_COEFFS = 32;

export function letterbox(srcW: number, srcH: number, size: number): Letterbox {
  const scale = Math.min(size / srcW, size / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  return { size, scale, padX: Math.floor((size - newW) / 2), padY: Math.floor((size - newH) / 2) };
}

export function iou(a: Detection, b: Detection): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-9);
}

// greedy non-max suppression: keep the best box, drop the ones overlapping it too much
export function nms(dets: Detection[], iouThr = 0.45): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: Detection[] = [];
  for (const d of sorted) {
    if (keep.every((k) => iou(k, d) < iouThr)) keep.push(d);
  }
  return keep;
}

export function decodeOutput(
  out: Float32Array,
  numAnchors: number,
  lb: Letterbox,
  srcW: number,
  srcH: number,
  conf = 0.35,
  iouThr = 0.45,
  maxDet = 50,
): Detection[] {
  const n = numAnchors;
  const cands: Detection[] = [];
  for (let i = 0; i < n; i++) {
    const score = out[4 * n + i];
    if (score < conf) continue;
    const cx = out[i];
    const cy = out[n + i];
    const w = out[2 * n + i];
    const h = out[3 * n + i];
    // letterbox space -> source image space
    const x1 = (cx - w / 2 - lb.padX) / lb.scale;
    const y1 = (cy - h / 2 - lb.padY) / lb.scale;
    const x2 = (cx + w / 2 - lb.padX) / lb.scale;
    const y2 = (cy + h / 2 - lb.padY) / lb.scale;
    const coeffs = new Float32Array(NUM_COEFFS);
    for (let k = 0; k < NUM_COEFFS; k++) coeffs[k] = out[(5 + k) * n + i];
    cands.push({
      x1: clamp(x1, 0, srcW),
      y1: clamp(y1, 0, srcH),
      x2: clamp(x2, 0, srcW),
      y2: clamp(y2, 0, srcH),
      score,
      coeffs,
    });
  }
  return nms(cands, iouThr)
    .filter((d) => d.x2 - d.x1 > 2 && d.y2 - d.y1 > 2)
    .slice(0, maxDet);
}

// mask = sigmoid(coeffs . protos), only computed inside the box
export function buildMask(
  det: Detection,
  protos: Float32Array,
  protoH: number,
  protoW: number,
  lb: Letterbox,
): MaskCrop | undefined {
  if (!det.coeffs) return undefined;
  const stride = lb.size / protoW; // 4 for this model
  // box in letterbox space, then in proto grid
  const bx1 = det.x1 * lb.scale + lb.padX;
  const by1 = det.y1 * lb.scale + lb.padY;
  const bx2 = det.x2 * lb.scale + lb.padX;
  const by2 = det.y2 * lb.scale + lb.padY;
  const gx1 = clamp(Math.floor(bx1 / stride), 0, protoW - 1);
  const gy1 = clamp(Math.floor(by1 / stride), 0, protoH - 1);
  const gx2 = clamp(Math.ceil(bx2 / stride), gx1 + 1, protoW);
  const gy2 = clamp(Math.ceil(by2 / stride), gy1 + 1, protoH);
  const w = gx2 - gx1;
  const h = gy2 - gy1;
  const data = new Uint8Array(w * h);
  const plane = protoH * protoW;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (gy1 + y) * protoW + gx1 + x;
      let v = 0;
      for (let k = 0; k < NUM_COEFFS; k++) v += det.coeffs[k] * protos[k * plane + idx];
      // sigmoid(v) > 0.5  <=>  v > 0
      data[y * w + x] = v > 0 ? 255 : 0;
    }
  }
  return {
    data,
    w,
    h,
    x: (gx1 * stride - lb.padX) / lb.scale,
    y: (gy1 * stride - lb.padY) / lb.scale,
    dw: (w * stride) / lb.scale,
    dh: (h * stride) / lb.scale,
  };
}

export function maskAreaFrac(mask: MaskCrop, srcW: number, srcH: number): number {
  let on = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) on++;
  const cellArea = (mask.dw / mask.w) * (mask.dh / mask.h);
  return (on * cellArea) / (srcW * srcH);
}

// Rough severity guess. A pothole lower in the frame is closer to the camera so it
// looks bigger than it is - divide by a simple perspective factor before comparing.
// This is a heuristic, not a measurement of real depth or size.
export function estimateSeverity(det: Detection, srcW: number, srcH: number, areaFrac?: number): Severity {
  const frac = areaFrac ?? ((det.x2 - det.x1) * (det.y2 - det.y1)) / (srcW * srcH);
  const bottom = det.y2 / srcH; // 0 = top of frame, 1 = bottom
  const perspective = 0.4 + 0.6 * bottom;
  const size = Math.sqrt(frac) / perspective;
  if (size > 0.28 && det.score > 0.45) return 'high';
  if (size > 0.13) return 'medium';
  return 'low';
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
