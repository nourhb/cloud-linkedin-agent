import { logger } from './logger.js';

export interface RetryOptions {
  /** Maximum number of attempts (including the first). */
  attempts?: number;
  /** Delay in ms before each retry, indexed by attempt number (0-based). Last value repeats if attempts exceed the array length. */
  delaysMs?: number[];
  /** Returns false to stop retrying immediately (e.g. permanent auth errors, SPEC section 33). */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry attempt, useful for logging. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_DELAYS_MS = [5_000, 15_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying on failure with backoff delays. Does not retry when
 * `isRetryable` returns false (e.g. permanent authentication errors -
 * SPEC section 33: "Do not retry permanent authentication errors indefinitely").
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const isRetryable = options.isRetryable ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }
      const delayMs = delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 5_000;
      options.onRetry?.(error, attempt, delayMs);
      logger.warn('Retrying after failure', {
        attempt,
        maxAttempts: attempts,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(delayMs);
    }
  }
  // Unreachable, but keeps TypeScript's control-flow analysis happy.
  throw lastError;
}
