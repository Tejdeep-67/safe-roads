// Open data feed: /api/feed/geojson, /api/feed/csv, /api/feed/json (see docs/API.md)
import { handleFeed } from './lib/feed-core.mjs';
import { json } from './lib/http.mjs';
import { stores } from './lib/stores.mjs';

export default async (req, context) => {
  try {
    const s = stores();
    return await handleFeed(req, { store: s.hazards, photos: s.photos, limits: s.limits, ip: context.ip, format: context.params?.format });
  } catch (err) {
    console.error('feed function failed', err);
    return json(500, { error: 'Server error, please try again.' });
  }
};

export const config = { path: '/api/feed/:format' };
