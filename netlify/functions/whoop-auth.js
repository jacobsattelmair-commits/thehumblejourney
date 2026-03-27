// whoop-auth.js — redirect user to Whoop OAuth2 consent screen
export default async function handler(req) {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const siteUrl = process.env.URL || 'https://thehumblejourney.com';
    const redirectUri = siteUrl + '/.netlify/functions/whoop-callback';
    const scopes = 'read:recovery read:sleep read:workout read:profile read:body_measurement offline';
    const authUrl = 'https://api.prod.whoop.com/oauth/oauth2/auth' +
          '?response_type=code' +
          '&client_id=' + encodeURIComponent(clientId) +
          '&redirect_uri=' + encodeURIComponent(redirectUri) +
          '&scope=' + encodeURIComponent(scopes);
    return Response.redirect(authUrl, 302);
}
