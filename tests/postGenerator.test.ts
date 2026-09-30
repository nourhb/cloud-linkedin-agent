import { describe, expect, it } from 'vitest';
import { generatePost } from '../src/ai/postGenerator.js';
import type { AiClient, GeneratedImageAsset } from '../src/ai/aiClient.js';
import type { GeneratedPost, TopicCandidate } from '../src/types.js';
import { buildTestStrategy } from './fixtures/strategy.js';

const sentence =
  'Kubernetes namespaces let you split a cluster into isolated logical groups for teams and environments. ';

function validPost(overrides: Partial<GeneratedPost> = {}): GeneratedPost {
  return {
    topic: 'Kubernetes namespaces',
    category: 'Kubernetes',
    contentType: 'technical_explanation',
    hook: 'One Kubernetes concept I underestimated at first was namespaces.',
    body: Array.from({ length: 3 }, () => sentence.repeat(3)).join('\n\n'),
    hashtags: ['#Kubernetes', '#CloudComputing', '#DevOps'],
    keywords: ['kubernetes', 'namespace', 'cluster'],
    ...overrides,
  };
}

const topic: TopicCandidate = {
  topic: 'Kubernetes namespaces',
  category: 'Kubernetes',
  difficulty: 'intermediate',
  keywords: ['kubernetes', 'namespace', 'cluster'],
};

describe('generatePost', () => {
  it('passes the previous quality failure into the next prompt', async () => {
    const userPrompts: string[] = [];
    const client: AiClient = {
      async generateJson(_system, userPrompt) {
        userPrompts.push(userPrompt);
        if (userPrompts.length === 1) {
          return JSON.stringify(validPost({ body: sentence.repeat(40) }));
        }
        return JSON.stringify(validPost());
      },
      async generateImage(): Promise<GeneratedImageAsset> {
        return { bytes: Buffer.from('x'), mimeType: 'image/png' };
      },
    };

    const result = await generatePost({
      strategy: buildTestStrategy(),
      topic,
      contentType: 'technical_explanation',
      difficulty: 'intermediate',
      recentPosts: [],
      recentTopics: [],
      existingHashes: new Set(),
      aiClient: client,
      maxAttempts: 3,
    });

    expect(result.attempts).toBe(2);
    expect(userPrompts[0]).not.toContain('PREVIOUS DRAFT REJECTED');
    expect(userPrompts[1]).toContain('PREVIOUS DRAFT REJECTED');
    expect(userPrompts[1]).toMatch(/too long/i);
  });
});
