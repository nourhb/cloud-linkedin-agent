import type { TopicRecord } from '../types.js';
import { readJsonArray, writeJsonArray } from './jsonFileStore.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class TopicRepository {
  constructor(private readonly filePath: string) {}

  getAll(): TopicRecord[] {
    return readJsonArray<TopicRecord>(this.filePath);
  }

  getRecent(limit: number): TopicRecord[] {
    const topics = this.getAll();
    return [...topics]
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, limit);
  }

  /** SPEC section 12: topic cooldown. */
  isInCooldown(topic: string, now: Date = new Date()): boolean {
    const record = this.getAll().find((t) => t.topic.toLowerCase() === topic.toLowerCase());
    if (!record) return false;
    const daysSinceUsed = (now.getTime() - new Date(record.lastUsed).getTime()) / MS_PER_DAY;
    return daysSinceUsed < record.cooldownDays;
  }

  recordUsage(topic: string, category: string, cooldownDays: number, usedAt: string): void {
    const topics = this.getAll();
    const index = topics.findIndex((t) => t.topic.toLowerCase() === topic.toLowerCase());
    if (index === -1) {
      topics.push({ topic, category, lastUsed: usedAt, cooldownDays, useCount: 1 });
    } else {
      const existing = topics[index];
      if (existing) {
        topics[index] = {
          ...existing,
          lastUsed: usedAt,
          cooldownDays,
          useCount: existing.useCount + 1,
        };
      }
    }
    writeJsonArray(this.filePath, topics);
  }
}
