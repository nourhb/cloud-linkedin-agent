import type { RunRecord, StoredPost, TopicRecord } from '../types.js';

export interface DashboardTopic extends TopicRecord {
  inCooldown: boolean;
  daysRemaining: number;
}

export interface DashboardSnapshot {
  generatedAt: string;
  profileName: string;
  timezone: string;
  scheduleLabel: string;
  nextRunAt: string;
  stats: {
    published: number;
    failed: number;
    dryRuns: number;
    topicsInCooldown: number;
    lastStatus: string | null;
    lastRunAt: string | null;
    lastError: string | null;
  };
  posts: StoredPost[];
  runs: RunRecord[];
  topics: DashboardTopic[];
}

export function nextScheduledRun(now: Date, timeZone: string, hour = 9): Date {
  const local = partsInZone(now, timeZone);
  const alreadyPassed = local.hour > hour || (local.hour === hour && local.minute > 0);
  const target = alreadyPassed
    ? addDays(local.year, local.month, local.day, 1)
    : { year: local.year, month: local.month, day: local.day };
  return zonedDateToUtc(target.year, target.month, target.day, hour, timeZone);
}

export function decorateTopics(topics: TopicRecord[], now: Date): DashboardTopic[] {
  return topics
    .map((topic) => {
      const elapsedMs = now.getTime() - new Date(topic.lastUsed).getTime();
      const elapsedDays = elapsedMs / 86_400_000;
      const daysRemaining = Math.max(0, Math.ceil(topic.cooldownDays - elapsedDays));
      return {
        ...topic,
        inCooldown: daysRemaining > 0,
        daysRemaining,
      };
    })
    .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
}

export function buildDashboardSnapshot(input: {
  posts: StoredPost[];
  runs: RunRecord[];
  topics: TopicRecord[];
  profileName: string;
  timezone: string;
  now?: Date;
}): DashboardSnapshot {
  const now = input.now ?? new Date();
  const posts = [...input.posts].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  const runs = [...input.runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const topics = decorateTopics(input.topics, now);
  const lastRun = runs[0];

  return {
    generatedAt: now.toISOString(),
    profileName: input.profileName,
    timezone: input.timezone,
    scheduleLabel: `Every day at 09:00 ${input.timezone}`,
    nextRunAt: nextScheduledRun(now, input.timezone).toISOString(),
    stats: {
      published: posts.filter((p) => p.status === 'published').length,
      failed: runs.filter((r) => r.status === 'failed').length,
      dryRuns: runs.filter((r) => r.status === 'dry_run').length,
      topicsInCooldown: topics.filter((t) => t.inCooldown).length,
      lastStatus: lastRun?.status ?? null,
      lastRunAt: lastRun?.completedAt ?? lastRun?.startedAt ?? null,
      lastError: lastRun?.error ?? null,
    },
    posts,
    runs,
    topics,
  };
}

function partsInZone(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function addDays(year: number, month: number, day: number, days: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function zonedDateToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  let utc = Date.UTC(year, month - 1, day, hour, 0, 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = partsInZone(new Date(utc), timeZone);
    const wanted = Date.UTC(year, month - 1, day, hour);
    const got = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    utc += wanted - got;
  }
  return new Date(utc);
}
