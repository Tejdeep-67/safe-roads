import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasExif, stripJpegMetadata } from '../functions/lib/jpeg.mjs';
import { jpegBytes } from './helpers.mjs';

test('EXIF, comments and XMP are removed, the image data and JFIF header stay', () => {
  assert.equal(hasExif(jpegBytes), true);
  const out = stripJpegMetadata(jpegBytes);
  assert.equal(hasExif(out), false);
  assert.ok(!out.includes(Buffer.from('GPS-LAT')));
  assert.ok(!out.includes(Buffer.from('hi!!')));
  assert.ok(out.includes(Buffer.from('JFIF')));
  assert.equal(out[0], 0xff);
  assert.equal(out[1], 0xd8);
  assert.deepEqual([...out.subarray(-2)], [0xff, 0xd9]);
  // quantisation table and scan data are untouched
  assert.ok(out.includes(Buffer.from([0xff, 0xdb, 0x00, 0x05])));
  assert.ok(out.includes(Buffer.alloc(200, 7)));
  assert.ok(out.length < jpegBytes.length);
});

test('a file that is already clean comes out byte for byte the same', () => {
  const clean = stripJpegMetadata(jpegBytes);
  assert.deepEqual(stripJpegMetadata(clean), clean);
});

test('garbage and truncated files are rejected, not stored', () => {
  assert.throws(() => stripJpegMetadata(Buffer.from('hello world')));
  assert.throws(() => stripJpegMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00])));
  assert.throws(() => stripJpegMetadata(Buffer.from([0xff, 0xd8, 0x00, 0x00])));
});
