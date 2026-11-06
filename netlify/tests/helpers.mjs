import { memoryStore } from './memory-store.mjs';

export const ORIGIN = 'https://thesaferoads.netlify.app';
export const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice Rao', email: 'alice@example.com' };
export const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob', email: 'bob@example.com' };
export const carol = { id: '33333333-3333-4333-8333-333333333333', name: 'Carol', email: 'carol@example.com' };
export const dave = { id: '44444444-4444-4444-8444-444444444444', name: 'Dave', email: 'dave@example.com' };
export const mod = { id: '99999999-9999-4999-8999-999999999999', name: 'Mod', email: 'Mod@Example.com' };

export const post = (body, headers = {}, path = '/api/hazards') =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
export const del = (path, headers = {}) => new Request(`${ORIGIN}${path}`, { method: 'DELETE', headers: { origin: ORIGIN, ...headers } });
export const get = (path = '/api/hazards', headers = {}) => new Request(`${ORIGIN}${path}`, { headers });

export const deps = (extra = {}) => ({ store: memoryStore(), photos: memoryStore(), limits: memoryStore(), ip: '1.1.1.1', ...extra });
export const report = { lat: 16.3067, lng: 80.4365, type: 'pothole', severity: 'high', confidence: 0.81, source: 'photo', note: 'near the bus stand', potholes: 2 };

// smallest thing that passes the JPEG check; carries an EXIF block with a fake GPS marker in it
export const exifBlock = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x30]), Buffer.from('Exif\0\0'), Buffer.from('GPS-LAT-16.3067-LNG-80.4365-CAMERA-X'.padEnd(40, '.'))]);
export const jpegBytes = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'),
  exifBlock,
  Buffer.from([0xff, 0xfe, 0x00, 0x06, 0x68, 0x69, 0x21, 0x21]),
  Buffer.from([0xff, 0xdb, 0x00, 0x05, 0x00, 0x08, 0x06]),
  Buffer.from([0xff, 0xda, 0x00, 0x04, 0x00, 0x00]),
  Buffer.alloc(200, 7),
  Buffer.from([0xff, 0xd9]),
]);
export const fakeJpeg = 'data:image/jpeg;base64,' + jpegBytes.toString('base64');

// create a report as `user` and return the public hazard
export async function create(handle, d, user, body = report, now) {
  const res = await handle(post(body), { ...d, user, now });
  if (res.status !== 201) throw new Error(`create failed ${res.status} ${await res.text()}`);
  return (await res.json()).hazard;
}
export const vote = (handle, d, user, id, v, reason, now) =>
  handle(post({ vote: v, reason }, {}, `/api/hazards/${id}/vote`), { ...d, user, id, action: 'vote', now });
