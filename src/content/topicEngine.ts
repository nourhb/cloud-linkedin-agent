import type { ContentStrategy } from '../config/config.js';
import type { ContentType, DifficultyLevel, RunRecord, StoredPost, TopicCandidate, TopicRecord } from '../types.js';
import { ALL_CONTENT_TYPES } from './contentRules.js';
import { isTooSimilar, textSimilarity } from './deduplication.js';
import { getCatalogByCategories } from './topicCatalog.js';

export interface TopicSelectionInput {
  strategy: ContentStrategy;
  recentPosts: StoredPost[];
  topicHistory: TopicRecord[];
  now?: Date;
  /** Injectable RNG for deterministic tests. Returns a float in [0, 1). */
  random?: () => number;
}

export interface TopicSelectionResult {
  topic: TopicCandidate;
  contentType: ContentType;
  difficulty: DifficultyLevel;
  reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isInCooldown(record: TopicRecord | undefined, now: Date): boolean {
  if (!record) return false;
  const daysSince = (now.getTime() - new Date(record.lastUsed).getTime()) / MS_PER_DAY;
  return daysSince < record.cooldownDays;
}

function weightedPick<T>(items: { item: T; weight: number }[], random: () => number): T {
  const total = items.reduce((sum, i) => sum + Math.max(i.weight, 0.0001), 0);
  let target = random() * total;
  for (const entry of items) {
    target -= Math.max(entry.weight, 0.0001);
    if (target <= 0) return entry.item;
  }
  // Fallback: last item should never be reached in practice, but keeps types happy.
  const last = items[items.length - 1];
  return (last as { item: T }).item;
}

/** SPEC section 21/58: learning progression, mixing difficulty levels once all have been covered. */
export function selectDifficultyLevel(
  strategy: ContentStrategy,
  totalPosts: number,
  random: () => number,
): DifficultyLevel {
  const { postsPerLevel, levels } = strategy.difficultyProgression;
  const typedLevels = levels as DifficultyLevel[];
  const cycleLength = postsPerLevel * typedLevels.length;

  if (totalPosts >= cycleLength) {
    // Fully ramped up: mix levels going forward instead of random noise on day 1.
    const index = Math.floor(random() * typedLevels.length);
    return typedLevels[index] ?? 'beginner';
  }

  const index = Math.min(Math.floor(totalPosts / postsPerLevel), typedLevels.length - 1);
  return typedLevels[index] ?? 'beginner';
}

/** SPEC section 19: track and rotate content types, avoiding recent repeats. */
export function selectContentType(
  strategy: ContentStrategy,
  recentPosts: StoredPost[],
  random: () => number,
): ContentType {
  const weights = strategy.content.contentTypeWeights;
  const lastUsed = new Set(recentPosts.slice(0, 2).map((p) => p.contentType));

  const candidates = ALL_CONTENT_TYPES.map((type) => ({
    item: type,
    weight: weights[type] ?? 1,
  })).filter((c) => !lastUsed.has(c.item));

  const pool = candidates.length > 0
    ? candidates
    : ALL_CONTENT_TYPES.map((type) => ({ item: type, weight: weights[type] ?? 1 }));

  return weightedPick(pool, random);
}

/**
 * Selects the next topic following the pipeline described in SPEC sections
 * 11 and 56: build candidates -> remove cooldown -> remove near-duplicates
 * -> balance categories -> pick.
 */
export function selectTopic(input: TopicSelectionInput): TopicSelectionResult {
  const { strategy, recentPosts, topicHistory } = input;
  const now = input.now ?? new Date();
  const random = input.random ?? Math.random;

  const recentWindow = strategy.quality.recentTopicsWindow;
  const recentTopicTexts = recentPosts.slice(0, recentWindow).map((p) => p.topic);

  const topicRecordByName = new Map(topicHistory.map((t) => [t.topic.toLowerCase(), t]));

  // 1. Build candidates from configured categories.
  const allCandidates = getCatalogByCategories(strategy.content.mainTopics);

  // 2. Remove topics currently in cooldown.
  let candidates = allCandidates.filter(
    (c) => !isInCooldown(topicRecordByName.get(c.topic.toLowerCase()), now),
  );
  let reason = 'filtered by cooldown';

  // 3. Remove topics semantically similar to recently used topics.
  if (recentTopicTexts.length > 0) {
    const afterSimilarity = candidates.filter(
      (c) => !isTooSimilar(c.topic, recentTopicTexts, strategy.quality.similarityThreshold),
    );
    if (afterSimilarity.length > 0) {
      candidates = afterSimilarity;
      reason = 'filtered by cooldown + semantic similarity';
    }
  }

  // Fallback: everything is in cooldown or too similar -> pick the least-recently-used topic.
  if (candidates.length === 0) {
    candidates = allCandidates.length > 0 ? allCandidates : [];
    if (candidates.length === 0) {
      throw new Error(
        'Topic catalog produced zero candidates. Check config/content-strategy.json mainTopics against src/content/topicCatalog.ts categories.',
      );
    }
    candidates = [...candidates].sort((a, b) => {
      const recordA = topicRecordByName.get(a.topic.toLowerCase());
      const recordB = topicRecordByName.get(b.topic.toLowerCase());
      const timeA = recordA ? new Date(recordA.lastUsed).getTime() : 0;
      const timeB = recordB ? new Date(recordB.lastUsed).getTime() : 0;
      return timeA - timeB;
    });
    reason = 'fallback: all candidates were in cooldown or too similar, picked least-recently-used';
  }

  // 4. Difficulty progression.
  const difficulty = selectDifficultyLevel(strategy, recentPosts.length, random);
  let difficultyFiltered = candidates.filter((c) => c.difficulty === difficulty);
  if (difficultyFiltered.length === 0) {
    difficultyFiltered = candidates; // broaden if the exact level has no candidates left
  }

  // 5. Category balance: favor categories underrepresented in the recent window.
  const categoryCounts = new Map<string, number>();
  for (const post of recentPosts.slice(0, recentWindow)) {
    categoryCounts.set(post.category, (categoryCounts.get(post.category) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...Array.from(categoryCounts.values()));

  const weighted = difficultyFiltered.map((candidate) => {
    const used = categoryCounts.get(candidate.category) ?? 0;
    // Underrepresented categories get a higher weight; +1 avoids zero-weight starvation.
    const weight = maxCount - used + 1;
    return { item: candidate, weight };
  });

  const selectedTopic = weightedPick(weighted, random);
  const contentType = selectContentType(strategy, recentPosts, random);

  return { topic: selectedTopic, contentType, difficulty, reason };
}

/** Small helper for GitHub Action summaries / logs (SPEC section 53/54). */
export function summarizeRecentActivity(recentPosts: StoredPost[], recentRuns: RunRecord[]) {
  const categories = new Map<string, number>();
  for (const post of recentPosts) {
    categories.set(post.category, (categories.get(post.category) ?? 0) + 1);
  }
  const failures = recentRuns.filter((r) => r.status === 'failed').length;
  return { postsPublished: recentPosts.length, categories: Object.fromEntries(categories), failures };
}

/** Uses raw textSimilarity for callers that want the score, not just a boolean. */
export function topicSimilarityScore(a: string, b: string): number {
  return textSimilarity(a, b);
}
