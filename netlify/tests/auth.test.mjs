// node --test netlify/tests/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COOKIE,
  LIMITS,
  emailKey,
  getSessionUser,
  handleAuth,
  hashPassword,
  normaliseEmail,
  signToken,
  validateSignup,
  verifyPassword,
  verifyToken,
} from '../functions/lib/auth-core.mjs';
import { rateLimit, sameOrigin, parseCookies } from '../functions/lib/http.mjs';
import { memoryStore } from './memory-store.mjs';

const SECRET = 'test-secret-that-is-long-enough-1234567890';
const ORIGIN = 'https://thesaferoads.netlify.app';

function req(action, method, body, headers = {}) {
  return new Request(`${ORIGIN}/api/auth/${action}`, {
    method,
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const deps = (extra = {}) => ({ users: memoryStore(), limits: memoryStore(), secret: SECRET, ip: '1.2.3.4', ...extra });
const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
const alice = { name: 'Alice Rao', email: 'Alice@Example.com ', password: 'correct horse 42' };

test('hash and verify a password', async () => {
  const h = await hashPassword('hunter2-but-longer');
  assert.match(h, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('hunter2-but-longer', h), true);
  assert.equal(await verifyPassword('hunter2-but-longeR', h), false);
  // same password twice -> different salt -> different hash
  assert.notEqual(h, await hashPassword('hunter2-but-longer'));
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('x', undefined), false);
});

test('tokens: sign, verify, expire, tamper', () => {
  const now = Date.now();
  const exp = Math.floor(now / 1000) + 60;
  const t = signToken({ sub: 'u1', exp }, SECRET);
  assert.equal(verifyToken(t, SECRET, now).sub, 'u1');
  // expired
  assert.equal(verifyToken(t, SECRET, now + 61_000), null);
  // wrong secret
  assert.equal(verifyToken(t, 'another-secret', now), null);
  // tampered payload (try to become someone else)
  const [, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${sig}`, SECRET, now), null);
  // garbage
  for (const bad of ['', 'abc', 'a.b.c', null, undefined, '.', 'x'.repeat(5000)]) assert.equal(verifyToken(bad, SECRET, now), null);
  // no secret -> fail closed
  assert.equal(verifyToken(t, '', now), null);
  assert.throws(() => signToken({ sub: 'u1', exp }, ''));
});

test('signup validation and email normalisation', () => {
  assert.equal(normaliseEmail('  Foo@Bar.COM '), 'foo@bar.com');
  assert.ok(validateSignup({ ...alice, name: 'A' }).error);
  assert.ok(validateSignup({ ...alice, email: 'not-an-email' }).error);
  assert.ok(validateSignup({ ...alice, password: 'short' }).error);
  assert.ok(validateSignup({ ...alice, password: 'aaaaaaaaaa' }).error);
  assert.ok(validateSignup({ ...alice, password: 'x'.repeat(200) }).error);
  const ok = validateSignup({ ...alice, name: '  <b>Alice</b>   Rao ' });
  assert.equal(ok.value.name, 'bAlice/b Rao');
  assert.equal(ok.value.email, 'alice@example.com');
});

test('sign up, me, sign out, sign in', async () => {
  const d = deps();
  const res = await handleAuth(req('signup', 'POST', alice), { ...d, action: 'signup' });
  assert.equal(res.status, 201);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, new RegExp(`^${COOKIE}=`));
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=']) assert.ok(setCookie.includes(flag), flag);
  const body = await res.json();
  assert.equal(body.user.email, 'alice@example.com');
  assert.equal(body.user.passwordHash, undefined);

  // the stored user has a hash, never the password
  const stored = [...d.users._data.values()].map((e) => JSON.stringify(e.value)).join();
  assert.ok(!stored.includes('correct horse 42'));

  const me = await handleAuth(req('me', 'GET', undefined, { cookie: cookieFrom(res) }), { ...d, action: 'me' });
  assert.equal((await me.json()).user.name, 'Alice Rao');

  const out = await handleAuth(req('logout', 'POST'), { ...d, action: 'logout' });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);

  const anon = await handleAuth(req('me', 'GET'), { ...d, action: 'me' });
  assert.equal((await anon.json()).user, null);

  const login = await handleAuth(req('login', 'POST', { email: 'ALICE@example.com', password: alice.password }), { ...d, action: 'login' });
  assert.equal(login.status, 200);
  assert.ok(cookieFrom(login).startsWith(`${COOKIE}=`));
});

test('emails are unique, login errors are generic', async () => {
  const d = deps();
  await handleAuth(req('signup', 'POST', alice), { ...d, action: 'signup' });
  const again = await handleAuth(req('signup', 'POST', { ...alice, email: 'alice@example.com', name: 'Someone' }), { ...d, action: 'signup' });
  assert.equal(again.status, 409);
  assert.equal(again.headers.get('set-cookie'), null);

  const wrongPw = await handleAuth(req('login', 'POST', { email: alice.email, password: 'nope nope nope' }), { ...d, action: 'login' });
  const noUser = await handleAuth(req('login', 'POST', { email: 'bob@example.com', password: 'nope nope nope' }), { ...d, action: 'login' });
  assert.equal(wrongPw.status, 401);
  assert.equal(noUser.status, 401);
  assert.deepEqual(await wrongPw.json(), await noUser.json());
});

test('a forged or expired cookie is not a session', async () => {
  const d = deps();
  const res = await handleAuth(req('signup', 'POST', alice), { ...d, action: 'signup' });
  const good = cookieFrom(res).split('=')[1];
  const user = await getSessionUser(req('me', 'GET', undefined, { cookie: `${COOKIE}=${good}` }), { users: d.users, secret: SECRET });
  assert.equal(user.email, 'alice@example.com');
  const later = Date.now() + 31 * 86400 * 1000;
  assert.equal(await getSessionUser(req('me', 'GET', undefined, { cookie: `${COOKIE}=${good}` }), { users: d.users, secret: SECRET, now: later }), null);
  const forged = signToken({ sub: user.id, exp: 9999999999 }, 'guessed-secret');
  assert.equal(await getSessionUser(req('me', 'GET', undefined, { cookie: `${COOKIE}=${forged}` }), { users: d.users, secret: SECRET }), null);
});

test('missing SESSION_SECRET fails closed', async () => {
  const res = await handleAuth(req('signup', 'POST', alice), { ...deps({ secret: '' }), action: 'signup' });
  assert.equal(res.status, 503);
});

test('cross-origin POST is blocked', async () => {
  const d = deps();
  const evil = req('signup', 'POST', alice, { origin: 'https://evil.example' });
  assert.equal((await handleAuth(evil, { ...d, action: 'signup' })).status, 403);
  assert.equal(sameOrigin(new Request(`${ORIGIN}/x`, { method: 'POST', headers: { origin: ORIGIN } })), true);
  assert.equal(sameOrigin(new Request(`${ORIGIN}/x`, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } })), false);
});

test('login is rate limited per IP', async () => {
  const d = deps();
  const now = 5_000_000;
  for (let i = 0; i < LIMITS.login.max; i++) {
    const r = await handleAuth(req('login', 'POST', { email: `x${i}@example.com`, password: 'whatever123' }), { ...d, action: 'login', now });
    assert.equal(r.status, 401);
  }
  const blocked = await handleAuth(req('login', 'POST', { email: 'y@example.com', password: 'whatever123' }), { ...d, action: 'login', now });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  const otherIp = await handleAuth(req('login', 'POST', { email: 'y@example.com', password: 'whatever123' }), { ...d, ip: '5.6.7.8', action: 'login', now });
  assert.equal(otherIp.status, 401);
});

test('rate limiter resets after its window and never stores raw ids', async () => {
  const store = memoryStore();
  const lim = { max: 2, windowMs: 1000 };
  assert.equal((await rateLimit(store, 'b', '9.9.9.9', lim, 0)).ok, true);
  assert.equal((await rateLimit(store, 'b', '9.9.9.9', lim, 10)).ok, true);
  assert.equal((await rateLimit(store, 'b', '9.9.9.9', lim, 20)).ok, false);
  assert.equal((await rateLimit(store, 'b', '9.9.9.9', lim, 1100)).ok, true);
  assert.ok([...store._data.keys()].every((k) => !k.includes('9.9.9.9')));
});

test('delete account needs the password and removes the user', async () => {
  const d = deps();
  const res = await handleAuth(req('signup', 'POST', alice), { ...d, action: 'signup' });
  const cookie = cookieFrom(res);
  let called = null;
  const del = (pw) =>
    handleAuth(req('me', 'DELETE', { password: pw }, { cookie }), { ...d, action: 'me', onDeleteUser: async (id) => ((called = id), 3) });
  assert.equal((await del('wrong password')).status, 401);
  const ok = await del(alice.password);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).reportsRemoved, 3);
  assert.ok(called);
  assert.equal(await d.users.get(emailKey('alice@example.com')), null);
  // and the email can be used again
  assert.equal((await handleAuth(req('signup', 'POST', alice), { ...d, action: 'signup' })).status, 201);
});

test('cookie parser copes with junk', () => {
  assert.deepEqual(parseCookies('a=1; b=%zz; ; c'), { a: '1', b: '%zz' });
  assert.deepEqual(parseCookies(null), {});
});
