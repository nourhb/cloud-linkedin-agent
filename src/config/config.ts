import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// src/config -> project root is two levels up
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export interface ContentStrategy {
  profile: {
    name: string;
    careerGoal: string;
    experienceLevel: string;
    location: string;
  };
  content: {
    language: string;
    postsPerDay: number;
    mainTopics: string[];
    secondaryTopics: string[];
    contentTypeWeights: Record<string, number>;
  };
  style: {
    tone: string;
    technicalLevel: string;
    avoidCorporateLanguage: boolean;
    avoidGenericMotivation: boolean;
    avoidClickbait: boolean;
    usePersonalLearningPerspective: boolean;
  };
  hashtags: {
    minimum: number;
    maximum: number;
    preferred: string[];
  };
  quality: {
    minLength: number;
    maxLength: number;
    similarityThreshold: number;
    openingSimilarityThreshold: number;
    recentTopicsWindow: number;
    topicCooldownDays: number;
  };
  difficultyProgression: {
    postsPerLevel: number;
    levels: string[];
  };
}

export interface AppConfig {
  nodeEnv: string;
  gemini: {
    apiKey: string | undefined;
    model: string;
    imageModel: string;
    mockEnabled: boolean;
  };
  linkedin: {
    clientId: string | undefined;
    clientSecret: string | undefined;
    redirectUri: string | undefined;
    accessToken: string | undefined;
    apiVersion: string;
    mockEnabled: boolean;
  };
  schedule: {
    timezone: string;
  };
  dryRun: boolean;
  postsPerDay: number;
  maxPostsPerDay: number;
  maxAiRequestsPerRun: number;
  paths: {
    root: string;
    dataDir: string;
    postsFile: string;
    topicsFile: string;
    runsFile: string;
    strategyFile: string;
  };
  strategy: ContentStrategy;
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

function readInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function loadStrategy(strategyFile: string): ContentStrategy {
  let raw: string;
  try {
    raw = readFileSync(strategyFile, 'utf-8');
  } catch (error) {
    throw new Error(
      `ERROR: Could not read content strategy file at ${strategyFile}. ` +
        `Did you delete config/content-strategy.json? (${(error as Error).message})`,
    );
  }
  try {
    return JSON.parse(raw) as ContentStrategy;
  } catch (error) {
    throw new Error(
      `ERROR: config/content-strategy.json is not valid JSON. (${(error as Error).message})`,
    );
  }
}

let cachedConfig: AppConfig | undefined;

/**
 * Loads and validates application configuration from environment variables
 * and the content strategy file. Throws a descriptive error and refuses to
 * continue if required configuration is missing (see SPEC section 70).
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const env = process.env;
  const dataDir = path.join(PROJECT_ROOT, 'data');
  const strategyFile = path.join(PROJECT_ROOT, 'config', 'content-strategy.json');

  const geminiMockEnabled = readBool(env.MOCK_GEMINI, false);
  const linkedinMockEnabled = readBool(env.MOCK_LINKEDIN, false);

  const config: AppConfig = {
    nodeEnv: env.NODE_ENV ?? 'development',
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      imageModel: env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image',
      mockEnabled: geminiMockEnabled,
    },
    linkedin: {
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      redirectUri: env.LINKEDIN_REDIRECT_URI,
      accessToken: env.LINKEDIN_ACCESS_TOKEN,
      apiVersion: env.LINKEDIN_API_VERSION ?? '202609',
      mockEnabled: linkedinMockEnabled,
    },
    schedule: {
      timezone: env.POST_TIMEZONE ?? 'America/Toronto',
    },
    dryRun: readBool(env.DRY_RUN, true),
    postsPerDay: readInt(env.POSTS_PER_DAY, 1),
    maxPostsPerDay: readInt(env.MAX_POSTS_PER_DAY, 1),
    maxAiRequestsPerRun: readInt(env.MAX_AI_REQUESTS_PER_RUN, 3),
    paths: {
      root: PROJECT_ROOT,
      dataDir,
      postsFile: path.join(dataDir, 'posts.json'),
      topicsFile: path.join(dataDir, 'topics.json'),
      runsFile: path.join(dataDir, 'runs.json'),
      strategyFile,
    },
    strategy: loadStrategy(strategyFile),
  };

  validateConfig(config);

  cachedConfig = config;
  return config;
}

/** Validates required configuration and fails fast with clear errors. */
export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  if (!config.gemini.mockEnabled && !config.gemini.apiKey) {
    errors.push(
      'GEMINI_API_KEY is missing. Set it in .env (local) or as a GitHub secret (CI), ' +
        'or set MOCK_GEMINI=true for local development without an API key.',
    );
  }

  if (!config.linkedin.mockEnabled && !config.dryRun) {
    if (!config.linkedin.accessToken) {
      errors.push(
        'LINKEDIN_ACCESS_TOKEN is missing. Run `npm run linkedin:auth` once to obtain it, ' +
          'then store it as a GitHub secret, or keep DRY_RUN=true / MOCK_LINKEDIN=true for testing.',
      );
    }
  }

  if (config.strategy.hashtags.minimum > config.strategy.hashtags.maximum) {
    errors.push('content-strategy.json: hashtags.minimum cannot be greater than hashtags.maximum.');
  }

  if (config.strategy.quality.minLength >= config.strategy.quality.maxLength) {
    errors.push('content-strategy.json: quality.minLength must be less than quality.maxLength.');
  }

  if (errors.length > 0) {
    const formatted = errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(`ERROR: Invalid configuration:\n${formatted}`);
  }
}

/** Test-only helper to reset the cached config between test cases. */
export function resetConfigCache(): void {
  cachedConfig = undefined;
}
