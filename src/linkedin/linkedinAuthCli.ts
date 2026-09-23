#!/usr/bin/env node
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { buildAuthorizationUrl, exchangeCodeForToken, type LinkedInOAuthConfig } from './linkedinAuth.js';
import { getAuthorUrn } from './linkedinClient.js';

dotenv.config();

/**
 * One-time interactive helper (SPEC section 23/79): run `npm run
 * linkedin:auth` locally once to obtain LINKEDIN_ACCESS_TOKEN, then paste it
 * into a GitHub secret. This script is intentionally NOT part of the
 * automated daily pipeline (which must never print the token - see
 * src/utils/logger.ts redaction). It is fine for this manual, local-only
 * setup step to display the token once so you can copy it.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: ${name} is missing. Set it in your .env file before running this command.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const clientId = requireEnv('LINKEDIN_CLIENT_ID');
  const clientSecret = requireEnv('LINKEDIN_CLIENT_SECRET');
  const redirectUri = requireEnv('LINKEDIN_REDIRECT_URI');

  const config: LinkedInOAuthConfig = { clientId, clientSecret, redirectUri };
  const state = randomBytes(16).toString('hex');
  const authUrl = buildAuthorizationUrl(config, state);

  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    console.error(`LINKEDIN_REDIRECT_URI is not a valid URL: ${redirectUri}`);
    process.exit(1);
    return;
  }
  const port = Number(url.port) || 80;
  const callbackPath = url.pathname || '/callback';

  console.log('\nCloudLinkedIn Agent - LinkedIn OAuth setup\n');
  console.log('1. Make sure this exact redirect URI is registered on your LinkedIn app:');
  console.log(`   ${redirectUri}\n`);
  console.log('2. Open this URL in your browser and authorize the app:\n');
  console.log(`   ${authUrl}\n`);
  console.log(`Waiting for LinkedIn to redirect back to ${redirectUri} ...\n`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return;
      const requestUrl = new URL(req.url, `http://localhost:${port}`);
      if (requestUrl.pathname !== callbackPath) {
        res.writeHead(404).end();
        return;
      }

      const returnedState = requestUrl.searchParams.get('state');
      const returnedCode = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (error || !returnedCode) {
        res.end('<html><body><h2>Authorization failed. You can close this tab.</h2></body></html>');
        server.close();
        reject(new Error(`LinkedIn authorization failed: ${error ?? 'no code returned'}`));
        return;
      }
      if (returnedState !== state) {
        res.end('<html><body><h2>State mismatch - possible CSRF. Aborting.</h2></body></html>');
        server.close();
        reject(new Error('OAuth state mismatch.'));
        return;
      }

      res.end('<html><body><h2>Authorization received. You can close this tab and return to the terminal.</h2></body></html>');
      server.close();
      resolve(returnedCode);
    });
    server.listen(port);
  });

  console.log('Authorization code received. Exchanging it for an access token...\n');
  const tokens = await exchangeCodeForToken(code, config);

  console.log('Resolving your LinkedIn person URN (via /v2/userinfo)...\n');
  const authorUrn = await getAuthorUrn(tokens.access_token);

  console.log('SUCCESS.\n');
  console.log(`Author URN: ${authorUrn}`);
  if (tokens.expires_in) {
    const days = Math.round(tokens.expires_in / 86400);
    console.log(`Token expires in approximately ${days} day(s). You will need to re-run this command to refresh it.`);
  }
  console.log('\nCopy the access token below into a GitHub Actions secret named LINKEDIN_ACCESS_TOKEN.');
  console.log('Do NOT commit it to source control, and clear your terminal history afterwards if needed.\n');
  console.log('--------------------------------------------------------------');
  console.log(tokens.access_token);
  console.log('--------------------------------------------------------------\n');
}

main().catch((error: unknown) => {
  console.error('LinkedIn OAuth setup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
