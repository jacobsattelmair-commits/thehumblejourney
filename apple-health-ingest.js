// apple-health-ingest.js
// Receives a daily POST from the "Health Auto Export" iOS app
// and stores steps, active calories, resting HR, and VO₂ max.
//
// Required Netlify environment variable:
//   APPLE_HEALTH_SECRET — any secret string you choose; set the same value
//                         in Health Auto Export as the Authorization header value.

import { getStore } from '@netlify/blobs';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── Verify shared secret ─────────────────────────
  const secret = process.env.APPLE_HEALTH_SECRET;
  if (secret) {
    const auth = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // ── Parse body ───────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Health Auto Export sends data in this structure:
  // { data: [{ name: "stepCount", qty: 8200, units: "count", date: "..." }, ...] }
  // or a flat object per metric.
  const today = new Date().toISOString().split('T')[0];

  function extract(name) {
    // Array format (most common)
    if (Array.isArray(body.data)) {
      const item = body.data.find((d) => d.name === name || d.type === name);
      if (item) return item.qty ?? item.value ?? null;
    }
    // Flat object format
    return body[name] ?? null;
  }

  const newEntry = {
    date: today,
    steps: round(extract('stepCount') ?? extract('steps')),
    activeCalories: round(extract('activeEnergyBurned') ?? extract('activeCalories')),
    restingHR: round(extract('restingHeartRate') ?? extract('restingHR')),
    vo2max: roundTo(extract('vo2Max') ?? extract('vo2max'), 1),
  };

  // ── Merge with existing ──────────────────────────
  const store = getStore('health');
  const existing = (await store.get('metrics', { type: 'json' })) || {
    whoop: [],
    appleHealth: [],
  };

  const merged = [newEntry, ...existing.appleHealth.filter((e) => e.date !== today)].slice(0, 90);

  await store.setJSON('metrics', {
    ...existing,
    appleHealth: merged,
    lastSynced: new Date().toISOString(),
  });

  console.log('Apple Health ingest complete for', today);
  return new Response(JSON.stringify({ ok: true, date: today }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function round(v) {
  return v != null ? Math.round(v) : null;
}
function roundTo(v, decimals) {
  return v != null ? Math.round(v * 10 ** decimals) / 10 ** decimals : null;
}
