// apple-health-ingest.js — receive webhook from Health Auto Export app
import { getStore } from '@netlify/blobs';

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify shared secret
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

    const store = getStore('health');
    const stored = (await store.get('metrics', { type: 'json' })) || {
      whoop: [], appleHealth: [], runs: [], whoopConnected: false
    };
    if (!stored.runs) stored.runs = [];

    const today = new Date().toISOString().slice(0, 10);

    // --- Health Metrics ---
    const metrics = (body.data && body.data.metrics) || [];
    if (Array.isArray(metrics) && metrics.length > 0) {
      const entry = { date: today };
      for (const metric of metrics) {
        const latest = Array.isArray(metric.data) ? metric.data[0] : null;
        if (!latest) continue;
        const qty = latest.qty ?? latest.value ?? null;
        const name = (metric.name || '').toLowerCase().replace(/\s+/g, '_');
        switch (name) {
          case 'step_count': case 'steps':
            entry.steps = qty ? Math.round(qty) : null; break;
          case 'active_energy_burned': case 'active_energy':
            entry.activeCalories = qty ? Math.round(qty) : null; break;
          case 'resting_heart_rate': case 'resting_hr':
            entry.restingHR = qty ? Math.round(qty) : null; break;
          case 'vo2_max':
            entry.vo2Max = qty ? Math.round(qty * 10) / 10 : null; break;
        }
      }
      const idx = stored.appleHealth.findIndex(d => d.date === today);
      if (idx >= 0) stored.appleHealth[idx] = { ...stored.appleHealth[idx], ...entry };
      else stored.appleHealth.push(entry);
      stored.appleHealth.sort((a, b) => a.date.localeCompare(b.date));
      if (stored.appleHealth.length > 90) stored.appleHealth = stored.appleHealth.slice(-90);
    }

    // --- Workouts ---
    const workouts = (body.data && body.data.workouts) || [];
    console.log('Workouts received:', workouts.length);
    if (workouts.length > 0) console.log('First workout sample:', JSON.stringify(workouts[0]).slice(0, 300));

    if (Array.isArray(workouts) && workouts.length > 0) {
      for (const w of workouts) {
        // Filter for running workouts only
        const type = (w.workoutActivityType || w.name || w.type || '').toLowerCase();
        const isRun = type.includes('running') || type.includes('run') || type.includes('hkworkoutactivitytyperunning');
        if (!isRun) continue;

        // Parse date
        const rawDate = w.startDate || w.start || w.date || today;
        const date = rawDate.slice(0, 10);

        // Duration in minutes
        let durationMin = null;
        if (w.duration) {
          const d = parseFloat(w.duration);
          durationMin = isNaN(d) ? null : Math.round(d);
        } else if (w.durationInSeconds) {
          durationMin = Math.round(parseFloat(w.durationInSeconds) / 60);
        }

        // Distance in miles
        let distanceMi = null;
        if (w.totalDistance != null) {
          const dist = parseFloat(w.totalDistance);
          const unit = (w.totalDistanceUnit || w.distanceUnit || '').toLowerCase();
          if (unit.includes('km') || unit.includes('kilometer')) {
            distanceMi = Math.round(dist * 0.621371 * 100) / 100;
          } else {
            distanceMi = Math.round(dist * 100) / 100; // assume miles
          }
        } else if (w.distance != null) {
          distanceMi = Math.round(parseFloat(w.distance) * 100) / 100;
        }

        // Calories
        const calories = w.activeEnergyBurned != null ? Math.round(parseFloat(w.activeEnergyBurned))
          : w.totalEnergyBurned != null ? Math.round(parseFloat(w.totalEnergyBurned))
          : w.calories != null ? Math.round(parseFloat(w.calories))
          : null;

        // Avg HR
        const avgHR = w.averageHeartRate != null ? Math.round(parseFloat(w.averageHeartRate)) : null;

        const run = { date, durationMin, distanceMi, calories, avgHR };
        console.log('Storing run:', JSON.stringify(run));

        // Deduplicate by date + duration
        const exists = stored.runs.findIndex(r => r.date === date && r.durationMin === durationMin);
        if (exists >= 0) stored.runs[exists] = run;
        else stored.runs.push(run);
      }

      stored.runs.sort((a, b) => b.date.localeCompare(a.date)); // newest first
      if (stored.runs.length > 200) stored.runs = stored.runs.slice(0, 200);
    }

    await store.setJSON('metrics', stored);

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('apple-health-ingest error:', err.message);
    return new Response('Server error: ' + err.message, { status: 500 });
  }
}
