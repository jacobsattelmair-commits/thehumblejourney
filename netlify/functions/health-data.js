// health-data.js
import { getStore } from '@netlify/blobs';

export default async function handler(req) {
    const store = getStore('health');
    if (req.method === 'GET') {
          const data = await store.get('metrics', { type: 'json' });
          return Response.json(data || { whoop: [], appleHealth: [], whoopConnected: false });
    }
    return new Response('Method not allowed', { status: 405 });
}
