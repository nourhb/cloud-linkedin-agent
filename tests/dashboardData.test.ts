import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot, decorateTopics, nextScheduledRun } from '../src/ui/dashboardData.js';
import type { RunRecord, StoredPost, TopicRecord } from '../src/types.js';

describe('nextScheduledRun', () => {
  it('picks the next 08:00 or 12:00 in America/Toronto', () => {
    const beforeMorning = nextScheduledRun(new Date('2026-09-25T11:30:00.000Z'), 'America/Toronto');
    const afterMorning = nextScheduledRun(new Date('2026-09-25T12:30:00.000Z'), 'America/Toronto');
    const afterNoon = nextScheduledRun(new Date('2026-09-25T16:30:00.000Z'), 'America/Toronto');
    expect(beforeMorning.toISOString()).toBe('2026-09-25T12:00:00.000Z');
    expect(afterMorning.toISOString()).toBe('2026-09-25T16:00:00.000Z');
    expect(afterNoon.toISOString()).toBe('2026-09-26T12:00:00.000Z');
  });
});

describe('decorateTopics', () => {
  it('marks a recently used topic as still in cooldown', () => {
    const topics: TopicRecord[] = [
      {
        topic: 'DNS fundamentals for cloud infrastructure',
        category: 'Networking',
        lastUsed: '2026-09-25T14:05:10.932Z',
        cooldownDays: 30,
        useCount: 1,
      },
    ];
    const decorated = decorateTopics(topics, new Date('2026-09-25T15:00:00.000Z'));
    expect(decorated[0]?.inCooldown).toBe(true);
    expect(decorated[0]?.daysRemaining).toBe(30);
  });
});

describe('buildDashboardSnapshot', () => {
  it('counts published posts and failed runs separately', () => {
    const posts: StoredPost[] = [
      {
        id: 'p1',
        topic: 'IaC',
        category: 'DevOps',
        contentType: 'technical_explanation',
        difficulty: 'beginner',
        content: 'x',
        hook: 'x',
        hashtags: [],
        keywords: [],
        generatedAt: '2026-09-24T17:31:22.400Z',
        status: 'published',
        contentHash: 'abc',
      },
    ];
    const runs: RunRecord[] = [
      {
        runId: 'r1',
        startedAt: '2026-09-24T17:31:22.400Z',
        completedAt: '2026-09-24T17:31:32.789Z',
        status: 'success',
        generationAttempts: 1,
        publicationAttempts: 1,
        dryRun: false,
      },
      {
        runId: 'r2',
        startedAt: '2026-09-24T17:29:30.153Z',
        completedAt: '2026-09-24T17:29:40.053Z',
        status: 'failed',
        generationAttempts: 1,
        publicationAttempts: 1,
        dryRun: false,
      },
    ];

    const snapshot = buildDashboardSnapshot({
      posts,
      runs,
      topics: [],
      profileName: 'Nour',
      timezone: 'America/Toronto',
      now: new Date('2026-09-25T15:00:00.000Z'),
    });

    expect(snapshot.stats.published).toBe(1);
    expect(snapshot.stats.failed).toBe(1);
    expect(snapshot.stats.lastStatus).toBe('success');
  });
});
