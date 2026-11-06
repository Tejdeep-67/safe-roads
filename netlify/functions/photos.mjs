// GET /api/photos/:id -> the JPEG attached to a report
import { stores } from './lib/stores.mjs';
import { isReportId } from './lib/tiles.mjs';

export default async (req, context) => {
  const id = context.params?.id || '';
  if (!isReportId(id)) return new Response('not found', { status: 404 });
  try {
    const photo = await stores().photos.get(id, { type: 'arrayBuffer' });
    if (!photo) return new Response('not found', { status: 404, headers: { 'cache-control': 'no-store' } });
    return new Response(photo, {
      headers: {
        'content-type': 'image/jpeg',
        // ids are random and photos never change, only get deleted
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('photo read failed', err);
    return new Response('error', { status: 500 });
  }
};

export const config = { path: '/api/photos/:id' };
