// Very small IoU tracker so the same pothole is not counted on every frame.
// Each frame: match detections to existing tracks (greedy, best overlap first),
// start new tentative tracks for the rest, and drop tracks not seen for a while.
// A track only counts as a pothole after it was matched in `minHits` frames.

import { iou, type Detection, type Severity } from './postprocess';

export interface Track {
  id: number;
  box: Detection;
  hits: number;
  misses: number;
  confirmed: boolean;
  bestScore: number;
  severity: Severity;
  firstFrame: number;
  lastFrame: number;
}

export interface TrackerOptions {
  iouThr?: number;
  minHits?: number;
  maxMisses?: number;
}

const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

export class Tracker {
  tracks: Track[] = [];
  confirmedTotal = 0;
  onConfirm?: (t: Track) => void;
  private nextId = 1;
  private frame = 0;
  private iouThr: number;
  private minHits: number;
  private maxMisses: number;

  constructor(opts: TrackerOptions = {}) {
    this.iouThr = opts.iouThr ?? 0.2;
    this.minHits = opts.minHits ?? 3;
    this.maxMisses = opts.maxMisses ?? 12;
  }

  reset() {
    this.tracks = [];
    this.confirmedTotal = 0;
    this.nextId = 1;
    this.frame = 0;
  }

  update(dets: Detection[]): Track[] {
    this.frame++;
    const pairs: { t: number; d: number; score: number }[] = [];
    this.tracks.forEach((tr, ti) => {
      dets.forEach((det, di) => {
        let s = iou(tr.box, det);
        // potholes move fast towards the bottom of the frame while driving, so also
        // accept a close centre even if the boxes barely overlap
        if (s < this.iouThr && centreClose(tr.box, det)) s = this.iouThr;
        if (s >= this.iouThr) pairs.push({ t: ti, d: di, score: s });
      });
    });
    pairs.sort((a, b) => b.score - a.score);
    const usedT = new Set<number>();
    const usedD = new Set<number>();
    for (const p of pairs) {
      if (usedT.has(p.t) || usedD.has(p.d)) continue;
      usedT.add(p.t);
      usedD.add(p.d);
      const tr = this.tracks[p.t];
      const det = dets[p.d];
      tr.box = det;
      tr.hits++;
      tr.misses = 0;
      tr.lastFrame = this.frame;
      tr.bestScore = Math.max(tr.bestScore, det.score);
      if (det.severity && RANK[det.severity] > RANK[tr.severity]) tr.severity = det.severity;
      if (!tr.confirmed && tr.hits >= this.minHits) this.confirm(tr);
    }
    this.tracks.forEach((tr, i) => {
      if (!usedT.has(i)) tr.misses++;
    });
    dets.forEach((det, i) => {
      if (usedD.has(i)) return;
      const tr: Track = {
        id: this.nextId++,
        box: det,
        hits: 1,
        misses: 0,
        confirmed: false,
        bestScore: det.score,
        severity: det.severity ?? 'low',
        firstFrame: this.frame,
        lastFrame: this.frame,
      };
      this.tracks.push(tr);
      if (this.minHits <= 1) this.confirm(tr);
    });
    this.tracks = this.tracks.filter((t) => t.misses <= this.maxMisses);
    return this.tracks;
  }

  private confirm(tr: Track) {
    tr.confirmed = true;
    this.confirmedTotal++;
    this.onConfirm?.(tr);
  }
}

function centreClose(a: Detection, b: Detection) {
  const ax = (a.x1 + a.x2) / 2;
  const ay = (a.y1 + a.y2) / 2;
  const bx = (b.x1 + b.x2) / 2;
  const by = (b.y1 + b.y2) / 2;
  const size = Math.max(a.x2 - a.x1, a.y2 - a.y1, b.x2 - b.x1, b.y2 - b.y1);
  return Math.hypot(ax - bx, ay - by) < 0.6 * size;
}
