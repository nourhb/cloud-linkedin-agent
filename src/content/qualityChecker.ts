import type { ContentStrategy } from '../config/config.js';
import type { GeneratedPost, QualityResult } from '../types.js';
import { FABRICATED_EXPERIENCE_PATTERNS, FORBIDDEN_PHRASES, GENERIC_HASHTAG_BLACKLIST } from './contentRules.js';
import { isTooSimilar } from './deduplication.js';

/** Extracts the first sentence of a body of text (used for opening-repetition checks). */
export function getOpeningSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?\n]{1,200}[.!?]?/);
  return (match?.[0] ?? trimmed.slice(0, 200)).trim();
}

function fullPostText(post: GeneratedPost): string {
  return `${post.hook}\n\n${post.body}`.trim();
}

/**
 * Validates a generated post before it's ever eligible for publication
 * (SPEC section 17 / 41). Never publishes anything that fails validation
 * (SPEC section 35).
 */
export function checkQuality(
  post: GeneratedPost,
  context: {
    strategy: ContentStrategy;
    recentOpeningSentences?: string[];
    recentPostTexts?: string[];
  },
): QualityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { strategy } = context;

  // --- Required fields ---------------------------------------------------
  if (!post.topic || post.topic.trim() === '') errors.push('missing topic');
  if (!post.category || post.category.trim() === '') errors.push('missing category');
  if (!post.contentType || post.contentType.trim() === '') errors.push('missing contentType');
  if (!post.hook || post.hook.trim() === '') errors.push('missing hook');
  if (!post.body || post.body.trim() === '') errors.push('empty content');

  const combinedText = fullPostText(post);

  // --- Length --------------------------------------------------------------
  if (combinedText.length > 0) {
    if (combinedText.length < strategy.quality.minLength) {
      errors.push(
        `content too short (${combinedText.length} chars, minimum ${strategy.quality.minLength})`,
      );
    }
    if (combinedText.length > strategy.quality.maxLength) {
      errors.push(
        `content too long (${combinedText.length} chars, maximum ${strategy.quality.maxLength})`,
      );
    }
  }

  // --- Hashtags --------------------------------------------------------------
  const hashtags = post.hashtags ?? [];
  if (hashtags.length < strategy.hashtags.minimum) {
    errors.push(`too few hashtags (${hashtags.length}, minimum ${strategy.hashtags.minimum})`);
  }
  if (hashtags.length > strategy.hashtags.maximum) {
    errors.push(`too many hashtags (${hashtags.length}, maximum ${strategy.hashtags.maximum})`);
  }
  for (const tag of hashtags) {
    if (!tag.startsWith('#')) {
      errors.push(`hashtag "${tag}" must start with #`);
    }
    if (GENERIC_HASHTAG_BLACKLIST.includes(tag.toLowerCase())) {
      warnings.push(`hashtag "${tag}" is generic and may not be relevant`);
    }
  }

  // --- Forbidden AI filler phrases -------------------------------------------
  const lowerText = combinedText.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lowerText.includes(phrase)) {
      errors.push(`contains forbidden filler phrase: "${phrase}"`);
    }
  }

  // --- Fabricated experience (SPEC section 59, mandatory rule) ---------------
  for (const pattern of FABRICATED_EXPERIENCE_PATTERNS) {
    if (pattern.test(combinedText)) {
      errors.push(`possible fabricated professional experience detected (matched: ${pattern})`);
    }
  }

  // --- Repetition: opening sentence vs recent posts ---------------------------
  const opening = getOpeningSentence(post.hook || combinedText);
  const recentOpenings = context.recentOpeningSentences ?? [];
  if (recentOpenings.length > 0 && isTooSimilar(opening, recentOpenings, strategy.quality.openingSimilarityThreshold)) {
    errors.push('opening sentence is too similar to a recently published post');
  }

  // --- Semantic similarity vs recent full post texts --------------------------
  const recentTexts = context.recentPostTexts ?? [];
  if (recentTexts.length > 0 && isTooSimilar(combinedText, recentTexts, strategy.quality.similarityThreshold)) {
    errors.push('post content is too semantically similar to a recently published post');
  }

  const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 5);

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings,
  };
}
