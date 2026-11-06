import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle } from '../functions/lib/hazards-core.mjs';
import { handleModeration, moderatorSet, isModerator } from '../functions/lib/moderation-core.mjs';
import { handleFeed } from '../functions/lib/feed-core.mjs';
import { alice, bob, carol, dave, mod, create, deps, get, post, vote, fakeJpeg, report } from './helpers.mjs';

const mods = moderatorSet(' mod@example.com , other@example.com,');
const act = (d, user, id, body) => handleModeration(post(body, {}, `/api/moderation/${id}`), { ...d, user, mods, id });
const queue = async (d) => (await (await handleModeration(get('/api/moderation'), { ...d, user: mod, mods })).json()).queue;

async function flagged() {
  const d = deps();
  const h = await create(handle, d, alice, { ...report, photo: fakeJpeg });
  const ok = await create(handle, d, alice, { ...report, lat: 17.4, lng: 78.5 });
  await vote(handle, d, bob, h.id, 'flag', 'fake');
  await vote(handle, d, carol, h.id, 'flag', 'fake');
  await vote(handle, d, dave, h.id, 'flag', 'spam');
  await vote(handle, d, bob, ok.id, 'flag', 'wrong_place');
  return { d, h, ok };
}

test('moderator list is case and space insensitive, ordinary users are not moderators', () => {
  assert.equal(isModerator(mod, mods), true);
  assert.equal(isModerator(alice, mods), false);
  assert.equal(isModerator(null, mods), false);
  assert.equal(isModerator({ email: '' }, moderatorSet('')), false);
});

test('only moderators can see the queue or act on it', async () => {
  const { d, h } = await flagged();
  assert.equal((await handleModeration(get('/api/moderation'), { ...d, user: null, mods })).status, 401);
  assert.equal((await handleModeration(get('/api/moderation'), { ...d, user: alice, mods })).status, 403);
  assert.equal((await act(d, alice, h.id, { action: 'remove' })).status, 403);
  assert.equal((await act({ ...d }, mod, h.id, { action: 'dance' })).status, 400);
  assert.equal((await handleModeration(post({ action: 'remove' }, { origin: 'https://evil.example' }, `/api/moderation/${h.id}`), { ...d, user: mod, mods, id: h.id })).status, 403);
});

test('the queue lists hidden reports first, with flag counts and reasons but no user data', async () => {
  const { d, h, ok } = await flagged();
  const q = await queue(d);
  assert.deepEqual(q.map((x) => x.id), [h.id, ok.id]);
  assert.equal(q[0].hidden, true);
  assert.equal(q[0].flags, 3);
  assert.deepEqual(q[0].reasons, { fake: 2, spam: 1 });
  assert.equal(q[1].hidden, false);
  assert.ok(!JSON.stringify(q).includes(alice.id));
});

test('approve keeps a flagged report visible for good, remove deletes it and its photo', async () => {
  const { d, h, ok } = await flagged();
  assert.equal((await (await handle(get(), d)).json()).count, 1); // h is hidden
  const approved = await act(d, mod, h.id, { action: 'approve' });
  assert.equal(approved.status, 200);
  assert.equal((await (await handle(get(), d)).json()).count, 2);
  assert.deepEqual((await queue(d)).map((x) => x.id), [ok.id]);
  const removed = await act(d, mod, ok.id, { action: 'remove' });
  assert.equal((await removed.json()).removed, ok.id);
  assert.equal((await (await handle(get(), d)).json()).count, 1);
  const gone = await act(d, mod, h.id, { action: 'remove' });
  assert.equal(gone.status, 200);
  assert.equal(await d.photos.get(h.id), null);
  assert.equal((await act(d, mod, h.id, { action: 'remove' })).status, 404);
  assert.equal((await act(d, mod, 'nonsense', { action: 'remove' })).status, 404);
});

test('a moderator can mark a hazard as fixed by the authority, with a note, and reopen it', async () => {
  const d = deps();
  const h = await create(handle, d, alice);
  await vote(handle, d, bob, h.id, 'confirm');
  const res = await act(d, mod, h.id, { action: 'resolve', note: 'patched by the municipal corporation <b>' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).report.resolvedNote, 'patched by the municipal corporation b');
  let one = (await (await handle(get(`/api/hazards/${h.id}`), { ...d, id: h.id })).json()).hazard;
  assert.equal(one.status, 'resolved');
  // community votes cannot undo a moderator's decision, only a moderator can reopen
  await vote(handle, d, carol, h.id, 'confirm');
  one = (await (await handle(get(`/api/hazards/${h.id}`), { ...d, id: h.id })).json()).hazard;
  assert.equal(one.status, 'resolved');
  const feed = await (await handleFeed(get('/api/feed/json?status=resolved'), { ...d, format: 'json' })).json();
  assert.equal(feed.count, 1);
  await act(d, mod, h.id, { action: 'reopen' });
  one = (await (await handle(get(`/api/hazards/${h.id}`), { ...d, id: h.id })).json()).hazard;
  assert.equal(one.status, 'open');
});
