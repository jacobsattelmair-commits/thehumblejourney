// whoop-callback.js — exchange OAuth code for tokens, store them
import { getStore } from '@netlify/blobs';

export default async function handler(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  if (error) {
    return new Response('Whoop OAuth error: ' + error + ' — ' + (errorDesc || ''), { status: 400 });
  }
  if (!code) {
    return new Response('Missing code. Params received: ' + url.search, { status: 400 });
  }

  const siteUrl = process.env.URL || 'https://thehumblejourney.com';
  const redirectUri = 'https://thehumblejourney.com/.netlify/functions/whoop-callback';

  const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new Response('Token exchange failed: ' + err, { status: 502 });
  }

  const tokens = await tokenRes.json();
  tokens.obtained_at = Date.now();

  const store = getStore('health');
  await store.setJSON('whoop-tokens', tokens);

  // Mark whoop as connected in metrics
  const metrics = (await store.get('metrics', { type: 'json' })) || { whoop: [], appleHealth: [] };
  metrics.whoopConnected = true;
  await store.setJSON('metrics', metrics);

  return Response.redirect(siteUrl + '/health.html?whoop=connected', 302);
}
