// Shared hazard reports, see lib/hazards-core.mjs for the routes and rules.
import { handle } from './lib/hazards-core.mjs';
import { getSessionUser } from './lib/auth-core.mjs';
import { json } from './lib/http.mjs';
import { secret, stores } from './lib/stores.mjs';

export default async (req, context) => {
  try {
    const s = stores();
    const key = secret();
    const user = key ? await getSessionUser(req, { users: s.users, secret: key }) : null;
    if (!key && req.method !== 'GET') return json(503, { error: 'Reporting is switched off: the server has no session secret.' });
    return await handle(req, {
      store: s.hazards,
      photos: s.photos,
      limits: s.limits,
      user,
      ip: context.ip,
      id: context.params?.id,
      action: context.params?.action,
    });
  } catch (err) {
    console.error('hazards function failed', err);
    return json(500, { error: 'Server error, please try again.' });
  }
};

export const config = { path: ['/api/hazards', '/api/hazards/:id', '/api/hazards/:id/:action'] };
