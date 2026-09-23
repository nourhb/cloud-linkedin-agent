import { ClassifiedError } from '../types.js';

/**
 * Thin wrapper around LinkedIn's current Posts API.
 *
 * Verified against the current official documentation at implementation
 * time (LinkedIn Posts API, which replaces the deprecated /v2/ugcPosts
 * endpoint):
 *   POST https://api.linkedin.com/rest/posts
 *   Headers: Authorization: Bearer <token>, Content-Type: application/json,
 *            X-Restli-Protocol-Version: 2.0.0, LinkedIn-Version: <YYYYMM>
 *   Body: { author, commentary, visibility, distribution, lifecycleState,
 *           isReshareDisabledByAuthor }
 *   Success: HTTP 201, created post URN returned in the `x-restli-id`
 *            response header.
 *
 * See README.md "LinkedIn setup" for source links. If LinkedIn changes this
 * contract in the future, update this file and the README note together.
 */

const LINKEDIN_API_BASE = 'https://api.linkedin.com';
const USERINFO_URL = `${LINKEDIN_API_BASE}/v2/userinfo`;
const POSTS_URL = `${LINKEDIN_API_BASE}/rest/posts`;

export interface CreatePostParams {
  authorUrn: string;
  commentary: string;
  accessToken: string;
  apiVersion: string;
}

export interface CreatePostResponse {
  postUrn: string;
}

function classifyHttpError(status: number, body: string): ClassifiedError {
  if (status === 401) {
    return new ClassifiedError('LINKEDIN_AUTH_ERROR', `LinkedIn authentication failed (401): ${body}`, {
      retryable: false,
    });
  }
  if (status === 403) {
    return new ClassifiedError(
      'LINKEDIN_AUTH_ERROR',
      `LinkedIn access denied (403) - check that the w_member_social scope/product is enabled: ${body}`,
      { retryable: false },
    );
  }
  if (status === 429) {
    return new ClassifiedError('LINKEDIN_RATE_LIMIT', `LinkedIn rate limit exceeded (429): ${body}`, {
      retryable: true,
    });
  }
  if (status >= 500) {
    return new ClassifiedError('LINKEDIN_NETWORK_ERROR', `LinkedIn server error (${status}): ${body}`, {
      retryable: true,
    });
  }
  return new ClassifiedError('LINKEDIN_BAD_REQUEST', `LinkedIn request failed (${status}): ${body}`, {
    retryable: false,
  });
}

/** Fetches the authenticated member's `sub` claim and builds `urn:li:person:{sub}`. */
export async function getAuthorUrn(accessToken: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(USERINFO_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    throw new ClassifiedError('LINKEDIN_NETWORK_ERROR', `Failed to reach LinkedIn userinfo endpoint: ${(error as Error).message}`, {
      retryable: true,
      cause: error,
    });
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw classifyHttpError(response.status, bodyText);
  }

  let parsed: { sub?: string };
  try {
    parsed = JSON.parse(bodyText);
  } catch (error) {
    throw new ClassifiedError('LINKEDIN_BAD_REQUEST', `Unexpected userinfo response: ${bodyText}`, {
      cause: error,
    });
  }

  if (!parsed.sub) {
    throw new ClassifiedError('LINKEDIN_BAD_REQUEST', 'LinkedIn userinfo response did not include a "sub" claim.');
  }

  return `urn:li:person:${parsed.sub}`;
}

/** Creates a text-only post via the current LinkedIn Posts API. */
export async function createPost(params: CreatePostParams): Promise<CreatePostResponse> {
  const { authorUrn, commentary, accessToken, apiVersion } = params;

  const payload = {
    author: authorUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  let response: Response;
  try {
    response = await fetch(POSTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': apiVersion,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new ClassifiedError('LINKEDIN_NETWORK_ERROR', `Failed to reach LinkedIn Posts API: ${(error as Error).message}`, {
      retryable: true,
      cause: error,
    });
  }

  if (response.status !== 201) {
    const bodyText = await response.text();
    throw classifyHttpError(response.status, bodyText);
  }

  const postUrn = response.headers.get('x-restli-id');
  if (!postUrn) {
    throw new ClassifiedError(
      'LINKEDIN_BAD_REQUEST',
      'LinkedIn returned 201 but no x-restli-id header was present; cannot record the post ID.',
    );
  }

  return { postUrn };
}
