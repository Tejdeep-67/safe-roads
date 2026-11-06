// Strip metadata from a JPEG before it is stored: EXIF (camera model, GPS position of the
// phone, timestamps), XMP, ICC profiles, comments and anything else that is not needed to
// draw the picture. Only the image-decoding segments are kept.
//
// JPEG layout: FFD8 (SOI), then segments "FF <marker> <len hi> <len lo> <payload>", then the
// entropy-coded image data after SOS (FFDA) up to FFD9 (EOI).
// We drop APP1..APP15 and COM; APP0 (JFIF) and APP14 (Adobe colour transform) are kept
// because decoders need them to get the colours right.

const KEEP_APP = new Set([0xe0, 0xee]);

export function stripJpegMetadata(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('not a JPEG');
  }
  const out = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('bad JPEG segment');
    // fill bytes: any number of FF before the marker
    let j = i;
    while (j < bytes.length && bytes[j] === 0xff) j++;
    const marker = bytes[j];
    if (marker === undefined) throw new Error('truncated JPEG');
    // standalone markers without a length: TEM, RSTn, SOI, EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      out.push(bytes.subarray(j - 1, j + 1));
      i = j + 1;
      if (marker === 0xd9) break;
      continue;
    }
    if (j + 2 >= bytes.length) throw new Error('truncated JPEG');
    const len = (bytes[j + 1] << 8) | bytes[j + 2];
    if (len < 2 || j + 1 + len > bytes.length) throw new Error('bad JPEG segment length');
    const end = j + 1 + len;
    if (marker === 0xda) {
      // start of scan: the compressed data runs to the end of the file, copy it as is
      out.push(bytes.subarray(j - 1));
      i = bytes.length;
      break;
    }
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const drop = (isApp && !KEEP_APP.has(marker)) || marker === 0xfe;
    if (!drop) out.push(bytes.subarray(j - 1, end));
    i = end;
  }
  return Buffer.concat(out);
}

// true when the picture still carries an EXIF block (used by tests)
export function hasExif(bytes) {
  let i = 2;
  while (i + 4 < bytes.length && bytes[i] === 0xff) {
    const m = bytes[i + 1];
    if (m === 0xda) return false;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (m === 0xe1 && bytes.subarray(i + 4, i + 10).toString('latin1') === 'Exif\0\0') return true;
    i += 2 + len;
  }
  return false;
}
