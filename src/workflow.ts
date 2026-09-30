import type { AppConfig } from './config/config.js';
import { PostRepository } from './storage/postRepository.js';
import { TopicRepository } from './storage/topicRepository.js';
import { RunRepository } from './storage/runRepository.js';
import { selectTopic } from './content/topicEngine.js';
import { generatePost } from './ai/postGenerator.js';
import { buildImageAltText, buildImagePrompt } from './ai/imagePrompt.js';
import { GeminiClient } from './ai/geminiClient.js';
import { MockGeminiClient } from './ai/mockGeminiClient.js';
import { MockLinkedinClient } from './linkedin/mockLinkedinClient.js';
import type { LinkedInPublisher } from './linkedin/linkedinTypes.js';
import type { AiClient } from './ai/aiClient.js';
import { retry } from './utils/retry.js';
import { logger } from './utils/logger.js';
import { ClassifiedError, type FailureCategory, type GeneratedPost, type RunRecord, type StoredPost } from './types.js';

export interface WorkflowOptions {
  /** Force dry-run regardless of DRY_RUN env (used by `npm run generate:dry`). */
  forceDryRun?: boolean;
  /** Force real publish attempt regardless of DRY_RUN env (used by `npm run publish`). */
  forcePublish?: boolean;
}

export interface WorkflowResult {
  run: RunRecord;
  generatedPost?: GeneratedPost;
}

function createAiClient(config: AppConfig): AiClient {
  if (config.gemini.mockEnabled) {
    logger.info('Using mock Gemini client (MOCK_GEMINI=true)');
    return new MockGeminiClient();
  }
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is missing and MOCK_GEMINI is not enabled.');
  }
  return new GeminiClient(
    config.gemini.apiKey,
    config.gemini.model,
    config.gemini.imageModel,
    config.gemini.fallbackModel,
  );
}

/**
 * Selects the LinkedIn publisher implementation. The real client is created
 * lazily via dynamic import so environments without LinkedIn credentials
 * configured (e.g. dry-run-only local dev) never need that module to
 * resolve successfully.
 */
async function createPublisher(config: AppConfig): Promise<LinkedInPublisher> {
  if (config.linkedin.mockEnabled) {
    logger.info('Using mock LinkedIn client (MOCK_LINKEDIN=true)');
    return new MockLinkedinClient();
  }
  const { LinkedinPublisher } = await import('./linkedin/linkedinPublisher.js');
  return new LinkedinPublisher(config);
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof ClassifiedError) return error.retryable;
  return true;
}

function errorCategoryOf(error: unknown): FailureCategory {
  if (error instanceof ClassifiedError) return error.category;
  return 'UNKNOWN_ERROR';
}

function generateRunId(startedAt: Date): string {
  const stamp = startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `run_${stamp}_${suffix}`;
}

function generatePostId(startedAt: Date): string {
  const stamp = startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `post_${stamp}_${suffix}`;
}

export function localDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function countPublishedOnLocalDay(posts: StoredPost[], timeZone: string, now: Date): number {
  const today = localDayKey(now, timeZone);
  return posts.filter(
    (post) =>
      post.status === 'published' &&
      Boolean(post.publishedAt) &&
      localDayKey(new Date(post.publishedAt as string), timeZone) === today,
  ).length;
}

/**
 * Runs the full daily pipeline described in SPEC section 56/78:
 * load config+history -> select topic -> generate -> validate -> dedupe ->
 * publish -> save history.
 */
