import type { AppConfig } from '../config/config.js';
import type { GeneratedPost, PublishResult } from '../types.js';
import { ClassifiedError } from '../types.js';
import { logger } from '../utils/logger.js';
import { createPost, getAuthorUrn } from './linkedinClient.js';
import { buildCommentary } from './littleText.js';
import type { LinkedInPublisher } from './linkedinTypes.js';

/**
 * Real LinkedIn publisher (SPEC section 24) using the current Posts API
 * (see linkedinClient.ts). Resolves the author URN lazily and caches it for
 * the lifetime of this instance since a single run only ever publishes one
 * post.
 */
export class LinkedinPublisher implements LinkedInPublisher {
  private authorUrnPromise: Promise<string> | undefined;

  constructor(private readonly config: AppConfig) {}

  private getAuthorUrnCached(): Promise<string> {
    if (!this.config.linkedin.accessToken) {
      throw new ClassifiedError('LINKEDIN_AUTH_ERROR', 'LINKEDIN_ACCESS_TOKEN is not configured.', {
        retryable: false,
      });
    }
    if (!this.authorUrnPromise) {
      this.authorUrnPromise = getAuthorUrn(this.config.linkedin.accessToken);
    }
    return this.authorUrnPromise;
  }

  async publishPost(post: GeneratedPost): Promise<PublishResult> {
    const accessToken = this.config.linkedin.accessToken;
    if (!accessToken) {
      return {
        success: false,
        error: 'LINKEDIN_ACCESS_TOKEN is not configured.',
        errorCategory: 'LINKEDIN_AUTH_ERROR',
      };
    }

    try {
      const authorUrn = await this.getAuthorUrnCached();
      const commentary = buildCommentary(post.hook, post.body, post.hashtags);
      const result = await createPost({
        authorUrn,
        commentary,
        accessToken,
        apiVersion: this.config.linkedin.apiVersion,
      });

      return {
        success: true,
        linkedinPostId: result.postUrn,
        publishedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof ClassifiedError) {
        logger.error('LinkedIn publish attempt failed', { category: error.category, message: error.message });
        throw error;
      }
      throw new ClassifiedError('UNKNOWN_ERROR', `Unexpected LinkedIn publish error: ${(error as Error).message}`, {
        retryable: true,
        cause: error,
      });
    }
  }
}
