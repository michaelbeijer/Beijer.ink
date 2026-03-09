import 'dotenv/config';
import http from 'http';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const PORT = 3099;
const REDIRECT_URI = `http://localhost:${PORT}`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Missing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET.\n' +
    'Set them in a .env file in the project root, then run this script again.',
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\n=== Google Drive Authorization ===\n');
console.log('Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for authorization...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Authorization denied.</h2><p>You can close this tab.</p>');
    console.error('Authorization denied by user.');
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>No authorization code received.</h2>');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<h2>Authorization successful!</h2>' +
      '<p>You can close this tab and return to the terminal.</p>',
    );

    console.log('=== Authorization successful! ===\n');
    console.log('Your refresh token:\n');
    console.log(tokens.refresh_token);
    console.log('\nSet this as GOOGLE_DRIVE_REFRESH_TOKEN on Railway.\n');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h2>Failed to exchange authorization code.</h2>');
    console.error('Token exchange failed:', err);
  }

  server.close();
});

server.listen(PORT, () => {
  console.log(`Listening on ${REDIRECT_URI} for the OAuth callback...`);
});