export async function runDailyWorkflow(
  config: AppConfig,
  options: WorkflowOptions = {},
): Promise<WorkflowResult> {
  const startedAt = new Date();
  const runId = generateRunId(startedAt);

  const postRepo = new PostRepository(config.paths.postsFile);
  const topicRepo = new TopicRepository(config.paths.topicsFile);
  const runRepo = new RunRepository(config.paths.runsFile);

  const dryRun = options.forcePublish ? false : (options.forceDryRun ?? config.dryRun);

  logger.info('Starting daily content generation', { runId, dryRun });

  if (!dryRun) {
    const publishedToday = countPublishedOnLocalDay(
      postRepo.getAll(),
      config.schedule.timezone,
      startedAt,
    );
    if (publishedToday >= config.maxPostsPerDay) {
      logger.info('Daily post limit already reached, skipping', {
        publishedToday,
        maxPostsPerDay: config.maxPostsPerDay,
      });
      const run: RunRecord = {
        runId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        status: 'skipped',
        generationAttempts: 0,
        publicationAttempts: 0,
        dryRun: false,
      };
      runRepo.add(run);
      return { run };
    }
  }

  const recentPosts = postRepo.getRecent(config.strategy.quality.recentTopicsWindow);
  const topicHistory = topicRepo.getAll();
  const existingHashes = new Set(postRepo.getAll().map((p) => p.contentHash));

  let generationAttempts = 0;
  let publicationAttempts = 0;

  try {
    const aiClient = createAiClient(config);
    const excludedTopics: string[] = [];
    const maxTopicTries = 3;
    let selection: ReturnType<typeof selectTopic> | undefined;
    let generation: Awaited<ReturnType<typeof generatePost>> | undefined;

    for (let topicTry = 1; topicTry <= maxTopicTries; topicTry++) {
      selection = selectTopic({
        strategy: config.strategy,
        recentPosts,
        topicHistory,
        excludeTopics: excludedTopics,
      });
      logger.info('Selected category', { category: selection.topic.category, topicTry });
      logger.info('Selected topic', { topic: selection.topic.topic, reason: selection.reason, topicTry });

      try {
        generation = await generatePost({
          strategy: config.strategy,
          topic: selection.topic,
          contentType: selection.contentType,
          difficulty: selection.difficulty,
          recentPosts,
          recentTopics: recentPosts.map((p) => p.topic),
          existingHashes,
          aiClient,
          maxAttempts: config.maxAiRequestsPerRun,
        });
        generationAttempts += generation.attempts;
        break;
      } catch (error) {
        generationAttempts += config.maxAiRequestsPerRun;
        const canSwitchTopic =
          error instanceof ClassifiedError &&
          error.category === 'VALIDATION_ERROR' &&
          topicTry < maxTopicTries;
        if (canSwitchTopic) {
          logger.warn('Topic failed quality checks, switching topic', {
            failedTopic: selection.topic.topic,
            topicTry,
            error: error.message,
          });
          excludedTopics.push(selection.topic.topic);
          continue;
        }
        throw error;
      }
    }

    if (!generation || !selection) {
      throw new ClassifiedError(
        'VALIDATION_ERROR',
        'Failed to generate a valid post after trying multiple topics. Post will NOT be published.',
      );
    }

    logger.info('Content generated', { attempts: generationAttempts, topic: selection.topic.topic });

    const fullText = `${generation.post.hook}\n\n${generation.post.body}`;

    if (dryRun) {
      logger.info('Publishing to LinkedIn skipped (DRY_RUN)', { reason: 'DRY_RUN=true' });
      const run: RunRecord = {
        runId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        status: 'dry_run',
        topic: selection.topic.topic,
        category: selection.topic.category,
        contentType: selection.contentType,
        generationAttempts,
        publicationAttempts: 0,
        dryRun: true,
      };
      runRepo.add(run);
      logger.info('Workflow completed (dry run - history not persisted for posts/topics)', { runId });
      return { run, generatedPost: generation.post };
    }

    const publisher = await createPublisher(config);

    logger.info('Generating post image');
    const imageAsset = await retry(
      () => aiClient.generateImage(buildImagePrompt(generation.post), generation.post),
      {
        attempts: 2,
        delaysMs: [5_000],
        isRetryable: isRetryableError,
      },
    );
    const publishableImage = {
      ...imageAsset,
      altText: buildImageAltText(generation.post),
    };

    logger.info('Publishing to LinkedIn');
    let publishResult;
    try {
      publishResult = await retry(
        () => {
          publicationAttempts++;
          return publisher.publishPost(generation.post, publishableImage);
        },
        {
          attempts: 3,
          delaysMs: [5_000, 15_000],
          isRetryable: isRetryableError,
        },
      );
    } catch (error) {
      const category = errorCategoryOf(error);
      const message = error instanceof Error ? error.message : String(error);
      logger.error('LinkedIn publication failed', { error: message, category });

      const failedPost: StoredPost = {
        id: generatePostId(startedAt),
        topic: selection.topic.topic,
        category: selection.topic.category,
        contentType: selection.contentType,
        difficulty: selection.difficulty,
        content: fullText,
        hook: generation.post.hook,
        hashtags: generation.post.hashtags,
        keywords: generation.post.keywords,
        generatedAt: startedAt.toISOString(),
        status: 'failed',
        contentHash: generation.contentHash,
      };
      postRepo.add(failedPost);

      const run: RunRecord = {
        runId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        status: 'failed',
        topic: selection.topic.topic,
        category: selection.topic.category,
        contentType: selection.contentType,
        generationAttempts,
        publicationAttempts,
        error: message,
        errorCategory: category,
        dryRun: false,
      };
      runRepo.add(run);
      return { run, generatedPost: generation.post };
    }

    logger.info('LinkedIn publication successful', { postId: publishResult.linkedinPostId });

    const publishedPost: StoredPost = {
      id: generatePostId(startedAt),
      topic: selection.topic.topic,
      category: selection.topic.category,
      contentType: selection.contentType,
      difficulty: selection.difficulty,
      content: fullText,
      hook: generation.post.hook,
      hashtags: generation.post.hashtags,
      keywords: generation.post.keywords,
      generatedAt: startedAt.toISOString(),
      publishedAt: publishResult.publishedAt,
      status: 'published',
      linkedinPostId: publishResult.linkedinPostId,
      contentHash: generation.contentHash,
    };
    postRepo.add(publishedPost);
    topicRepo.recordUsage(
      selection.topic.topic,
      selection.topic.category,
      config.strategy.quality.topicCooldownDays,
      startedAt.toISOString(),
    );
    logger.info('Post history updated', { postId: publishedPost.id });

    const run: RunRecord = {
      runId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: 'success',
      topic: selection.topic.topic,
      category: selection.topic.category,
      contentType: selection.contentType,
      generationAttempts,
      publicationAttempts,
      linkedinPostId: publishResult.linkedinPostId,
      dryRun: false,
    };
    runRepo.add(run);
    logger.info('Workflow completed', { runId, status: 'success' });
    return { run, generatedPost: generation.post };
  } catch (error) {
    const category = errorCategoryOf(error);
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Workflow failed before publication', { error: message, category });

    const run: RunRecord = {
      runId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: 'failed',
      generationAttempts,
      publicationAttempts,
      error: message,
      errorCategory: category,
      dryRun,
    };
    runRepo.add(run);
    return { run };
  }
}
