// Moderator queue and actions (see lib/moderation-core.mjs)
import { getSessionUser } from './lib/auth-core.mjs';
import { json } from './lib/http.mjs';
import { handleModeration, moderatorSet } from './lib/moderation-core.mjs';
import { secret, stores } from './lib/stores.mjs';

export default async (req, context) => {
  try {
    const s = stores();
    const key = secret();
    const user = key ? await getSessionUser(req, { users: s.users, secret: key }) : null;
    return await handleModeration(req, {
      store: s.hazards,
      photos: s.photos,
      limits: s.limits,
      user,
      mods: moderatorSet(process.env.MODERATOR_EMAILS),
      ip: context.ip,
      id: context.params?.id,
    });
  } catch (err) {
    console.error('moderation function failed', err);
    return json(500, { error: 'Server error, please try again.' });
  }
};

export const config = { path: ['/api/moderation', '/api/moderation/:id'] };
