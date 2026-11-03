// node --test netlify/tests/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteReportsOf, handle, validate, RATE_LIMIT, MAX_PHOTO_BYTES } from '../functions/lib/hazards-core.mjs';
import { memoryStore } from './memory-store.mjs';

const ORIGIN = 'https://thesaferoads.netlify.app';
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice Rao' };
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' };

const post = (body, headers = {}) =>
  new Request(`${ORIGIN}/api/hazards`, {
    method: 'POST',
    headers: { origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const del = (id, headers = {}) => new Request(`${ORIGIN}/api/hazards/${id}`, { method: 'DELETE', headers: { origin: ORIGIN, ...headers } });
const get = (q = '') => new Request(`${ORIGIN}/api/hazards${q}`);
const deps = (extra = {}) => ({ store: memoryStore(), photos: memoryStore(), limits: memoryStore(), ip: '1.1.1.1', ...extra });
const report = { lat: 16.3067, lng: 80.4365, severity: 'high', confidence: 0.81, source: 'photo', note: 'near the bus stand', potholes: 2 };
// smallest thing that passes the JPEG check
const fakeJpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString('base64');

test('validate rejects bad input', () => {
  assert.ok(validate({ ...report, lat: 120 }).error);
  assert.ok(validate({ ...report, lat: null }).error);
  assert.ok(validate({ ...report, severity: 'extreme' }).error);
  assert.ok(validate({ ...report, confidence: 3 }).error);
  assert.ok(validate({ ...report, potholes: -1 }).error);
  assert.ok(validate({ ...report, photo: 'data:image/png;base64,AAAA' }).error);
  assert.ok(validate({ ...report, photo: 'data:image/jpeg;base64,' + Buffer.alloc(300).toString('base64') }).error);
  const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_PHOTO_BYTES)]).toString('base64');
  assert.ok(validate({ ...report, photo: big }).error);
  assert.equal(validate({ ...report, note: '<b>hi</b>\n' + 'x'.repeat(300) }).value.note.length, 140);
  assert.equal(validate({ ...report, source: 'satellite' }).value.source, 'manual');
  assert.ok(validate({ ...report, photo: fakeJpeg }).photo.length > 100);
});

test('anyone can read, nobody anonymous can write', async () => {
  const d = deps();
  const res = await handle(get(), d);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).hazards, []);
  assert.equal((await handle(post(report), d)).status, 401);
  assert.equal((await handle(get('?mine=1'), d)).status, 401);
});

test('a signed-in user can report, with a photo, and sees it as theirs', async () => {
  const d = deps();
  const res = await handle(post({ ...report, photo: fakeJpeg }), { ...d, user: alice });
  assert.equal(res.status, 201);
  const { hazard } = await res.json();
  assert.equal(hazard.by, 'Alice');
  assert.equal(hazard.mine, true);
  assert.equal(hazard.hasPhoto, true);
  assert.ok(await d.photos.get(hazard.id));
  // others see it, but not as theirs, and never the owner id
  const asBob = await (await handle(get(), { ...d, user: bob })).json();
  assert.equal(asBob.count, 1);
  assert.equal(asBob.hazards[0].mine, false);
  assert.equal(asBob.hazards[0].ownerId, undefined);
  // my reports
  assert.equal((await (await handle(get('?mine=1'), { ...d, user: alice })).json()).count, 1);
  assert.equal((await (await handle(get('?mine=1'), { ...d, user: bob })).json()).count, 0);
});

test('only the owner can delete a report, and its photo goes too', async () => {
  const d = deps();
  const { hazard } = await (await handle(post({ ...report, photo: fakeJpeg }), { ...d, user: alice })).json();
  assert.equal((await handle(del(hazard.id), d)).status, 401);
  assert.equal((await handle(del(hazard.id), { ...d, user: bob, id: hazard.id })).status, 403);
  assert.equal((await handle(del(hazard.id), { ...d, user: alice, id: hazard.id })).status, 200);
  assert.equal((await handle(del(hazard.id), { ...d, user: alice, id: hazard.id })).status, 404);
  assert.equal(await d.photos.get(hazard.id), null);
  assert.equal((await (await handle(get(), d)).json()).count, 0);
});

