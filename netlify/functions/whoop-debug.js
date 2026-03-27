// whoop-debug.js — diagnostic endpoint to test Whoop API auth
import { getStore } from '@netlify/blobs';

export default async function handler() {
  const store = getStore('health');
  const tokens = await store.get('whoop-tokens', { type: 'json' });

  if (!tokens) {
    return new Response(JSON.stringify({ error: 'No tokens stored' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  const info = {
    tokenKeys: Object.keys(tokens),
    obtained_at: tokens.obtained_at,
    ageMinutes: tokens.obtained_at ? Math.round((Date.now() - tokens.obtained_at) / 60000) : null,
    token_type: tokens.token_type,
    scope: tokens.scope,
    expires_in: tokens.expires_in,
    accessTokenPrefix: tokens.access_token ? tokens.access_token.substring(0, 20) + '...' : 'MISSING',
    hasRefreshToken: !!tokens.refresh_token,
  };

  const testRes = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
    headers: { Authorization: 'Bearer ' + tokens.access_token },
  });

  const testBody = await testRes.text();

  return new Response(JSON.stringify({
    tokenInfo: info,
    apiTest: { status: testRes.status, body: testBody }
  }, null, 2), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}
