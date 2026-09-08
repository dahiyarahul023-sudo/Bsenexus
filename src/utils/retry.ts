export interface RetryOptions {
  maxRetries?: number;
  delays?: number[];
  onRetry?: (error: any, attempt: number) => void;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed';

export interface SyncStatusDetail {
  status: SyncStatus;
  message?: string;
  timestamp: number;
}

const SYNC_EVENT_NAME = 'bse_sync_status';

/**
 * Dispatches a global sync status event and optionally sends failure logs to the backend.
 */
export function reportSyncStatus(status: SyncStatus, message?: string) {
  if (typeof window === 'undefined') return;

  const detail: SyncStatusDetail = {
    status,
    message,
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail }));

  if (status === 'failed' && message) {
    // Send background report to backend Admin Diagnostics
    fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'ERROR',
        module: 'SYNC',
        message: `Frontend sync failure: ${message}`,
      }),
    }).catch(() => {});
  }
}

/**
 * Subscribes to global sync status changes.
 */
export function onSyncStatusChange(callback: (detail: SyncStatusDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<SyncStatusDetail>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(SYNC_EVENT_NAME, handler);
  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handler);
  };
}

/**
 * Retries an async operation with 2 retries (700ms -> 1500ms backoff).
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
