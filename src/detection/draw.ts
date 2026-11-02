import type { Detection, Severity } from './postprocess';

export const SEVERITY_COLOR: Record<Severity, string> = {
  low: '#facc15',
  medium: '#fb923c',
  high: '#f43f5e',
};

export interface DrawItem {
  det: Detection;
  label?: string; // e.g. track id
  confirmed?: boolean;
}

const maskCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

// Draw boxes/masks for a frame of size (srcW, srcH) onto a canvas that is
// showing that frame at (dx, dy, dw, dh) - i.e. object-fit: contain.
export function drawDetections(
  ctx: CanvasRenderingContext2D,
  items: DrawItem[],
  srcW: number,
  srcH: number,
  view: { dx: number; dy: number; dw: number; dh: number },
  opts: { masks: boolean },
) {
  const sx = view.dw / srcW;
  const sy = view.dh / srcH;
  for (const { det, label, confirmed } of items) {
    const color = SEVERITY_COLOR[det.severity ?? 'low'];
    const x = view.dx + det.x1 * sx;
    const y = view.dy + det.y1 * sy;
    const w = (det.x2 - det.x1) * sx;
    const h = (det.y2 - det.y1) * sy;

    if (opts.masks && det.mask && maskCanvas) {
      const m = det.mask;
      maskCanvas.width = m.w;
      maskCanvas.height = m.h;
      const mctx = maskCanvas.getContext('2d')!;
      const img = mctx.createImageData(m.w, m.h);
      const [r, g, b] = hexToRgb(color);
      for (let i = 0; i < m.data.length; i++) {
        if (!m.data[i]) continue;
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 110;
      }
      mctx.putImageData(img, 0, 0);
      ctx.save();
      // keep the mask inside the box
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(maskCanvas, view.dx + m.x * sx, view.dy + m.y * sy, m.dw * sx, m.dh * sy);
      ctx.restore();
    }

    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.setLineDash(confirmed === false ? [6, 4] : []);
    roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();
    ctx.setLineDash([]);

    const text = `${label ? label + '  ' : ''}${Math.round(det.score * 100)}% · ${det.severity ?? ''}`;
    ctx.font = '600 12px "Inter Variable", system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 12;
    const ty = y > 22 ? y - 22 : y + h + 4;
    ctx.fillStyle = color;
    roundRect(ctx, x, ty, tw, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#111113';
    ctx.fillText(text, x + 6, ty + 13);
    ctx.restore();
  }
}

export function containRect(srcW: number, srcH: number, boxW: number, boxH: number) {
  const s = Math.min(boxW / srcW, boxH / srcH);
  const dw = srcW * s;
  const dh = srcH * s;
  return { dx: (boxW - dw) / 2, dy: (boxH - dh) / 2, dw, dh };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
