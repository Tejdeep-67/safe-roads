import { describe, expect, it } from 'vitest';
import { Tracker } from './tracker';
import type { Detection } from './postprocess';

const box = (x: number, y: number, s = 40): Detection => ({ x1: x, y1: y, x2: x + s, y2: y + s, score: 0.8 });

describe('Tracker', () => {
  it('counts one pothole that moves down the frame once', () => {
    const t = new Tracker({ minHits: 3 });
    for (let f = 0; f < 20; f++) t.update([box(100, 100 + f * 8)]);
    expect(t.confirmedTotal).toBe(1);
  });

  it('ignores a one-frame false positive', () => {
    const t = new Tracker({ minHits: 3 });
    t.update([box(300, 300)]);
    for (let f = 0; f < 5; f++) t.update([]);
    expect(t.confirmedTotal).toBe(0);
  });

  it('counts two separate potholes', () => {
    const t = new Tracker({ minHits: 2 });
    for (let f = 0; f < 5; f++) t.update([box(50, 50), box(400, 300)]);
    expect(t.confirmedTotal).toBe(2);
  });

  it('a pothole that disappears for long and comes back is a new one', () => {
    const t = new Tracker({ minHits: 2, maxMisses: 3 });
    for (let f = 0; f < 3; f++) t.update([box(50, 50)]);
    for (let f = 0; f < 6; f++) t.update([]);
    for (let f = 0; f < 3; f++) t.update([box(50, 50)]);
    expect(t.confirmedTotal).toBe(2);
  });
});
