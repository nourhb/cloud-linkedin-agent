import { createHash } from 'node:crypto';

/**
 * Normalizes text before hashing so that trivial whitespace/case differences
 * don't produce different hashes for effectively identical content.
 */
export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s#]/g, '')
    .trim();
}

/** SHA-256 hash of the normalized content (SPEC section 37). */
export function hashContent(text: string): string {
  const normalized = normalizeForHash(text);
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}
