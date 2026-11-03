// GET /api/health -> is the API up, are Blobs reachable, is sign-in configured
import { json } from './lib/http.mjs';
import { secret, stores } from './lib/stores.mjs';

export default async () => {
  let blobs = false;
  try {
    await stores().hazards.getMetadata('reports');
    blobs = true;
  } catch (err) {
    console.error('blobs check failed', err);
  }
  return json(200, { ok: blobs, blobs, auth: secret().length > 0 });
};

export const config = { path: '/api/health' };
