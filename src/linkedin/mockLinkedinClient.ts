import type { GeneratedPost, PublishResult } from '../types.js';
import type { LinkedInPublisher } from './linkedinTypes.js';
import { logger } from '../utils/logger.js';

/**
 * Simulates LinkedIn publication locally (SPEC section 68). Enabled via
 * MOCK_LINKEDIN=true. No network call, no real token required - safe for
 * development and CI.
 */
export class MockLinkedinClient implements LinkedInPublisher {
  async publishPost(post: GeneratedPost): Promise<PublishResult> {
    const mockId = `mock:${Date.now()}`;
    logger.info('Mock LinkedIn publication successful', { postId: mockId, topic: post.topic });
    return {
      success: true,
      linkedinPostId: mockId,
      publishedAt: new Date().toISOString(),
    };
  }
}
