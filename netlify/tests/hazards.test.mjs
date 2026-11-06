// node --test netlify/tests/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteReportsOf, handle, validate, RATE_LIMIT, NEW_ACCOUNT_LIMIT, MAX_PHOTO_BYTES, DAILY_LIMIT } from '../functions/lib/hazards-core.mjs';
import { tileKeyFor, isReportId, tileKeyOfId, tileKeysForBbox } from '../functions/lib/tiles.mjs';
import { alice, bob, create, del, deps, fakeJpeg, get, post, report, ORIGIN } from './helpers.mjs';

test('validate rejects bad input', () => {
  assert.ok(validate({ ...report, lat: 120 }).error);
  assert.ok(validate({ ...report, lat: null }).error);
  assert.ok(validate({ ...report, severity: 'extreme' }).error);
  assert.ok(validate({ ...report, type: 'ufo' }).error);
  assert.ok(validate({ ...report, confidence: 3 }).error);
  assert.ok(validate({ ...report, potholes: -1 }).error);
  assert.ok(validate({ ...report, photo: 'data:image/png;base64,AAAA' }).error);
  assert.ok(validate({ ...report, photo: 'data:image/jpeg;base64,' + Buffer.alloc(300).toString('base64') }).error);
  const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_PHOTO_BYTES)]).toString('base64');
  assert.ok(validate({ ...report, photo: big }).error);
  assert.equal(validate({ ...report, note: '<b>hi</b>\n' + 'x'.repeat(300) }).value.note.length, 140);
  assert.equal(validate({ ...report, source: 'satellite' }).value.source, 'manual');
  assert.equal(validate({ ...report, type: undefined }).value.type, 'pothole');
  assert.equal(validate({ ...report, lat: 16.30671234 }).value.lat, 16.30671);
  assert.ok(validate({ ...report, photo: fakeJpeg }).photo.length > 100);
});

test('ids carry their tile and tiles cover bounding boxes', () => {
  const key = tileKeyFor(16.3067, 80.4365);
  assert.match(key, /^t\/\d+_\d+$/);
  assert.equal(tileKeyFor(16.3099, 80.4399), key); // same 0.1 degree square
  assert.notEqual(tileKeyFor(16.4001, 80.4365), key);
  const id = `${key.slice(2)}.11111111-1111-4111-8111-111111111111`;
  assert.ok(isReportId(id));
  assert.equal(tileKeyOfId(id), key);
  assert.ok(!isReportId('../../etc/passwd'));
  assert.ok(!isReportId('11111111-1111-4111-8111-111111111111'));
  const keys = tileKeysForBbox([80.3, 16.2, 80.5, 16.4]);
  assert.ok(keys.includes(key));
  assert.ok(keys.length >= 4 && keys.length <= 16);
});

test('anyone can read, nobody anonymous can write', async () => {
  const d = deps();
  const res = await handle(get(), d);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).hazards, []);
  assert.equal((await handle(post(report), d)).status, 401);
  assert.equal((await handle(get('/api/hazards?mine=1'), d)).status, 401);
});

test('a signed-in user can report, with a photo whose metadata is stripped, and sees it as theirs', async () => {
  const d = deps();
  const res = await handle(post({ ...report, photo: fakeJpeg }), { ...d, user: alice });
  assert.equal(res.status, 201);
  const { hazard } = await res.json();
  assert.equal(hazard.mine, true);
  assert.equal(hazard.hasPhoto, true);
  assert.equal(hazard.type, 'pothole');
  assert.equal(hazard.status, 'open');
  assert.equal(hazard.confirmations, 1);
  assert.equal(hazard.verified, false);
  assert.ok(isReportId(hazard.id));
  const stored = Buffer.from(await d.photos.get(hazard.id));
  assert.ok(stored.length > 100);
  assert.ok(!stored.includes(Buffer.from('GPS-LAT')), 'EXIF block must not be stored');
  assert.ok(!stored.includes(Buffer.from('Exif')));
  // others see it, but not as theirs, and never the owner id or the name
  const asBob = await (await handle(get(), { ...d, user: bob })).json();
  assert.equal(asBob.count, 1);
  assert.equal(asBob.hazards[0].mine, false);
  assert.equal(asBob.hazards[0].ownerId, undefined);
  assert.equal(asBob.hazards[0].by, undefined);
  assert.ok(!JSON.stringify(asBob).includes(alice.id));
  assert.equal((await (await handle(get('/api/hazards?mine=1'), { ...d, user: alice })).json()).count, 1);
  assert.equal((await (await handle(get('/api/hazards?mine=1'), { ...d, user: bob })).json()).count, 0);
});

