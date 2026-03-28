// whoop-debug.js — brute force path finder
import { getStore } from '@netlify/blobs';

async function testEndpoint(path, token) {
  const res = await fetch('https://api.prod.whoop.com' + path, {
    headers: { Authorization: 'Bearer ' + token },
  });
  const body = await res.text();
  return { status: res.status, body: body.substring(0, 150) };
}

export default async function handler() {
  const store = getStore('health');
  const tokens = await store.get('whoop-tokens', { type: 'json' });
  if (!tokens) return new Response('No tokens', { status: 200 });

  const t = tokens.access_token;
  const results = {};

  const paths = [
    '/developer/v1/recovery',
    '/developer/v1/recovery/',
    '/developer/v1/activity/recovery',
    '/developer/v1/activity/recovery/',
    '/developer/v1/sleep',
    '/developer/v1/sleep/',
    '/developer/v1/activity/sleep',
    '/developer/v1/activity/sleep/',
    '/developer/v1/physiological_cycles',
    '/developer/v1/physiological_cycles/',
    '/developer/v2/recovery',
    '/developer/v2/recovery/',
    '/developer/v2/sleep',
    '/developer/v2/sleep/',
    '/developer/v2/physiological_cycles',
    '/developer/v2/physiological_cycles/',
  ];

  for (const path of paths) {
    results[path] = await testEndpoint(path, t);
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}
