// apple-health-ingest.js — receive webhook from Health Auto Export app
import { getStore } from '@netlify/blobs';

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify shared secret — strip "Bearer" prefix and any extra whitespace
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token !== process.env.APPLE_HEALTH_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const rawBody = await req.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // Health Auto Export sends: { data: { metrics: [ { name, units, data: [{qty, date}] } ] } }
    const metrics = (body.data && body.data.metrics) || body.data || [];
    console.log('Metrics count:', Array.isArray(metrics) ? metrics.length : 'not array');

    const today = new Date().toISOString().slice(0, 10);
    const entry = { date: today };

    if (Array.isArray(metrics)) {
      for (const metric of metrics) {
        const latest = Array.isArray(metric.data) ? metric.data[0] : null;
        if (!latest) continue;
        const qty = latest.qty ?? latest.value ?? null;
        const name = (metric.name || '').toLowerCase().replace(/\s+/g, '_');
        console.log('Metric:', metric.name, '->', name, '=', qty);
        switch (name) {
          case 'step_count':
          case 'steps':
            entry.steps = qty ? Math.round(qty) : null; break;
          case 'active_energy_burned':
          case 'active_energy':
            entry.activeCalories = qty ? Math.round(qty) : null; break;
          case 'resting_heart_rate':
          case 'resting_hr':
            entry.restingHR = qty ? Math.round(qty) : null; break;
          case 'vo2_max':
            entry.vo2Max = qty ? Math.round(qty * 10) / 10 : null; break;
        }
      }
    }

    console.log('Entry to store:', JSON.stringify(entry));

    const store = getStore('health');
    const stored = (await store.get('metrics', { type: 'json' })) || { whoop: [], appleHealth: [], whoopConnected: false };
    const idx = stored.appleHealth.findIndex(d => d.date === today);
    if (idx >= 0) stored.appleHealth[idx] = { ...stored.appleHealth[idx], ...entry };
    else stored.appleHealth.push(entry);
    stored.appleHealth.sort((a, b) => a.date.localeCompare(b.date));
    if (stored.appleHealth.length > 90) stored.appleHealth = stored.appleHealth.slice(-90);
    await store.setJSON('metrics', stored);

    return new Response('OK: ' + JSON.stringify(entry), { status: 200 });
  } catch (err) {
    console.error('apple-health-ingest error:', err.message);
    return new Response('Server error: ' + err.message, { status: 500 });
  }
}
