// Draws a photo (object-fit: contain) with the detection boxes on top, sharp on retina.
import { useEffect, useRef } from 'react';
import type { Detection } from '../detection/postprocess';
import { containRect, drawDetections } from '../detection/draw';

export default function PhotoPreview({ image, dets, className = '' }: { image: CanvasImageSource & { width: number; height: number }; dets: Detection[] | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const view = containRect(image.width, image.height, w, h);
      ctx.drawImage(image, view.dx, view.dy, view.dw, view.dh);
      if (dets?.length) drawDetections(ctx, dets.map((det) => ({ det })), image.width, image.height, view, { masks: true });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [image, dets]);

  return <canvas ref={ref} className={`block w-full rounded-xl bg-[#111] ${className}`} role="img" aria-label={dets?.length ? `Photo with ${dets.length} detected pothole(s)` : 'Photo preview'} />;
}
