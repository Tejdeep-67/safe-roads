// Local stand-in for the Netlify Functions, for `npm run dev` and for the screenshots in the README.
// Same handlers as production, but every store lives in memory and is empty on start.
// Vite proxies /api to this server (see vite.config.ts).
//   node dev/api-server.mjs            -> http://127.0.0.1:8788
// Sign-in works (secret below is for local use only). The moderator account is mod@example.com.
import { createServer } from 'node:http';
import { handleAuth, getSessionUser } from '../netlify/functions/lib/auth-core.mjs';
import { deleteReportsOf, handle } from '../netlify/functions/lib/hazards-core.mjs';
import { handleFeed, handleStats } from '../netlify/functions/lib/feed-core.mjs';
import { handleModeration, moderatorSet } from '../netlify/functions/lib/moderation-core.mjs';
import { memoryStore } from '../netlify/tests/memory-store.mjs';

const PORT = Number(process.env.PORT || 8788);
const secret = 'local-dev-secret-not-for-production';
const mods = moderatorSet(process.env.MODERATOR_EMAILS || 'mod@example.com');
const s = { hazards: memoryStore(), photos: memoryStore(), users: memoryStore(), limits: memoryStore() };

// the memory store keeps Buffers; the photos function wants an ArrayBuffer-ish thing back
async function servePhoto(id) {
  const data = await s.photos.get(id);
  if (!data) return new Response('not found', { status: 404 });
  return new Response(Buffer.from(data), { headers: { 'content-type': 'image/jpeg' } });
}

async function route(req, ip) {
  const url = new URL(req.url);
  const p = url.pathname;
  const user = await getSessionUser(req, { users: s.users, secret });
  let m;
  if ((m = /^\/api\/auth\/(\w+)$/.exec(p))) {
    return handleAuth(req, {
      users: s.users, limits: s.limits, secret, ip, action: m[1], moderators: mods,
      onDeleteUser: (id) => deleteReportsOf(s.hazards, s.photos, id),
    });
  }
  if ((m = /^\/api\/hazards(?:\/([^/]+))?(?:\/(\w+))?$/.exec(p))) {
    return handle(req, { store: s.hazards, photos: s.photos, limits: s.limits, user, ip, id: m[1], action: m[2] });
  }
  if ((m = /^\/api\/feed\/(\w+)$/.exec(p))) return handleFeed(req, { store: s.hazards, photos: s.photos, limits: s.limits, ip, format: m[1] });
  if (p === '/api/stats') return handleStats(req, { store: s.hazards, photos: s.photos, limits: s.limits, ip });
  if ((m = /^\/api\/moderation(?:\/([^/]+))?$/.exec(p))) return handleModeration(req, { store: s.hazards, photos: s.photos, limits: s.limits, user, mods, ip, id: m[1] });
  if ((m = /^\/api\/photos\/(.+)$/.exec(p))) return servePhoto(decodeURIComponent(m[1]));
  if (p === '/api/health') return Response.json({ ok: true, blobs: true, auth: true, dev: true });
  return new Response('not found', { status: 404 });
}

createServer(async (inc, out) => {
  try {
    const chunks = [];
    for await (const c of inc) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const host = inc.headers.host || `127.0.0.1:${PORT}`;
    const req = new Request(`http://${host}${inc.url}`, {
      method: inc.method,
      headers: Object.fromEntries(Object.entries(inc.headers).filter(([, v]) => typeof v === 'string')),
      body: body && !['GET', 'HEAD'].includes(inc.method) ? body : undefined,
    });
    const res = await route(req, inc.socket.remoteAddress);
    const headers = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    const sc = res.headers.getSetCookie?.();
    if (sc?.length) headers['set-cookie'] = sc;
    out.writeHead(res.status, headers);
    out.end(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.error(e);
    out.writeHead(500, { 'content-type': 'application/json' });
    out.end('{"error":"dev server error"}');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`dev api on http://127.0.0.1:${PORT}`));
