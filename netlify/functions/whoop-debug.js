// whoop-debug.js — test all Whoop API endpoints
import { getStore } from '@netlify/blobs';

async function testEndpoint(path, token) {
  const res = await fetch('https://api.prod.whoop.com' + path, {
    headers: { Authorization: 'Bearer ' + token },
  });
  const body = await res.text();
  return { status: res.status, body: body.substring(0, 300) };
}

export default async function handler() {
  const store = getStore('health');
  const tokens = await store.get('whoop-tokens', { type: 'json' });
  if (!tokens) return new Response('No tokens', { status: 200 });

  const t = tokens.access_token;
  const results = {};

  const paths = [
    '/developer/v1/user/profile/basic',
    '/developer/v1/recovery/?limit=1',
    '/developer/v1/activity/sleep/?limit=1',
    '/developer/v1/cycle/?limit=1',
    '/developer/v1/cycles/?limit=1',
  ];

  for (const path of paths) {
    results[path] = await testEndpoint(path, t);
  }

  return new Response(JSON.stringify({
    scope: tokens.scope,
    ageMinutes: Math.round((Date.now() - tokens.obtained_at) / 60000),
    results
  }, null, 2), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}
