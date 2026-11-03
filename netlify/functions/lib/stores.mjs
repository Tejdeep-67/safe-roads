import { getStore } from '@netlify/blobs';

// strong consistency: a report or account written by one request is visible to the
// next one straight away (the default "eventual" mode can lag up to a minute)
export const stores = () => ({
  hazards: getStore({ name: 'safe-roads-hazards', consistency: 'strong' }),
  photos: getStore({ name: 'safe-roads-photos', consistency: 'strong' }),
  users: getStore({ name: 'safe-roads-users', consistency: 'strong' }),
  limits: getStore({ name: 'safe-roads-limits', consistency: 'strong' }),
});

export const secret = () => process.env.SESSION_SECRET || '';
