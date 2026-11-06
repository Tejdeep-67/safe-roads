import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle } from '../functions/lib/hazards-core.mjs';
import { FEED_LIMIT, COLUMNS, csvCell, handleFeed, handleStats, toCsv } from '../functions/lib/feed-core.mjs';
import { alice, bob, carol, create, deps, get, report, vote, fakeJpeg } from './helpers.mjs';

const feed = (d, format, q = '') => handleFeed(get(`/api/feed/${format}${q}`), { ...d, format });

async function seeded() {
  const d = deps();
  const now = Date.parse('2026-11-07T10:00:00Z');
  const a = await create(handle, d, alice, { ...report, note: 'call me on 9999999999', photo: fakeJpeg }, now);
  const b = await create(handle, d, alice, { ...report, lat: 16.311, lng: 80.44, type: 'waterlogging', severity: 'low', source: 'manual' }, now + 60000);
  const c = await create(handle, d, bob, { ...report, lat: 17.385, lng: 78.4867, severity: 'medium' }, now + 120000);
  await vote(handle, d, bob, a.id, 'confirm', undefined, now + 130000);
  return { d, a, b, c, now: now + 200000 };
}

test('geojson feed has the right shape, a licence and no personal data', async () => {
  const { d, a, now } = await seeded();
  const res = await handleFeed(get('/api/feed/geojson'), { ...d, format: 'geojson', now });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /geo\+json/);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.ok(res.headers.get('etag'));
  const text = await res.text();
  const fc = JSON.parse(text);
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc.count, 3);
  assert.equal(fc.license.name, 'CC BY 4.0');
  const f = fc.features.find((x) => x.id === a.id);
  assert.deepEqual(f.geometry, { type: 'Point', coordinates: [80.4365, 16.3067] });
  assert.equal(f.properties.verified, true);
  assert.equal(f.properties.confirmations, 2);
  assert.equal(f.properties.reported_via, 'ai_detection');
  // privacy: nothing that identifies a person or leads to a photo or free text
  for (const needle of [alice.id, bob.id, 'call me', '9999999999', '"note"', '"photo', '"ownerId"', '"by"', 'Alice']) {
    assert.ok(!text.includes(needle), `feed must not contain ${needle}`);
  }
  assert.deepEqual(Object.keys(f.properties).sort(), COLUMNS.filter((c) => c !== 'lat' && c !== 'lng').sort());
});

test('filters: bbox, type, severity, verified, since, status, limit', async () => {
  const { d, a, b, c, now } = await seeded();
  const ids = async (q) => (await (await handleFeed(get(`/api/feed/json${q}`), { ...d, format: 'json', now })).json()).hazards.map((h) => h.id).sort();
  assert.deepEqual(await ids('?bbox=80.3,16.2,80.6,16.5'), [a.id, b.id].sort());
  assert.deepEqual(await ids('?type=waterlogging'), [b.id]);
  assert.deepEqual(await ids('?severity=medium,high'), [a.id, c.id].sort());
  assert.deepEqual(await ids('?verified=1'), [a.id]);
  assert.deepEqual(await ids('?since=2026-11-08'), []);
  assert.deepEqual(await ids('?status=resolved'), []);
  const lim = await (await handleFeed(get('/api/feed/json?limit=2'), { ...d, format: 'json', now })).json();
  assert.equal(lim.count, 2);
  assert.equal(lim.truncated, true);
  for (const q of ['?bbox=a,b,c,d', '?type=ufo', '?severity=extreme', '?status=weird', '?since=yesterday', '?limit=0', '?limit=99999']) {
    assert.equal((await handleFeed(get(`/api/feed/json${q}`), { ...d, format: 'json', now })).status, 400, q);
  }
  assert.equal((await feed(d, 'xml')).status, 404);
});

test('resolved reports leave the default feed but stay available with status=resolved', async () => {
  const { d, a, now } = await seeded();
  await vote(handle, d, bob, a.id, 'fixed', undefined, now);
  await vote(handle, d, carol, a.id, 'fixed', undefined, now);
  // bob switched from confirm to fixed, alice and bob and carol: fixed = bob, carol -> 2 vs 0 other confirms
  const open = await (await handleFeed(get('/api/feed/json'), { ...d, format: 'json', now })).json();
  assert.ok(!open.hazards.some((h) => h.id === a.id));
  const resolved = await (await handleFeed(get('/api/feed/json?status=resolved'), { ...d, format: 'json', now })).json();
  assert.deepEqual(resolved.hazards.map((h) => h.id), [a.id]);
  assert.equal((await (await handleFeed(get('/api/feed/json?status=all'), { ...d, format: 'json', now })).json()).count, 3);
});