test('old reports without an owner survive and cannot be deleted', async () => {
  const d = deps();
  await d.store.setJSON('reports', [{ id: 'old-1', lat: 16.3, lng: 80.4, severity: 'low', source: 'camera', createdAt: '2026-11-02T10:00:00Z', confirmations: 2 }]);
  const list = await (await handle(get(), { ...d, user: alice })).json();
  assert.equal(list.count, 1);
  assert.equal(list.hazards[0].by, null);
  assert.equal(list.hazards[0].mine, false);
  assert.equal((await handle(del('old-1'), { ...d, user: alice, id: 'old-1' })).status, 403);
  // a new report is added next to it, not merged into it
  assert.equal((await handle(post({ ...report, lat: 16.3, lng: 80.4 }), { ...d, user: alice })).status, 201);
  assert.equal((await (await handle(get(), d)).json()).count, 2);
});

test('the same person reporting the same spot twice gets a 409, someone else does not', async () => {
  const d = deps();
  await handle(post(report), { ...d, user: alice });
  const again = await handle(post({ ...report, lat: report.lat + 0.00005 }), { ...d, user: alice });
  assert.equal(again.status, 409);
  assert.ok((await again.json()).hazard.id);
  assert.equal((await handle(post({ ...report, lat: report.lat + 0.00005 }), { ...d, user: bob })).status, 201);
});

test('bad JSON, wrong origin and wrong methods are rejected', async () => {
  const d = deps({ user: alice });
  assert.equal((await handle(post('{nope'), d)).status, 400);
  assert.equal((await handle(post({ ...report, lng: 'abc' }), d)).status, 400);
  assert.equal((await handle(post(report, { origin: 'https://evil.example' }), d)).status, 403);
  assert.equal((await handle(new Request(`${ORIGIN}/api/hazards`, { method: 'PUT', headers: { origin: ORIGIN } }), d)).status, 405);
  assert.equal((await handle(post('x'.repeat(600 * 1024)), d)).status, 413);
});

test('reporting is rate limited per user and resets after the window', async () => {
  const d = deps();
  const now = 1_000_000;
  for (let i = 0; i < RATE_LIMIT.max; i++) {
    const r = await handle(post({ ...report, lat: report.lat + i * 0.01 }), { ...d, user: alice, now });
    assert.equal(r.status, 201);
  }
  const blocked = await handle(post({ ...report, lat: 10 }), { ...d, user: alice, now });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal((await handle(post({ ...report, lat: 11 }), { ...d, user: bob, now })).status, 201);
  const later = await handle(post({ ...report, lat: 12 }), { ...d, user: alice, now: now + RATE_LIMIT.windowMs + 1 });
  assert.equal(later.status, 201);
  assert.ok([...d.limits._data.keys()].every((k) => !k.includes('1.1.1.1') && !k.includes(alice.id)));
});

test('a write that loses the race is retried', async () => {
  const d = deps({ user: alice });
  await handle(post(report), d);
  const realSet = d.store.setJSON;
  let first = true;
  d.store.setJSON = async (key, value, opts) => {
    if (key === 'reports' && first) {
      first = false;
      const current = await d.store.get(key);
      await realSet(key, current, {}); // same data, new etag
      return { modified: false };
    }
    return realSet(key, value, opts);
  };
  const res = await handle(post({ ...report, lat: 17 }), d);
  assert.equal(res.status, 201);
  assert.equal((await (await handle(get(), d)).json()).count, 2);
});

test('deleting an account removes all of its reports and photos', async () => {
  const d = deps();
  const a1 = (await (await handle(post({ ...report, photo: fakeJpeg }), { ...d, user: alice })).json()).hazard;
  await handle(post({ ...report, lat: 16.4 }), { ...d, user: alice });
  await handle(post({ ...report, lat: 16.5 }), { ...d, user: bob });
  assert.equal(await deleteReportsOf(d.store, d.photos, alice.id), 2);
  assert.equal(await d.photos.get(a1.id), null);
  const left = (await (await handle(get(), d)).json()).hazards;
  assert.equal(left.length, 1);
  assert.equal(left[0].by, 'Bob');
});

test('works on a blob store that sends no etags (netlify dev)', async () => {
  const d = deps({ user: alice });
  const real = d.store.getWithMetadata;
  d.store.getWithMetadata = async (k) => {
    const r = await real(k);
    return r && { ...r, etag: undefined };
  };
  const { hazard } = await (await handle(post(report), d)).json();
  assert.equal((await handle(post({ ...report, lat: 17 }), d)).status, 201);
  assert.equal((await handle(del(hazard.id), { ...d, id: hazard.id })).status, 200);
  assert.equal((await (await handle(get(), d)).json()).count, 1);
});
