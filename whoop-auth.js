// whoop-auth.js
// Initiates the Whoop OAuth2 flow.
// Visit /.netlify/functions/whoop-auth from the health dashboard to connect Whoop.
//
// Required Netlify environment variables:
//   WHOOP_CLIENT_ID     — from developer.whoop.com
//   WHOOP_CLIENT_SECRET — from developer.whoop.com
//   URL                 — set automatically by Netlify (your site URL)

export default async function handler(req) {
  const clientId = process.env.WHOOP_CLIENT_ID;
  if (!clientId) {
    return new Response('WHOOP_CLIENT_ID environment variable is not set.', { status: 500 });
  }

  const redirectUri = encodeURIComponent(
    `${process.env.URL}/.netlify/functions/whoop-callback`
  );

  const scopes = [
    'read:recovery',
    'read:sleep',
    'read:workout',
    'read:profile',
    'read:body_measurement',
    'offline',
  ].join(' ');

  const authUrl =
    `https://api.prod.whoop.com/oauth/oauth2/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code`;

  return Response.redirect(authUrl, 302);
}
