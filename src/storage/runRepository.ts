import type { RunRecord } from '../types.js';
import { readJsonArray, writeJsonArray } from './jsonFileStore.js';

export class RunRepository {
  constructor(private readonly filePath: string) {}

  getAll(): RunRecord[] {
    return readJsonArray<RunRecord>(this.filePath);
  }

  getRecent(limit: number): RunRecord[] {
    const runs = this.getAll();
    return [...runs]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  add(run: RunRecord): void {
    const runs = this.getAll();
    runs.push(run);
    writeJsonArray(this.filePath, runs);
  }
}
