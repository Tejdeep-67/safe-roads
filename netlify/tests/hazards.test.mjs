// node --test netlify/functions/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle, validate, RATE_LIMIT } from '../functions/lib/hazards-core.mjs';

// tiny fake of the Netlify Blobs store with etags
function memoryStore() {
  const data = new Map();
  let version = 0;
  return {
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key).value) : null;
    },
    async getWithMetadata(key) {
      if (!data.has(key)) return null;
      const e = data.get(key);
      return { data: structuredClone(e.value), etag: e.etag, metadata: {} };
    },
    async setJSON(key, value, opts = {}) {
      const cur = data.get(key);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = `v${++version}`;
      data.set(key, { value: structuredClone(value), etag });
      return { modified: true, etag };
    },
    _data: data,
  };
}

const post = (body) =>
  new Request('http://localhost/api/hazards', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const report = { lat: 16.3067, lng: 80.4365, severity: 'high', confidence: 0.81, source: 'camera', note: 'near the bus stand' };

test('validate rejects bad input', () => {
  assert.ok(validate({ ...report, lat: 120 }).error);
  assert.ok(validate({ ...report, severity: 'extreme' }).error);
  assert.ok(validate({ ...report, confidence: 3 }).error);
  assert.equal(validate({ ...report, note: '<b>hi</b>\n' + 'x'.repeat(300) }).value.note.length, 140);
  assert.equal(validate({ ...report, source: 'satellite' }).value.source, 'manual');
});

test('GET on an empty store returns an empty list', async () => {
  const res = await handle(new Request('http://localhost/api/hazards'), { store: memoryStore(), ip: '1.1.1.1' });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).hazards, []);
});

test('POST stores a report and GET returns it', async () => {
  const store = memoryStore();
  const res = await handle(post(report), { store, ip: '1.1.1.1' });
  assert.equal(res.status, 201);
  const { hazard } = await res.json();
  assert.equal(hazard.severity, 'high');
  assert.ok(hazard.id);
  const list = await (await handle(new Request('http://localhost/api/hazards'), { store, ip: 'x' })).json();
  assert.equal(list.count, 1);
});

test('a second report within 15 m confirms the first instead of duplicating', async () => {
  const store = memoryStore();
  await handle(post({ ...report, severity: 'low' }), { store, ip: 'a' });
  const res = await handle(post({ ...report, lat: report.lat + 0.00005, severity: 'medium' }), { store, ip: 'b' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.merged, true);
  assert.equal(body.hazard.confirmations, 2);
  assert.equal(body.hazard.severity, 'medium');
});

test('bad JSON and wrong methods are rejected', async () => {
  const store = memoryStore();
  assert.equal((await handle(post('{nope'), { store, ip: 'a' })).status, 400);
  assert.equal((await handle(post({ ...report, lng: 'abc' }), { store, ip: 'a' })).status, 400);
  const del = await handle(new Request('http://localhost/api/hazards', { method: 'DELETE' }), { store, ip: 'a' });
  assert.equal(del.status, 405);
  assert.equal((await handle(post('x'.repeat(5000)), { store, ip: 'a' })).status, 413);
});

test('rate limit kicks in per IP and resets after the window', async () => {
  const store = memoryStore();
  const now = 1_000_000;
  for (let i = 0; i < RATE_LIMIT.max; i++) {
    const r = await handle(post({ ...report, lat: report.lat + i * 0.01 }), { store, ip: '9.9.9.9', now });
    assert.notEqual(r.status, 429);
  }
  const blocked = await handle(post({ ...report, lat: 10 }), { store, ip: '9.9.9.9', now });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  // another IP is fine
  assert.equal((await handle(post({ ...report, lat: 11 }), { store, ip: '8.8.8.8', now })).status, 201);
  // and the first IP works again later
  const later = await handle(post({ ...report, lat: 12 }), { store, ip: '9.9.9.9', now: now + RATE_LIMIT.windowMs + 1 });
  assert.equal(later.status, 201);
  // raw IPs are never stored
  assert.ok([...store._data.keys()].every((k) => !k.includes('9.9.9.9')));
});

test('a write that loses the race is retried', async () => {
  const store = memoryStore();
  await handle(post(report), { store, ip: 'a' });
  // simulate another writer sneaking in once
  const realSet = store.setJSON;
  let first = true;
  store.setJSON = async (key, value, opts) => {
    if (key === 'reports' && first) {
      first = false;
      const current = await store.get(key);
      await realSet(key, current, {}); // same data, new etag
      return { modified: false };
    }
    return realSet(key, value, opts);
  };
  const res = await handle(post({ ...report, lat: 17 }), { store, ip: 'b' });
  assert.equal(res.status, 201);
});
