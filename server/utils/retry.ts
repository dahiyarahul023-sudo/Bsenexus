import { isQuotaError, setFirestoreQuotaExceeded, isPermissionDeniedError, setAdminPermissionDenied, isNotFoundError } from '../database/localStore.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  delays?: number[];
  onRetry?: (error: any, attempt: number) => void;
}

/**
 * Executes an async function with retry logic.
 * Default: 2 retries with delays of 700ms and 1500ms (~2.2s total wait window).
 * CRITICAL FIX: If quota or permission denied error is encountered, immediately bails out without repeating doomed retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const delays = options.delays || [700, 1500];
  const maxAttempts = delays.length + 1;

  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      // If this is a Firestore Quota / Rate-limit exhaustion, do NOT retry.
      if (isQuotaError(err)) {
        setFirestoreQuotaExceeded(true);
        throw err;
      }

      // If this is a missing/denied Service Account IAM permission, do NOT retry.
      if (isPermissionDeniedError(err)) {
        setAdminPermissionDenied(true);
        throw err;
      }

      // If document or database is not found, bail out immediately without repeating doomed retries.
      if (isNotFoundError(err)) {
        throw err;
      }

      if (attempt < maxAttempts) {
        const delayMs = delays[attempt - 1];
        if (options.onRetry) {
          options.onRetry(err, attempt);
        }
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  throw lastError;
}
