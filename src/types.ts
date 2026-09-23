/**
 * Shared domain types for CloudLinkedIn Agent.
 * Keeping these in one place avoids circular imports between modules.
 */

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type ContentType =
  | 'technical_explanation'
  | 'comparison'
  | 'common_mistake'
  | 'architecture'
  | 'troubleshooting'
  | 'learning_in_public'
  | 'project_insight'
  | 'concept_breakdown'
  | 'interview_concept'
  | 'question_discussion'
  | 'mini_case_study';

/** A single candidate topic in the topic catalog (see src/content/topicCatalog.ts). */
export interface TopicCandidate {
  topic: string;
  category: string;
  keywords: string[];
  difficulty: DifficultyLevel;
}

/** Structured JSON the AI model must return (see SPEC section 16). */
export interface GeneratedPost {
  topic: string;
  category: string;
  contentType: ContentType;
  hook: string;
  body: string;
  hashtags: string[];
  keywords: string[];
}

export interface QualityResult {
  valid: boolean;
  score?: number;
  errors: string[];
  warnings: string[];
}

export type FailureCategory =
  | 'AI_RATE_LIMIT'
  | 'AI_AUTH_ERROR'
  | 'AI_NETWORK_ERROR'
  | 'AI_INVALID_RESPONSE'
  | 'LINKEDIN_AUTH_ERROR'
  | 'LINKEDIN_RATE_LIMIT'
  | 'LINKEDIN_BAD_REQUEST'
  | 'LINKEDIN_NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_ERROR'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR';

export class ClassifiedError extends Error {
  public readonly category: FailureCategory;
  public readonly retryable: boolean;
  public override readonly cause?: unknown;

  constructor(
    category: FailureCategory,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'ClassifiedError';
    this.category = category;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

export interface PublishResult {
  success: boolean;
  linkedinPostId?: string;
  publishedAt?: string;
  error?: string;
  errorCategory?: FailureCategory;
}

export type PostStatus = 'generated' | 'published' | 'failed' | 'dry_run';

/** A post persisted in data/posts.json */
export interface StoredPost {
  id: string;
  topic: string;
  category: string;
  contentType: ContentType;
  difficulty: DifficultyLevel;
  content: string;
  hook: string;
  hashtags: string[];
  keywords: string[];
  generatedAt: string;
  publishedAt?: string;
  status: PostStatus;
  linkedinPostId?: string;
  contentHash: string;
}

/** A topic usage record persisted in data/topics.json */
export interface TopicRecord {
  topic: string;
  category: string;
  lastUsed: string;
  cooldownDays: number;
  useCount: number;
}

export type RunStatus = 'success' | 'failed' | 'dry_run' | 'skipped';

/** A run record persisted in data/runs.json */
export interface RunRecord {
  runId: string;
  startedAt: string;
  completedAt: string;
  status: RunStatus;
  topic?: string;
  category?: string;
  contentType?: ContentType;
  generationAttempts: number;
  publicationAttempts: number;
  error?: string;
  errorCategory?: FailureCategory;
  linkedinPostId?: string;
  dryRun: boolean;
}
