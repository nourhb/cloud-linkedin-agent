import { describe, expect, it } from 'vitest';
import { countPublishedOnLocalDay, localDayKey } from '../src/workflow.js';
import type { StoredPost } from '../src/types.js';

function post(publishedAt: string): StoredPost {
  return {
    id: 'p1',
    topic: 'Object storage explained',
    category: 'Cloud Computing',
    contentType: 'technical_explanation',
    difficulty: 'beginner',
    content: 'x',
    hook: 'x',
    hashtags: [],
    keywords: [],
    generatedAt: publishedAt,
    publishedAt,
    status: 'published',
    contentHash: 'h',
  };
}

describe('daily post limit', () => {
  it('formats the calendar day in the configured timezone', () => {
    expect(localDayKey(new Date('2026-09-30T02:00:00Z'), 'America/Toronto')).toBe('2026-09-29');
    expect(localDayKey(new Date('2026-09-30T14:00:00Z'), 'America/Toronto')).toBe('2026-09-30');
  });

  it('counts only published posts from the current local day', () => {
    const now = new Date('2026-09-30T14:30:00Z');
    const posts: StoredPost[] = [
      post('2026-09-30T13:00:00Z'),
      post('2026-09-29T18:00:00Z'),
      { ...post('2026-09-30T13:05:00Z'), status: 'failed' },
    ];
    expect(countPublishedOnLocalDay(posts, 'America/Toronto', now)).toBe(1);
  });
});