test('reports land in the tile of their location and bbox reads only return that area', async () => {
  const d = deps();
  await create(handle, d, alice, report);
  await create(handle, d, alice, { ...report, lat: 17.385, lng: 78.4867 }); // hyderabad
  assert.equal([...d.store._data.keys()].filter((k) => k.startsWith('t/')).length, 2);
  const all = await (await handle(get(), d)).json();
  assert.equal(all.count, 2);
  const guntur = await (await handle(get('/api/hazards?bbox=80.3,16.2,80.6,16.5'), d)).json();
  assert.equal(guntur.count, 1);
  assert.equal(guntur.hazards[0].lat, 16.3067);
  assert.equal((await handle(get('/api/hazards?bbox=1,2,3'), d)).status, 400);
  assert.equal((await handle(get('/api/hazards?bbox=-180,-90,180,90'), d)).status, 400); // whole world is too many tiles
});

test('only the owner can delete a report, and its photo goes too', async () => {
  const d = deps();
  const hazard = await create(handle, d, alice, { ...report, photo: fakeJpeg });
  assert.equal((await handle(del(`/api/hazards/${hazard.id}`), d)).status, 401);
  assert.equal((await handle(del(`/api/hazards/${hazard.id}`), { ...d, user: bob, id: hazard.id })).status, 403);
  assert.equal((await handle(del(`/api/hazards/${hazard.id}`), { ...d, user: alice, id: hazard.id })).status, 200);
  assert.equal((await handle(del(`/api/hazards/${hazard.id}`), { ...d, user: alice, id: hazard.id })).status, 404);
  assert.equal(await d.photos.get(hazard.id), null);
  assert.equal((await (await handle(get(), d)).json()).count, 0);
  assert.equal((await handle(del('/api/hazards/nope'), { ...d, user: alice, id: 'nope' })).status, 404);
});

test('reports from version 3 (one big blob) are moved into tiles on first read, photos included', async () => {
  const d = deps();
  const oldId = '5b0f6f60-1111-4111-8111-aaaaaaaaaaaa';
  await d.photos.set(oldId, Buffer.from('photo'));
  await d.store.setJSON('reports', [
    { id: oldId, lat: 16.3, lng: 80.4, severity: 'low', source: 'camera', createdAt: '2026-11-02T10:00:00Z', ownerId: alice.id, ownerName: 'Alice', hasPhoto: true },
  ]);
  const list = await (await handle(get(), { ...d, user: alice })).json();
  assert.equal(list.count, 1);
  assert.equal(list.hazards[0].mine, true);
  assert.equal(list.hazards[0].type, 'pothole');
  assert.ok(isReportId(list.hazards[0].id));
  assert.equal(await d.store.get('reports'), null);
  assert.equal(await d.photos.get(oldId), null);
  assert.ok(await d.photos.get(list.hazards[0].id));
  assert.equal((await (await handle(get(), d)).json()).count, 1); // second read changes nothing
});

test('the same person reporting the same kind of hazard at the same spot twice gets a 409, someone else does not', async () => {
  const d = deps();
  await handle(post(report), { ...d, user: alice });
  const again = await handle(post({ ...report, lat: report.lat + 0.00005 }), { ...d, user: alice });
  assert.equal(again.status, 409);
  assert.ok((await again.json()).hazard.id);
  assert.equal((await handle(post({ ...report, lat: report.lat + 0.00005 }), { ...d, user: bob })).status, 201);
  // a different kind of hazard at the same spot is fine
  assert.equal((await handle(post({ ...report, type: 'waterlogging' }), { ...d, user: alice })).status, 201);
});

