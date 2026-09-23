import { describe, expect, it } from 'vitest';
import { buildUserPrompt, GENERATED_POST_SCHEMA, pickWritingFormat, SYSTEM_PROMPT, WRITING_FORMATS } from '../src/ai/promptBuilder.js';
import type { StoredPost, TopicCandidate } from '../src/types.js';
import { buildTestStrategy } from './fixtures/strategy.js';

const topic: TopicCandidate = {
  topic: 'Kubernetes namespaces',
  category: 'Kubernetes',
  difficulty: 'intermediate',
  keywords: ['kubernetes', 'namespace', 'cluster'],
};

describe('promptBuilder', () => {
  const strategy = buildTestStrategy();

  it('system prompt forbids fabricated experience and demands structured JSON', () => {
    expect(SYSTEM_PROMPT).toContain('Do not invent personal experiences');
    expect(SYSTEM_PROMPT).toContain('Return structured JSON only');
  });

  it('includes the current topic, category, content type and difficulty', () => {
    const prompt = buildUserPrompt({
      strategy,
      topic,
      contentType: 'technical_explanation',
      difficulty: 'intermediate',
      recentPosts: [],
      recentTopics: [],
      formatHint: 'Format A (Observation -> Explanation -> Example -> Takeaway)',
    });

    expect(prompt).toContain('Kubernetes namespaces');
    expect(prompt).toContain('category: Kubernetes');
    expect(prompt).toContain('technical_explanation');
    expect(prompt).toContain('intermediate');
    expect(prompt).toContain('Format A');
  });

  it('lists recent topics so the model can avoid repeating them', () => {
    const recentPosts: StoredPost[] = [
      {
        id: 'p1',
        topic: 'Docker layers',
        category: 'Containers',
        contentType: 'technical_explanation',
        difficulty: 'beginner',
        content: 'x',
        hook: 'x',
        hashtags: [],
        keywords: [],
        generatedAt: new Date().toISOString(),
        status: 'published',
        contentHash: 'abc',
      },
    ];

    const prompt = buildUserPrompt({
      strategy,
      topic,
      contentType: 'technical_explanation',
      difficulty: 'intermediate',
      recentPosts,
      recentTopics: ['Docker layers'],
      formatHint: 'Format B',
    });

    expect(prompt).toContain('Docker layers');
  });

  it('caps the number of recent posts embedded in the prompt at 20', () => {
    const recentPosts: StoredPost[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      topic: `Topic ${i}`,
      category: 'Kubernetes',
      contentType: 'technical_explanation' as const,
      difficulty: 'beginner' as const,
      content: 'x',
      hook: 'x',
      hashtags: [],
      keywords: [],
      generatedAt: new Date().toISOString(),
      status: 'published' as const,
      contentHash: `hash${i}`,
    }));

    const prompt = buildUserPrompt({
      strategy,
      topic,
      contentType: 'technical_explanation',
      difficulty: 'intermediate',
      recentPosts,
      recentTopics: recentPosts.map((p) => p.topic),
      formatHint: 'Format A',
    });

    expect(prompt).toContain('Topic 19');
    expect(prompt).not.toContain('Topic 20');
  });

  it('pickWritingFormat rotates through all defined formats', () => {
    const seen = new Set(Array.from({ length: WRITING_FORMATS.length }, (_, i) => pickWritingFormat(i).name));
    expect(seen.size).toBe(WRITING_FORMATS.length);
    expect(pickWritingFormat(WRITING_FORMATS.length)).toEqual(pickWritingFormat(0));
  });

  it('response schema requires all GeneratedPost fields', () => {
    expect(GENERATED_POST_SCHEMA.required).toEqual(
      expect.arrayContaining(['topic', 'category', 'contentType', 'hook', 'body', 'hashtags', 'keywords']),
    );
  });
});
