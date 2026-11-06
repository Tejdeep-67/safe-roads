import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle, HIDE_AT, FLAG_LIMIT, STALE_DAYS } from '../functions/lib/hazards-core.mjs';
import { alice, bob, carol, dave, create, deps, get, post, vote, report } from './helpers.mjs';

const fetchOne = async (d, id, user) => (await (await handle(get(`/api/hazards/${id}`), { ...d, id, user })).json()).hazard;

test('a second person confirming makes a report verified, the reporter cannot confirm their own', async () => {
  const d = deps();
  const h = await create(handle, d, alice);
  assert.equal(h.verified, false);
  const own = await vote(handle, d, alice, h.id, 'confirm');
  assert.equal(own.status, 403);
  const res = await vote(handle, d, bob, h.id, 'confirm');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.hazard.confirmations, 2);
  assert.equal(body.hazard.verified, true);
  assert.equal(body.hazard.myVote, 'confirm');
  // same vote again changes nothing
  const again = await (await vote(handle, d, bob, h.id, 'confirm')).json();
  assert.equal(again.unchanged, true);
  assert.equal(again.hazard.confirmations, 2);
  // taking the vote back
  const back = await handle(new Request(`https://thesaferoads.netlify.app/api/hazards/${h.id}/vote`, { method: 'DELETE', headers: { origin: 'https://thesaferoads.netlify.app' } }), { ...d, user: bob, id: h.id, action: 'vote' });
  assert.equal((await back.json()).hazard.confirmations, 1);
});

test('votes need sign-in, the right origin and a valid body', async () => {
  const d = deps();
  const h = await create(handle, d, alice);
  assert.equal((await vote(handle, d, null, h.id, 'confirm')).status, 401);
  assert.equal((await handle(post({ vote: 'confirm' }, { origin: 'https://evil.example' }, `/api/hazards/${h.id}/vote`), { ...d, user: bob, id: h.id, action: 'vote' })).status, 403);
  assert.equal((await vote(handle, d, bob, h.id, 'love')).status, 400);
  assert.equal((await vote(handle, d, bob, '5_5.11111111-1111-4111-8111-111111111111', 'confirm')).status, 404);
  assert.equal((await vote(handle, d, bob, 'garbage', 'confirm')).status, 404);
});

test('two "fixed" votes resolve a report unless more people still see it; confirming again reopens it', async () => {
  const d = deps();
  const h = await create(handle, d, alice);
  await vote(handle, d, bob, h.id, 'fixed');
  assert.equal((await fetchOne(d, h.id)).status, 'open'); // one vote is not enough
  await vote(handle, d, carol, h.id, 'fixed');
  let cur = await fetchOne(d, h.id, bob);
  assert.equal(cur.status, 'resolved');
  assert.equal(cur.fixedVotes, 2);
  assert.equal(cur.myVote, 'fixed');
  // someone disagrees: fixed 2 vs still-there 1 stays resolved, 2 vs 2 reopens
  await vote(handle, d, dave, h.id, 'confirm');
  assert.equal((await fetchOne(d, h.id)).status, 'resolved');
  await vote(handle, d, bob, h.id, 'confirm'); // bob changes his mind: confirm replaces his fixed
  cur = await fetchOne(d, h.id, bob);
  assert.equal(cur.status, 'open');
  assert.equal(cur.myVote, 'confirm');
  assert.equal(cur.fixedVotes, 1);
});

test('the reporter saying "fixed" counts as one of the two', async () => {
  const d = deps();
  const h = await create(handle, d, alice);
  await vote(handle, d, alice, h.id, 'fixed');
  await vote(handle, d, bob, h.id, 'fixed');
  assert.equal((await fetchOne(d, h.id)).status, 'resolved');
});

test(`${HIDE_AT} different people flagging hide a report from the public, the owner still sees it`, async () => {
  const d = deps();
  const h = await create(handle, d, alice);
  await vote(handle, d, bob, h.id, 'flag', 'spam');
  await vote(handle, d, bob, h.id, 'flag', 'spam'); // same person twice counts once
  await vote(handle, d, carol, h.id, 'flag', 'fake');
  assert.equal((await (await handle(get(), d)).json()).count, 1);
  await vote(handle, d, dave, h.id, 'flag', 'nonsense-reason');
  assert.equal((await (await handle(get(), d)).json()).count, 0);
  assert.equal((await (await handle(get(), { ...d, user: alice })).json()).count, 1);
  assert.equal((await handle(get(`/api/hazards/${h.id}`), { ...d, id: h.id })).status, 404);
  assert.equal((await vote(handle, d, bob, h.id, 'confirm')).status, 404);
});

test('flagging your own report does nothing, and flags are rate limited', async () => {
  const d = deps();
  const h = await create(handle, d, alice);
  assert.equal((await vote(handle, d, alice, h.id, 'flag', 'spam')).status, 403);
  const now = 5_000_000;
  const ids = [];
  for (let i = 0; i < FLAG_LIMIT.max + 1; i++) ids.push((await create(handle, d, alice, { ...report, lat: 20 + i }, now + i)).id);
  let last;
  for (let i = 0; i < ids.length; i++) last = await vote(handle, d, bob, ids[i], 'flag', 'spam', now + 100);
  assert.equal(last.status, 429);
});

test('old unconfirmed reports go stale and leave the default list, verified ones do not', async () => {
  const d = deps();
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  const lonely = await create(handle, d, alice, report, t0);
  const checked = await create(handle, d, alice, { ...report, lat: 17.4, lng: 78.5 }, t0);
  await vote(handle, d, bob, checked.id, 'confirm', undefined, t0 + 1000);
  const later = t0 + (STALE_DAYS + 5) * 86400000;
  const list = await (await handle(get(), { ...d, now: later })).json();
  assert.deepEqual(list.hazards.map((h) => h.id), [checked.id]);
  const withStale = await (await handle(get('/api/hazards?stale=1'), { ...d, now: later })).json();
  assert.equal(withStale.count, 2);
  assert.equal(withStale.hazards.find((h) => h.id === lonely.id).status, 'stale');
});
