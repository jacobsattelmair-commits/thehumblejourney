// health-data.js
// GET  /.netlify/functions/health-data  — returns stored health JSON
// POST /.netlify/functions/health-data  — (future: manual data entry)

import { getStore } from '@netlify/blobs';

export default async function handler(req) {
  const store = getStore('health');

  if (req.method === 'GET') {
    const data = await store.get('metrics', { type: 'json' });
    return Response.json(data || { whoop: [], appleHealth: [], whoopConnected: false });
  }

  return new Response('Method not allowed', { status: 405 });
}
