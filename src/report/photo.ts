// Photo helpers for reporting: read GPS from EXIF, and shrink the photo before upload
// (max 1024 px on the long side, JPEG ~0.7) so a report stays around 100-250 KB.
import exifr from 'exifr';
import type { LatLng } from '../geo/geo';

export const MAX_SIDE = 1024;
export const MAX_UPLOAD_BYTES = 330 * 1024; // the server takes up to 350 KB

export async function gpsFromPhoto(file: Blob): Promise<LatLng | null> {
  try {
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude) && !(gps.latitude === 0 && gps.longitude === 0)) {
      return [gps.latitude, gps.longitude];
    }
  } catch {
    /* no EXIF, or not a JPEG/HEIC with GPS */
  }
  return null;
}

// decode with the EXIF orientation applied, so phone photos aren't sideways
export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // some browsers can't decode HEIC etc. through createImageBitmap; go through <img>
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode photo'))), 'image/jpeg', quality),
  );
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

// returns a small JPEG data URL (and a canvas with the same pixels for detection)
export async function shrinkPhoto(bitmap: ImageBitmap): Promise<{ dataUrl: string; canvas: HTMLCanvasElement; bytes: number }> {
  let side = MAX_SIDE;
  let quality = 0.72;
  for (let attempt = 0; attempt < 5; attempt++) {
    const s = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * s);
    canvas.height = Math.round(bitmap.height * s);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await toBlob(canvas, quality);
    if (blob.size <= MAX_UPLOAD_BYTES || attempt === 4) {
      return { dataUrl: await blobToDataUrl(blob), canvas, bytes: blob.size };
    }
    quality -= 0.1;
    side = Math.round(side * 0.85);
  }
  throw new Error('unreachable');
}
