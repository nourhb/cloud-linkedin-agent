import type { StoredPost } from '../types.js';
import { readJsonArray, writeJsonArray } from './jsonFileStore.js';

export class PostRepository {
  constructor(private readonly filePath: string) {}

  getAll(): StoredPost[] {
    return readJsonArray<StoredPost>(this.filePath);
  }

  /** Most recent posts first, limited to `limit` entries (SPEC section 57: "last 20 posts"). */
  getRecent(limit: number): StoredPost[] {
    const posts = this.getAll();
    return [...posts]
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);
  }

  findByHash(contentHash: string): StoredPost | undefined {
    return this.getAll().find((p) => p.contentHash === contentHash);
  }

  add(post: StoredPost): void {
    const posts = this.getAll();
    posts.push(post);
    writeJsonArray(this.filePath, posts);
  }

  update(id: string, patch: Partial<StoredPost>): void {
    const posts = this.getAll();
    const index = posts.findIndex((p) => p.id === id);
    if (index === -1) return;
    posts[index] = { ...posts[index], ...patch } as StoredPost;
    writeJsonArray(this.filePath, posts);
  }
}
