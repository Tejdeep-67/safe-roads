import { describe, expect, it } from 'vitest';
import { buildMask, decodeOutput, estimateSeverity, iou, letterbox, nms, type Detection } from './postprocess';

const box = (x1: number, y1: number, x2: number, y2: number, score = 0.9): Detection => ({ x1, y1, x2, y2, score });

describe('letterbox', () => {
  it('pads the short side and keeps aspect ratio', () => {
    const lb = letterbox(1280, 720, 640);
    expect(lb.scale).toBeCloseTo(0.5);
    expect(lb.padX).toBe(0);
    expect(lb.padY).toBe(140);
  });
});

describe('iou / nms', () => {
  it('iou of identical boxes is 1 and disjoint is 0', () => {
    expect(iou(box(0, 0, 10, 10), box(0, 0, 10, 10))).toBeCloseTo(1);
    expect(iou(box(0, 0, 10, 10), box(20, 20, 30, 30))).toBe(0);
    expect(iou(box(0, 0, 10, 10), box(5, 0, 15, 10))).toBeCloseTo(1 / 3);
  });
  it('nms keeps the highest score of overlapping boxes', () => {
    const kept = nms([box(0, 0, 10, 10, 0.6), box(1, 1, 11, 11, 0.9), box(50, 50, 60, 60, 0.5)]);
    expect(kept.map((k) => k.score)).toEqual([0.9, 0.5]);
  });
});

describe('decodeOutput', () => {
  it('reads channel-major output and undoes the letterbox', () => {
    const n = 3;
    const out = new Float32Array(37 * n);
    // anchor 1: centre (320, 320) size 100x50, score 0.8
    out[0 * n + 1] = 320;
    out[1 * n + 1] = 320;
    out[2 * n + 1] = 100;
    out[3 * n + 1] = 50;
    out[4 * n + 1] = 0.8;
    out[4 * n + 0] = 0.1; // below threshold
    const lb = letterbox(1280, 720, 640);
    const dets = decodeOutput(out, n, lb, 1280, 720, 0.35);
    expect(dets).toHaveLength(1);
    expect(dets[0].x1).toBeCloseTo((270 - 0) / 0.5);
    expect(dets[0].y1).toBeCloseTo((295 - 140) / 0.5);
    expect(dets[0].x2 - dets[0].x1).toBeCloseTo(200);
  });
});

describe('buildMask', () => {
  it('turns positive prototype values into mask pixels inside the box', () => {
    const lb = letterbox(64, 64, 64); // scale 1, no padding, proto grid 16x16
    const ph = 16;
    const protos = new Float32Array(32 * ph * ph);
    // prototype 0 is positive on the left half
    for (let y = 0; y < ph; y++) for (let x = 0; x < 8; x++) protos[y * ph + x] = 1;
    const coeffs = new Float32Array(32);
    coeffs[0] = 2;
    coeffs[1] = -0.5; // prototype 1 is all zeros so it does nothing
    const det: Detection = { ...box(0, 0, 64, 64), coeffs };
    const m = buildMask(det, protos, ph, ph, lb)!;
    expect(m.w).toBe(16);
    const on = m.data.reduce((s, v) => s + (v ? 1 : 0), 0);
    expect(on).toBe(8 * 16);
  });
});

describe('estimateSeverity', () => {
  it('a big close pothole is high, a tiny far one is low', () => {
    expect(estimateSeverity(box(300, 500, 900, 720, 0.8), 1280, 720)).toBe('high');
    expect(estimateSeverity(box(600, 300, 640, 320, 0.8), 1280, 720)).toBe('low');
  });
});