test('bad JSON, wrong origin and wrong methods are rejected', async () => {
  const d = deps({ user: alice });
  assert.equal((await handle(post('{nope'), d)).status, 400);
  assert.equal((await handle(post({ ...report, lng: 'abc' }), d)).status, 400);
  assert.equal((await handle(post(report, { origin: 'https://evil.example' }), d)).status, 403);
  assert.equal((await handle(new Request(`${ORIGIN}/api/hazards`, { method: 'PUT', headers: { origin: ORIGIN } }), d)).status, 405);
  assert.equal((await handle(post('x'.repeat(600 * 1024)), d)).status, 413);
  assert.equal((await handle(get('/api/hazards/x/unknown'), { ...d, action: 'unknown', id: 'x' })).status, 404);
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

test('brand-new accounts get a smaller allowance in their first hour, there is also a daily cap', async () => {
  const d = deps();
  const now = Date.parse('2026-11-07T10:00:00Z');
  const fresh = { ...bob, createdAt: new Date(now - 5 * 60000).toISOString() };
  for (let i = 0; i < NEW_ACCOUNT_LIMIT.max; i++) {
    assert.equal((await handle(post({ ...report, lat: 10 + i * 0.2 }), { ...d, user: fresh, now })).status, 201);
  }
  const blocked = await handle(post({ ...report, lat: 20 }), { ...d, user: fresh, now });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /New accounts/);
  // an older account is not held to that
  const old = { ...alice, createdAt: new Date(now - 3 * 86400000).toISOString() };
  assert.equal((await handle(post({ ...report, lat: 21 }), { ...d, user: old, now })).status, 201);
  // daily cap: 60 per rolling day, regardless of the 10-minute window
  const d2 = deps();
  let t = now;
  let created = 0;
  for (let i = 0; i < DAILY_LIMIT.max + 5; i++) {
    t += 11 * 60000; // always outside the 10 minute window, but still inside the day
    if (t - now > 23 * 3600000) break;
    const r = await handle(post({ ...report, lat: -40 + i * 0.3 }), { ...d2, user: alice, now: t });
    if (r.status === 201) created++;
    else assert.equal(r.status, 429);
  }
  assert.equal(created, DAILY_LIMIT.max);
});

test('a write that loses the race is retried', async () => {
  const d = deps({ user: alice });
  await handle(post(report), d);
  const key = tileKeyFor(report.lat, report.lng);
  const realSet = d.store.setJSON;
  let first = true;
  d.store.setJSON = async (k, value, opts) => {
    if (k === key && first) {
      first = false;
      const current = await d.store.get(k);
      await realSet(k, current, {}); // same data, new etag
      return { modified: false };
    }
    return realSet(k, value, opts);
  };
  const res = await handle(post({ ...report, lat: report.lat + 0.01 }), d);
  assert.equal(res.status, 201);
  assert.equal((await (await handle(get(), d)).json()).count, 2);
});

test('deleting an account removes its reports and photos, and takes its votes back', async () => {
  const d = deps();
  const a1 = await create(handle, d, alice, { ...report, photo: fakeJpeg });
  await create(handle, d, alice, { ...report, lat: 17.4, lng: 78.5 });
  const b1 = await create(handle, d, bob, { ...report, lat: 16.5 });
  await handle(post({ vote: 'confirm' }, {}, `/api/hazards/${b1.id}/vote`), { ...d, user: alice, id: b1.id, action: 'vote' });
  assert.equal((await (await handle(get(`/api/hazards/${b1.id}`), { ...d, id: b1.id })).json()).hazard.confirmations, 2);
  assert.equal(await deleteReportsOf(d.store, d.photos, alice.id), 2);
  assert.equal(await d.photos.get(a1.id), null);
  const left = (await (await handle(get(), d)).json()).hazards;
  assert.equal(left.length, 1);
  assert.equal(left[0].confirmations, 1);
  assert.ok(!JSON.stringify([...d.store._data.values()]).includes(alice.id));
});

test('works on a blob store that sends no etags (netlify dev)', async () => {
  const d = deps({ user: alice });
  const real = d.store.getWithMetadata;
  d.store.getWithMetadata = async (k, o) => {
    const r = await real(k, o);
    return r && { ...r, etag: undefined };
  };
  const { hazard } = await (await handle(post(report), d)).json();
  assert.equal((await handle(post({ ...report, lat: 17 }), d)).status, 201);
  assert.equal((await handle(del(`/api/hazards/${hazard.id}`), { ...d, id: hazard.id })).status, 200);
  assert.equal((await (await handle(get(), d)).json()).count, 1);
});
