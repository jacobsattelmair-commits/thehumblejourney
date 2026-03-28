// apple-health-ingest.js — receive webhook from Health Auto Export app
import { getStore } from '@netlify/blobs';

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify shared secret
    const auth = req.headers.get('authorization') || '';
    const expected = 'Bearer ' + process.env.APPLE_HEALTH_SECRET;
    if (auth !== expected) {
      console.log('Auth mismatch. Received:', auth, 'Expected prefix: Bearer ...');
      return new Response('Unauthorized', { status: 401 });
    }

    // Read raw body text first for debugging
    const rawBody = await req.text();
    console.log('Received body:', rawBody.slice(0, 500));

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('JSON parse failed for body:', rawBody.slice(0, 200));
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log('Parsed body keys:', Object.keys(body));

    // Health Auto Export sends: { data: [ { name, data: [{qty, date}] } ] }
    const metrics = body.data || [];
    console.log('Metrics count:', metrics.length);
    if (metrics.length > 0) console.log('First metric:', JSON.stringify(metrics[0]).slice(0, 200));

    const today = new Date().toISOString().slice(0, 10);
    const entry = { date: today };

    for (const metric of metrics) {
      const latest = Array.isArray(metric.data) ? metric.data[0] : null;
      if (!latest) continue;
      const qty = latest.qty ?? latest.value ?? null;
      const name = (metric.name || '').toLowerCase().replace(/\s+/g, '_');
      console.log('Metric name:', metric.name, '-> normalized:', name, 'qty:', qty);
      switch (name) {
        case 'step_count':
        case 'stepcount':
        case 'steps':
          entry.steps = qty ? Math.round(qty) : null; break;
        case 'active_energy_burned':
        case 'activeenergyburned':
        case 'active_energy':
          entry.activeCalories = qty ? Math.round(qty) : null; break;
        case 'resting_heart_rate':
        case 'restingheartrate':
        case 'resting_hr':
          entry.restingHR = qty ? Math.round(qty) : null; break;
        case 'vo2_max':
        case 'vo2max':
          entry.vo2Max = qty ? Math.round(qty * 10) / 10 : null; break;
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
    console.error('apple-health-ingest error:', err.message, err.stack);
    return new Response('Server error: ' + err.message, { status: 500 });
  }
}
