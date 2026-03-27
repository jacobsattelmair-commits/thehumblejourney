// whoop-sync.js — scheduled daily sync of Whoop data (runs at 6 AM UTC)
import { getStore } from '@netlify/blobs';

async function refreshTokens(tokens) {
    const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
                  grant_type: 'refresh_token',
                  refresh_token: tokens.refresh_token,
                  client_id: process.env.WHOOP_CLIENT_ID,
                  client_secret: process.env.WHOOP_CLIENT_SECRET,
          }),
    });
    if (!res.ok) throw new Error('Token refresh failed: ' + await res.text());
    const fresh = await res.json();
    fresh.obtained_at = Date.now();
    return fresh;
}

async function whoopGet(path, token) {
    const res = await fetch('https://api.prod.whoop.com' + path, {
          headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error('Whoop API error ' + res.status + ' for ' + path);
    return res.json();
}

export default async function handler() {
    const store = getStore('health');
    let tokens = await store.get('whoop-tokens', { type: 'json' });
    if (!tokens) return new Response('No Whoop tokens stored', { status: 200 });

  // Refresh if token is older than 55 minutes
  const age = Date.now() - (tokens.obtained_at || 0);
    if (age > 55 * 60 * 1000) {
          tokens = await refreshTokens(tokens);
          await store.setJSON('whoop-tokens', tokens);
    }

  const access = tokens.access_token;
    const today = new Date().toISOString().slice(0, 10);

  // Fetch recovery, sleep, and cycle data
  const [recoveryData, sleepData, cycleData] = await Promise.all([
        whoopGet('/developer/v1/recovery/?limit=1', access),
        whoopGet('/developer/v1/activity/sleep/?limit=1', access),
        whoopGet('/developer/v1/cycle/?limit=1', access),
      ]);

  const entry = { date: today };

  if (recoveryData.records && recoveryData.records[0]) {
        const r = recoveryData.records[0];
        entry.hrv = r.score?.hrv_rmssd_milli ? Math.round(r.score.hrv_rmssd_milli) : null;
        entry.recoveryScore = r.score?.recovery_score ?? null;
        entry.restingHR = r.score?.resting_heart_rate ?? null;
  }
    if (sleepData.records && sleepData.records[0]) {
          const s = sleepData.records[0];
          entry.sleepScore = s.score?.sleep_performance_percentage ?? null;
          entry.sleepDurationHrs = s.score?.sleep_needed?.baseline_milli
            ? null
                  : (s.end && s.start ? Math.round((new Date(s.end) - new Date(s.start)) / 36e5 * 10) / 10 : null);
    }
    if (cycleData.records && cycleData.records[0]) {
          const c = cycleData.records[0];
          entry.strain = c.score?.strain ?? null;
          entry.avgHR = c.score?.average_heart_rate ?? null;
          entry.maxHR = c.score?.max_heart_rate ?? null;
          entry.kilojoules = c.score?.kilojoule ?? null;
    }

  // Merge into stored metrics, keep last 90 days
  const metrics = (await store.get('metrics', { type: 'json' })) || { whoop: [], appleHealth: [], whoopConnected: true };
    metrics.whoopConnected = true;
    const idx = metrics.whoop.findIndex(d => d.date === today);
    if (idx >= 0) metrics.whoop[idx] = { ...metrics.whoop[idx], ...entry };
    else metrics.whoop.push(entry);
    metrics.whoop.sort((a, b) => a.date.localeCompare(b.date));
    if (metrics.whoop.length > 90) metrics.whoop = metrics.whoop.slice(-90);

  await store.setJSON('metrics', metrics);
    return new Response('Synced Whoop data for ' + today, { status: 200 });
}
