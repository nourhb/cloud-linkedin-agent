import type { GeneratedPost, PublishResult } from '../types.js';

/** Common interface implemented by the real LinkedIn client and the mock client. */
export interface LinkedInPublisher {
  publishPost(post: GeneratedPost): Promise<PublishResult>;
}

export interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}

export interface LinkedInOAuthTokens {
  access_token: string;
  expires_in?: number;
  scope?: string;
}
