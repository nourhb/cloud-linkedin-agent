import type { ContentStrategy } from '../config/config.js';
import { checkQuality, getOpeningSentence } from '../content/qualityChecker.js';
import { hashContent } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import type { ContentType, DifficultyLevel, GeneratedPost, StoredPost, TopicCandidate } from '../types.js';
import { ClassifiedError } from '../types.js';
import type { AiClient } from './aiClient.js';
import { buildUserPrompt, pickWritingFormat, SYSTEM_PROMPT } from './promptBuilder.js';

export interface PostGenerationInput {
  strategy: ContentStrategy;
  topic: TopicCandidate;
  contentType: ContentType;
  difficulty: DifficultyLevel;
  recentPosts: StoredPost[];
  recentTopics: string[];
  existingHashes: Set<string>;
  aiClient: AiClient;
  maxAttempts: number;
}

export interface PostGenerationResult {
  post: GeneratedPost;
  contentHash: string;
  attempts: number;
}

function parseGeneratedPost(raw: string): GeneratedPost {
  let cleaned = raw.trim();
  // Defensive: strip markdown code fences if the model added them despite instructions.
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new ClassifiedError('AI_INVALID_RESPONSE', `AI response was not valid JSON: ${(error as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ClassifiedError('AI_INVALID_RESPONSE', 'AI response JSON was not an object.');
  }

  const candidate = parsed as Partial<GeneratedPost>;
  const requiredFields: (keyof GeneratedPost)[] = [
    'topic',
    'category',
    'contentType',
    'hook',
    'body',
    'hashtags',
    'keywords',
  ];
  const missing = requiredFields.filter((field) => candidate[field] === undefined || candidate[field] === null);
  if (missing.length > 0) {
    throw new ClassifiedError(
      'AI_INVALID_RESPONSE',
      `AI response is missing required fields: ${missing.join(', ')}`,
    );
  }

  return candidate as GeneratedPost;
}

/**
 * Generates + validates a post, regenerating up to `maxAttempts` times on
 * validation/duplicate failure (SPEC section 36). Never returns a post that
 * failed validation or duplicate checks - throws instead so the caller does
 * not publish (SPEC section 35/38).
 */
export async function generatePost(input: PostGenerationInput): Promise<PostGenerationResult> {
  const { strategy, topic, contentType, difficulty, recentPosts, recentTopics, existingHashes, aiClient } = input;
  const maxAttempts = Math.max(1, input.maxAttempts);

  const recentOpeningSentences = recentPosts.map((p) => getOpeningSentence(p.hook || p.content));
  const recentPostTexts = recentPosts.map((p) => `${p.hook}\n\n${p.content}`);

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.info('Generating content', { attempt, maxAttempts, topic: topic.topic, contentType });

    const format = pickWritingFormat(attempt - 1 + topic.topic.length);
    const userPrompt = buildUserPrompt({
      strategy,
      topic,
      contentType,
      difficulty,
      recentPosts,
      recentTopics,
      formatHint: `${format.name} (${format.structure})`,
    });

    let rawResponse: string;
    try {
      rawResponse = await aiClient.generateJson(SYSTEM_PROMPT, userPrompt);
    } catch (error) {
      if (error instanceof ClassifiedError && !error.retryable) {
        throw error; // permanent errors (e.g. auth) should not be retried (SPEC section 33)
      }
      lastError = error instanceof Error ? error.message : String(error);
      logger.warn('AI generation attempt failed', { attempt, error: lastError });
      continue;
    }

    let post: GeneratedPost;
    try {
      post = parseGeneratedPost(rawResponse);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logger.warn('AI response failed to parse', { attempt, error: lastError });
      continue;
    }

    const quality = checkQuality(post, { strategy, recentOpeningSentences, recentPostTexts });
    if (!quality.valid) {
      lastError = `Validation failed: ${quality.errors.join('; ')}`;
      logger.warn('Generated post failed quality validation', { attempt, errors: quality.errors });
      continue;
    }

    const contentHash = hashContent(`${post.hook}\n\n${post.body}`);
    if (existingHashes.has(contentHash)) {
      lastError = 'Generated post content hash already exists in history (exact duplicate).';
      logger.warn('Duplicate content hash detected', { attempt, contentHash });
      continue;
    }

    logger.info('Validation passed', { attempt });
    logger.info('Duplicate check passed', { attempt });
    return { post, contentHash, attempts: attempt };
  }

  throw new ClassifiedError(
    'VALIDATION_ERROR',
    `Failed to generate a valid, non-duplicate post after ${maxAttempts} attempts. Last error: ${lastError ?? 'unknown'}. Post will NOT be published.`,
  );
}
