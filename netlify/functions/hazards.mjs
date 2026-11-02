// Shared hazard reports, stored in Netlify Blobs.
//   GET  /api/hazards  -> all reports
//   POST /api/hazards  -> add a report (validated + rate limited per IP)
import { getStore } from '@netlify/blobs';
import { handle } from './lib/hazards-core.mjs';

export default async (req, context) => {
  try {
    const store = getStore({ name: 'safe-roads-hazards', consistency: 'strong' });
    return await handle(req, { store, ip: context.ip });
  } catch (err) {
    console.error('hazards function failed', err);
    return new Response(JSON.stringify({ error: 'server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export const config = { path: '/api/hazards' };
