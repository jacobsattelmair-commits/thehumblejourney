// apple-health-ingest.js — receive webhook from Health Auto Export app
import { getStore } from '@netlify/blobs';

export default async function handler(req) {
    if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
    }

  // Verify shared secret
  const auth = req.headers.get('authorization') || '';
    const expected = 'Bearer ' + process.env.APPLE_HEALTH_SECRET;
    if (auth !== expected) {
          return new Response('Unauthorized', { status: 401 });
    }

  let body;
    try {
          body = await req.json();
    } catch {
          return new Response('Invalid JSON', { status: 400 });
    }

  // Health Auto Export sends: { data: [ { name, data: [{qty, date}] } ] }
  const metrics = body.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const entry = { date: today };

  for (const metric of metrics) {
        const latest = Array.isArray(metric.data) ? metric.data[0] : null;
        if (!latest) continue;
        const qty = latest.qty ?? latest.value ?? null;
        switch (metric.name) {
          case 'step_count':
          case 'stepCount':
                    entry.steps = qty ? Math.round(qty) : null;
                    break;
          case 'active_energy_burned':
          case 'activeEnergyBurned':
                    entry.activeCalories = qty ? Math.round(qty) : null;
                    break;
          case 'resting_heart_rate':
          case 'restingHeartRate':
                    entry.restingHR = qty ? Math.round(qty) : null;
                    break;
          case 'vo2_max':
          case 'vo2Max':
                    entry.vo2Max = qty ? Math.round(qty * 10) / 10 : null;
                    break;
        }
  }

  const store = getStore('health');
    const stored = (await store.get('metrics', { type: 'json' })) || { whoop: [], appleHealth: [], whoopConnected: false };
    const idx = stored.appleHealth.findIndex(d => d.date === today);
    if (idx >= 0) stored.appleHealth[idx] = { ...stored.appleHealth[idx], ...entry };
    else stored.appleHealth.push(entry);
    stored.appleHealth.sort((a, b) => a.date.localeCompare(b.date));
    if (stored.appleHealth.length > 90) stored.appleHealth = stored.appleHealth.slice(-90);

  await store.setJSON('metrics', stored);
    return new Response('OK', { status: 200 });
}
