/**
 * Lightweight semantic-similarity mechanism (SPEC section 13).
 *
 * "What is a hypervisor?" / "Understanding hypervisors" / "How hypervisors
 * work" should be flagged as similar even though the strings differ.
 * Exact string matching is not enough, so we normalize, tokenize, strip
 * stop words, and compare with Jaccard similarity.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'for', 'with', 'and', 'or', 'but', 'if', 'as',
  'at', 'by', 'from', 'into', 'about', 'how', 'what', 'why', 'when',
  'you', 'your', 'i', 'my', 'it', 'its', 'this', 'that', 'these', 'those',
  'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'work',
  'works', 'understanding', 'explained', 'explain', 'vs',
]);

export function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .replace(/[^a-z0-9\s#]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((token) => !STOP_WORDS.has(token));
}

/**
 * Extremely naive stemmer (strip a trailing "s" on longer words) so that
 * "hypervisor" and "hypervisors" are treated as the same token. This is
 * intentionally simple (SPEC section 13: "For V1, use a lightweight
 * similarity mechanism") rather than pulling in a full NLP dependency.
 */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/** Normalize -> tokenize -> remove stop words -> stem, producing a comparable token set. */
export function toTokenSet(text: string): Set<string> {
  return new Set(removeStopWords(tokenize(text)).map(stem));
}

/** Jaccard similarity between two token sets: |intersection| / |union|. */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/** Convenience wrapper comparing two raw strings. */
export function textSimilarity(textA: string, textB: string): number {
  return jaccardSimilarity(toTokenSet(textA), toTokenSet(textB));
}

/**
 * Returns the highest similarity score found between `candidate` and any of
 * `existingTexts`, along with the most similar match (useful for logging).
 */
export function maxSimilarity(
  candidate: string,
  existingTexts: string[],
): { score: number; mostSimilar?: string } {
  const candidateSet = toTokenSet(candidate);
  let best = 0;
  let mostSimilar: string | undefined;
  for (const existing of existingTexts) {
    const score = jaccardSimilarity(candidateSet, toTokenSet(existing));
    if (score > best) {
      best = score;
      mostSimilar = existing;
    }
  }
  return { score: best, mostSimilar };
}

/** True if `candidate` is too similar (>= threshold) to any of `existingTexts`. */
export function isTooSimilar(
  candidate: string,
  existingTexts: string[],
  threshold: number,
): boolean {
  return maxSimilarity(candidate, existingTexts).score >= threshold;
}