test('flagged-and-hidden reports never appear in the feed', async () => {
  const { d, a, now } = await seeded();
  const users = [bob, carol, { ...alice, id: '55555555-5555-4555-8555-555555555555' }];
  for (const u of users) await vote(handle, d, u, a.id, 'flag', 'spam', now);
  const all = await (await handleFeed(get('/api/feed/json?status=all'), { ...d, format: 'json', now })).json();
  assert.ok(!all.hazards.some((h) => h.id === a.id));
});

test('csv has a header, one row per report, quotes cells safely and blocks spreadsheet formulas', async () => {
  const { d, now } = await seeded();
  const res = await handleFeed(get('/api/feed/csv'), { ...d, format: 'csv', now });
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /attachment/);
  const lines = (await res.text()).trim().split('\r\n');
  assert.equal(lines[0], COLUMNS.join(','));
  assert.equal(lines.length, 4);
  assert.equal(lines[1].split(',').length, COLUMNS.length);
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell(null), '');
  assert.equal(toCsv([]), COLUMNS.join(',') + '\r\n');
});

test('etag gives a 304, errors and CORS preflight behave, writes are refused', async () => {
  const { d, now } = await seeded();
  const first = await handleFeed(get('/api/feed/geojson'), { ...d, format: 'geojson', now });
  const etag = first.headers.get('etag');
  const second = await handleFeed(get('/api/feed/geojson', { 'if-none-match': etag }), { ...d, format: 'geojson', now: now + 5000 });
  assert.equal(second.status, 304);
  const pre = await handleFeed(new Request('https://x.test/api/feed/geojson', { method: 'OPTIONS' }), { ...d, format: 'geojson' });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  const post = await handleFeed(new Request('https://x.test/api/feed/geojson', { method: 'POST', body: '{}' }), { ...d, format: 'geojson' });
  assert.equal(post.status, 405);
});

test('the feed is rate limited per IP', async () => {
  const d = deps();
  const now = 9_000_000;
  for (let i = 0; i < FEED_LIMIT.max; i++) assert.equal((await handleFeed(get('/api/feed/json'), { ...d, format: 'json', now })).status, 200);
  const blocked = await handleFeed(get('/api/feed/json'), { ...d, format: 'json', now });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('access-control-allow-origin'), '*');
  assert.equal((await handleFeed(get('/api/feed/json'), { ...d, ip: '2.2.2.2', format: 'json', now })).status, 200);
});

test('an empty database gives an empty feed and zero statistics, nothing invented', async () => {
  const d = deps();
  const fc = await (await feed(d, 'geojson')).json();
  assert.equal(fc.count, 0);
  assert.deepEqual(fc.features, []);
  const s = await (await handleStats(get('/api/stats'), d)).json();
  assert.equal(s.total, 0);
  assert.equal(s.resolved_share, null);
  assert.deepEqual(s.hotspots, []);
  assert.equal(s.weekly.length, 12);
  assert.ok(s.weekly.every((w) => w.reported === 0));
});

test('statistics count real reports and find hotspots', async () => {
  const d = deps();
  const now = Date.parse('2026-11-07T10:00:00Z');
  // three open reports within one ~550 m cell, one far away
  await create(handle, d, alice, { ...report, lat: 16.3001, lng: 80.4001 }, now);
  await create(handle, d, bob, { ...report, lat: 16.3011, lng: 80.4011, severity: 'low' }, now + 1);
  await create(handle, d, carol, { ...report, lat: 16.3021, lng: 80.4021, severity: 'medium' }, now + 2);
  const far = await create(handle, d, alice, { ...report, lat: 17.4, lng: 78.5 }, now + 3);
  await vote(handle, d, bob, far.id, 'confirm', undefined, now + 4);
  const s = await (await handleStats(get('/api/stats'), { ...d, now: now + 1000 })).json();
  assert.equal(s.total, 4);
  assert.equal(s.verified, 1);
  assert.equal(s.by_status.open, 4);
  assert.equal(s.by_type.pothole, 4);
  assert.equal(s.by_severity.high, 2);
  assert.equal(s.weekly.at(-1).reported, 4);
  assert.equal(s.hotspots.length, 1);
  assert.equal(s.hotspots[0].open_reports, 3);
  assert.equal(s.hotspots[0].high_severity, 1);
  assert.equal((await (await handleStats(get('/api/stats?bbox=78,17,79,18'), { ...d, now })).json()).total, 1);
});
