// Accounts: POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout,
// GET /api/auth/me, DELETE /api/auth/me (delete account + my reports)
import { handleAuth } from './lib/auth-core.mjs';
import { deleteReportsOf } from './lib/hazards-core.mjs';
import { json } from './lib/http.mjs';
import { secret, stores } from './lib/stores.mjs';

export default async (req, context) => {
  try {
    const s = stores();
    return await handleAuth(req, {
      users: s.users,
      limits: s.limits,
      secret: secret(),
      ip: context.ip,
      action: context.params?.action,
      onDeleteUser: (userId) => deleteReportsOf(s.hazards, s.photos, userId),
    });
  } catch (err) {
    console.error('auth function failed', err);
    return json(500, { error: 'Server error, please try again.' });
  }
};

export const config = { path: '/api/auth/:action' };
