import { describe, expect, it } from 'vitest';
import { selectContentType, selectDifficultyLevel, selectTopic } from '../src/content/topicEngine.js';
import { getCatalogByCategories } from '../src/content/topicCatalog.js';
import type { StoredPost, TopicRecord } from '../src/types.js';
import { buildTestStrategy } from './fixtures/strategy.js';

function fixedRandom(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const value = sequence[i % sequence.length] ?? 0;
    i++;
    return value;
  };
}

function storedPost(overrides: Partial<StoredPost> = {}): StoredPost {
  return {
    id: 'post_1',
    topic: 'Docker vs Virtual Machines',
    category: 'Containers',
    contentType: 'comparison',
    difficulty: 'beginner',
    content: 'content',
    hook: 'hook',
    hashtags: ['#Docker'],
    keywords: ['docker'],
    generatedAt: new Date().toISOString(),
    status: 'published',
    contentHash: 'hash1',
    ...overrides,
  };
}

describe('topicEngine.selectTopic', () => {
  const strategy = buildTestStrategy();

  it('never selects a topic that is currently in cooldown', () => {
    const now = new Date('2026-09-23T00:00:00Z');
    const topicHistory: TopicRecord[] = [
      { topic: 'Kubernetes namespaces', category: 'Kubernetes', lastUsed: '2026-09-20T00:00:00Z', cooldownDays: 30, useCount: 1 },
    ];

    for (let i = 0; i < 25; i++) {
      const result = selectTopic({ strategy, recentPosts: [], topicHistory, now, random: Math.random });
      expect(result.topic.topic.toLowerCase()).not.toBe('kubernetes namespaces');
    }
  });

  it('avoids topics that are semantically similar to recently used topics', () => {
    // Use a lower similarity threshold here so short topic phrases (which
    // naturally share fewer overlapping tokens than full post bodies) are
    // reliably caught for this test of the filtering mechanism itself.
    const sensitiveStrategy = buildTestStrategy({ quality: { ...strategy.quality, similarityThreshold: 0.2 } });
    const recentPosts: StoredPost[] = [storedPost({ topic: 'What is a hypervisor?' })];
    const result = selectTopic({
      strategy: sensitiveStrategy,
      recentPosts,
      topicHistory: [],
      random: fixedRandom([0]),
    });
    expect(result.topic.topic.toLowerCase()).not.toContain('hypervisor');
  });

  it('falls back to the least-recently-used topic when every candidate is in cooldown', () => {
    const now = new Date('2026-09-23T00:00:00Z');
    const allCandidates = getCatalogByCategories(strategy.content.mainTopics);
    // Put every topic into cooldown, but make one of them the "oldest" usage
    // (still within the cooldown window) so the fallback should prefer it.
    const oldestTopic = allCandidates[0]!.topic;
    const topicHistory: TopicRecord[] = allCandidates.map((c, i) => {
      const daysAgo = i === 0 ? 20 : 1;
      const lastUsed = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      return { topic: c.topic, category: c.category, lastUsed, cooldownDays: 30, useCount: 1 };
    });

    const result = selectTopic({ strategy, recentPosts: [], topicHistory, now, random: fixedRandom([0]) });
    expect(result.reason).toContain('fallback');
    expect(result.topic.topic).toBe(oldestTopic);
  });

  it('prefers underrepresented categories', () => {
    const heavilyUsedCategory = 'Kubernetes';
    const recentPosts: StoredPost[] = Array.from({ length: 10 }, (_, i) =>
      storedPost({ id: `p${i}`, topic: `Kubernetes topic ${i}`, category: heavilyUsedCategory }),
    );
    const counts = new Map<string, number>();
    for (let i = 0; i < 50; i++) {
      const result = selectTopic({ strategy, recentPosts, topicHistory: [], random: Math.random });
      counts.set(result.topic.category, (counts.get(result.topic.category) ?? 0) + 1);
    }
    // Kubernetes is heavily overrepresented, so it should not dominate the selections.
    const kubernetesShare = (counts.get('Kubernetes') ?? 0) / 50;
    expect(kubernetesShare).toBeLessThan(0.3);
  });
});

describe('topicEngine.selectDifficultyLevel', () => {
  const strategy = buildTestStrategy();

  it('starts at beginner for a brand new account', () => {
    expect(selectDifficultyLevel(strategy, 0, Math.random)).toBe('beginner');
  });

  it('progresses to intermediate after postsPerLevel posts', () => {
    expect(selectDifficultyLevel(strategy, strategy.difficultyProgression.postsPerLevel, Math.random)).toBe(
      'intermediate',
    );
  });

  it('progresses to advanced after two levels worth of posts', () => {
    expect(
      selectDifficultyLevel(strategy, strategy.difficultyProgression.postsPerLevel * 2, Math.random),
    ).toBe('advanced');
  });

  it('mixes levels once the full progression has been covered', () => {
    const totalCycle = strategy.difficultyProgression.postsPerLevel * strategy.difficultyProgression.levels.length;
    const levels = new Set<string>();
    for (let i = 0; i < 20; i++) {
      levels.add(selectDifficultyLevel(strategy, totalCycle, Math.random));
    }
    expect(levels.size).toBeGreaterThan(1);
  });
});

describe('topicEngine.selectContentType', () => {
  const strategy = buildTestStrategy();

  it('avoids repeating the two most recently used content types', () => {
    const recentPosts: StoredPost[] = [
      storedPost({ contentType: 'technical_explanation' }),
      storedPost({ contentType: 'project_insight' }),
    ];
    for (let i = 0; i < 25; i++) {
      const type = selectContentType(strategy, recentPosts, Math.random);
      expect(['technical_explanation', 'project_insight']).not.toContain(type);
    }
  });
});
