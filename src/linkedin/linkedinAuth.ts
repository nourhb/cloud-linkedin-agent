import { ClassifiedError } from '../types.js';
import type { LinkedInOAuthTokens } from './linkedinTypes.js';

/**
 * OAuth 2.0 helpers for the one-time local setup flow (SPEC section 23).
 * Scopes requested: `openid profile w_member_social` - `openid`/`profile`
 * are needed to resolve the member's person URN via the userinfo endpoint
 * (see linkedinClient.getAuthorUrn), and `w_member_social` is required to
 * publish posts on the member's behalf.
 */

const AUTHORIZATION_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const REQUIRED_SCOPES = 'openid profile w_member_social';

export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildAuthorizationUrl(config: LinkedInOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: REQUIRED_SCOPES,
  });
  return `${AUTHORIZATION_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  config: LinkedInOAuthConfig,
): Promise<LinkedInOAuthTokens> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (error) {
    throw new ClassifiedError(
      'LINKEDIN_NETWORK_ERROR',
      `Failed to reach LinkedIn token endpoint: ${(error as Error).message}`,
      { retryable: true, cause: error },
    );
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new ClassifiedError('LINKEDIN_AUTH_ERROR', `LinkedIn token exchange failed (${response.status}): ${bodyText}`);
  }

  try {
    return JSON.parse(bodyText) as LinkedInOAuthTokens;
  } catch (error) {
    throw new ClassifiedError('LINKEDIN_BAD_REQUEST', `Unexpected token response: ${bodyText}`, { cause: error });
  }
}
