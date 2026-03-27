// whoop-sync.js
// Scheduled Netlify Function — runs daily at 6:00 AM to fetch the latest
// Whoop data (recovery, HRV, sleep, strain) and store it in Netlify Blobs.
//
// Schedule: every day at 6 AM (defined in netlify.toml)

import { getStore } from '@netlify/blobs';

export default async function handler() {
  const store = getStore('health');

  // ── Load tokens ──────────────────────────────────
  const tokens = await store.get('whoop-tokens', { type: 'json' });
  if (!tokens) {
    console.log('No Whoop tokens found. Connect Whoop from the health dashboard first.');
    return new Response('No tokens', { status: 200 });
  }

  // ── Refresh token if expired ─────────────────────
  let accessToken = tokens.access_token;
  if (Date.now() >= tokens.expires_at - 60_000) {
    const refreshRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
      }),
    });
    if (!refreshRes.ok) {
      console.error('Token refresh failed:', await refreshRes.text());
      return new Response('Token refresh failed', { status: 500 });
    }
    const newTokens = await refreshRes.json();
    newTokens.expires_at = Date.now() + newTokens.expires_in * 1000;
    await store.setJSON('whoop-tokens', newTokens);
    accessToken = newTokens.access_token;
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  // ── Fetch today's recovery (includes HRV + resting HR) ─
  const recoveryRes = await fetch(
    'https://api.prod.whoop.com/developer/v1/recovery/?limit=1',
    { headers }
  );
  const recoveryJson = recoveryRes.ok ? await recoveryRes.json() : { records: [] };
  const latestRecovery = recoveryJson.records?.[0] ?? {};

  // ── Fetch today's sleep ──────────────────────────
  const sleepRes = await fetch(
    'https://api.prod.whoop.com/developer/v1/activity/sleep/?limit=1',
    { headers }
  );
  const sleepJson = sleepRes.ok ? await sleepRes.json() : { records: [] };
  const latestSleep = sleepJson.records?.[0] ?? {};

  // ── Fetch most recent cycle (for day strain) ─────
  const cycleRes = await fetch(
    'https://api.prod.whoop.com/developer/v1/cycle/?limit=1',
    { headers }
  );
  const cycleJson = cycleRes.ok ? await cycleRes.json() : { records: [] };
  const latestCycle = cycleJson.records?.[0] ?? {};

  // ── Build today's entry ──────────────────────────
  const today = new Date().toISOString().split('T')[0];

  const newEntry = {
    date: today,
    recovery: latestRecovery.score?.recovery_score ?? null,
    hrv: latestRecovery.score?.hrv_rmssd_milli ?? null,
    restingHR: latestRecovery.score?.resting_heart_rate ?? null,
    sleepPerformance: latestSleep.score?.sleep_performance_percentage ?? null,
    sleepDurationHrs: latestSleep.score?.stage_summary?.total_in_bed_time_milli
      ? Math.round(latestSleep.score.stage_summary.total_in_bed_time_milli / 3_600_000 * 10) / 10
      : null,
    strain: latestCycle.score?.strain ?? null,
  };

  // ── Merge with existing data ─────────────────────
  const existing = (await store.get('metrics', { type: 'json' })) || {
    whoop: [],
    appleHealth: [],
  };

  // Deduplicate by date, keep newest 90 days
  const merged = [newEntry, ...existing.whoop.filter((e) => e.date !== today)].slice(0, 90);

  await store.setJSON('metrics', {
    ...existing,
    whoop: merged,
    whoopConnected: true,
    lastSynced: new Date().toISOString(),
  });

  console.log('Whoop sync complete for', today, '— recovery:', newEntry.recovery);
  return new Response('Sync complete', { status: 200 });
}
