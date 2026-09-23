import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ClassifiedError } from '../types.js';

/**
 * Generic read/write helper for the repository's JSON-array data files
 * (data/posts.json, data/topics.json, data/runs.json). The repository
 * itself is the source of truth (SPEC section 6) - GitHub Actions commits
 * these files back after each run (SPEC section 48).
 */
export function readJsonArray<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const raw = readFileSync(filePath, 'utf-8').trim();
    if (raw === '') return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected a JSON array in ${filePath}`);
    }
    return parsed as T[];
  } catch (error) {
    throw new ClassifiedError('STORAGE_ERROR', `Failed to read ${filePath}: ${(error as Error).message}`, {
      cause: error,
    });
  }
}

export function writeJsonArray<T>(filePath: string, data: T[]): void {
  try {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } catch (error) {
    throw new ClassifiedError('STORAGE_ERROR', `Failed to write ${filePath}: ${(error as Error).message}`, {
      cause: error,
    });
  }
}
