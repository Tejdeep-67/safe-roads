// GET /api/stats: counts, weekly trend and hotspots (see docs/API.md)
import { handleStats } from './lib/feed-core.mjs';
import { json } from './lib/http.mjs';
import { stores } from './lib/stores.mjs';

export default async (req, context) => {
  try {
    const s = stores();
    return await handleStats(req, { store: s.hazards, photos: s.photos, limits: s.limits, ip: context.ip });
  } catch (err) {
    console.error('stats function failed', err);
    return json(500, { error: 'Server error, please try again.' });
  }
};

export const config = { path: '/api/stats' };
