// whoop-callback.js
// Handles the OAuth2 redirect from Whoop, exchanges code for tokens,
// and stores them securely in Netlify Blobs.

import { getStore } from '@netlify/blobs';

export default async function handler(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const siteUrl = process.env.URL || 'https://thehumblejourney.com';

  if (error || !code) {
    return Response.redirect(`${siteUrl}/health.html?whoop=error`, 302);
  }

  // Exchange authorization code for access + refresh tokens
  const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
      redirect_uri: `${siteUrl}/.netlify/functions/whoop-callback`,
    }),
  });

  if (!tokenRes.ok) {
    console.error('Token exchange failed:', await tokenRes.text());
    return Response.redirect(`${siteUrl}/health.html?whoop=error`, 302);
  }

  const tokens = await tokenRes.json();
  // Add expiry timestamp for easy refresh checking
  tokens.expires_at = Date.now() + tokens.expires_in * 1000;

  const store = getStore('health');
  await store.setJSON('whoop-tokens', tokens);

  // Update the metrics blob to flag Whoop as connected
  const existing = (await store.get('metrics', { type: 'json' })) || {
    whoop: [],
    appleHealth: [],
  };
  await store.setJSON('metrics', { ...existing, whoopConnected: true });

  return Response.redirect(`${siteUrl}/health.html?whoop=connected`, 302);
}
