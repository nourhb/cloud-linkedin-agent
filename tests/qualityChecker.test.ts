import { describe, expect, it } from 'vitest';
import { checkQuality, getOpeningSentence } from '../src/content/qualityChecker.js';
import type { GeneratedPost } from '../src/types.js';
import { buildTestStrategy } from './fixtures/strategy.js';

function longEnoughBody(paragraphs: number): string {
  const sentence =
    'Kubernetes namespaces let you split a cluster into isolated logical groups for teams and environments. ';
  return Array.from({ length: paragraphs }, () => sentence.repeat(3)).join('\n\n');
}

function basePost(overrides: Partial<GeneratedPost> = {}): GeneratedPost {
  return {
    topic: 'Kubernetes namespaces',
    category: 'Kubernetes',
    contentType: 'technical_explanation',
    hook: 'One Kubernetes concept I underestimated at first was namespaces.',
    body: longEnoughBody(3),
    hashtags: ['#Kubernetes', '#CloudComputing', '#DevOps'],
    keywords: ['kubernetes', 'namespace', 'cluster'],
    ...overrides,
  };
}

describe('qualityChecker', () => {
  const strategy = buildTestStrategy();

  it('accepts a well-formed post', () => {
    const result = checkQuality(basePost(), { strategy });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects posts that are too short', () => {
    const result = checkQuality(basePost({ body: 'Too short.' }), { strategy });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('too short'))).toBe(true);
  });

  it('rejects posts that are too long', () => {
    const result = checkQuality(basePost({ body: longEnoughBody(20) }), { strategy });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('too long'))).toBe(true);
  });

  it('rejects posts with too few hashtags', () => {
    const result = checkQuality(basePost({ hashtags: ['#Kubernetes'] }), { strategy });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('too few hashtags'))).toBe(true);
  });

  it('rejects posts with too many hashtags', () => {
    const result = checkQuality(
      basePost({ hashtags: ['#A', '#B', '#C', '#D', '#E', '#F'] }),
      { strategy },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('too many hashtags'))).toBe(true);
  });

  it('rejects forbidden AI filler phrases', () => {
    const result = checkQuality(
      basePost({ hook: "In today's rapidly evolving world of cloud computing" }),
      { strategy },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('forbidden filler phrase'))).toBe(true);
  });

  it('rejects likely fabricated professional experience', () => {
    const result = checkQuality(
      basePost({
        body:
          longEnoughBody(2) +
          '\n\nI deployed Kubernetes clusters for several enterprise clients last year.',
      }),
      { strategy },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fabricated'))).toBe(true);
  });

  it('rejects posts whose opening sentence repeats a recent post', () => {
    const result = checkQuality(basePost(), {
      strategy,
      recentOpeningSentences: ['One Kubernetes concept I underestimated at first was namespaces.'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('opening sentence'))).toBe(true);
  });

  it('flags missing required fields', () => {
    const result = checkQuality(basePost({ topic: '' }), { strategy });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing topic');
  });
});

describe('getOpeningSentence', () => {
  it('extracts the first sentence', () => {
    expect(getOpeningSentence('First sentence here. Second sentence follows.')).toBe(
      'First sentence here.',
    );
  });
});
