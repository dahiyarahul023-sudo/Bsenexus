import fetch from 'node-fetch';
import { addLog } from '../database/logDao.js';
import { circuitRegistry } from '../utils/circuitBreaker.js';

export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'bsenexus7f92a14bc0894d35e12f9b';
export const INDEXNOW_HOST = 'bsenexus.in';
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;

// Register circuit breaker for IndexNow search engine submissions
export const indexNowCircuit = circuitRegistry.getOrCreate('INDEXNOW_API', {
  failureThreshold: 3,
  timeoutMs: 8000,
  resetTimeoutMs: 60000
});

class IndexNowQueue {
  private queue = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private lastSubmissionTime = 0;
  private totalSubmitted = 0;
  private totalSuccess = 0;
  private totalFailures = 0;

  constructor() {
    // Periodic flush every 2 minutes if items exist in queue
    const interval = setInterval(() => {
      if (this.queue.size > 0 && !this.isProcessing) {
        this.flush().catch((err) => {
          console.warn('[IndexNow] Periodic flush error:', err?.message || err);
        });
      }
    }, 2 * 60 * 1000);
    if (interval.unref) interval.unref();
  }

  /**
   * Queue URLs for IndexNow submission
   */
  public enqueue(urls: string | string[]): void {
    const list = Array.isArray(urls) ? urls : [urls];
    for (const u of list) {
      if (u && typeof u === 'string' && u.startsWith('http')) {
        this.queue.add(u.trim());
      }
    }

    // If queue has reached batch size (e.g. 20) or after debounce delay, trigger flush
    if (this.queue.size >= 20 && !this.isProcessing) {
      this.flush().catch(() => {});
    } else if (!this.timer && !this.isProcessing) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush().catch(() => {});
      }, 30 * 1000); // 30s debounce
      if (this.timer.unref) this.timer.unref();
    }
  }

  /**
   * Immediately flush queued URLs to IndexNow API (Bing, Yandex, Seznam, Naver)
   */
  public async flush(): Promise<{ success: boolean; submittedCount: number; error?: string }> {
    if (this.isProcessing || this.queue.size === 0) {
      return { success: true, submittedCount: 0 };
    }

    this.isProcessing = true;
    const urlList = Array.from(this.queue).slice(0, 100); // Max 100 per batch
    for (const u of urlList) {
      this.queue.delete(u);
    }

    try {
      const payload = {
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: INDEXNOW_KEY_LOCATION,
        urlList
      };

      const result = await indexNowCircuit.execute(
        async () => {
          // Send to standard IndexNow endpoint (which propagates to Bing and Yandex)
          const response = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'User-Agent': 'BSE-Nexus-IndexNow-Bot/1.0'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(7000)
          });

          // HTTP 200: OK
          // HTTP 202: Accepted
          if (response.status !== 200 && response.status !== 202) {
            const body = await response.text().catch(() => '');
            throw new Error(`IndexNow returned HTTP ${response.status}: ${body.slice(0, 100)}`);
          }

          return true;
        },
        async () => {
          // Fallback if circuit is open
          console.warn('[IndexNow] Circuit breaker active; queue will retry later');
          return false;
        }
      );

      this.lastSubmissionTime = Date.now();
      this.totalSubmitted += urlList.length;

      if (result) {
        this.totalSuccess++;
        addLog('INFO', 'SEO', `IndexNow: Successfully submitted ${urlList.length} URL(s) to Bing/Yandex search engines`).catch(() => {});
      } else {
        this.totalFailures++;
        // Re-queue items if failed
        for (const u of urlList) {
          this.queue.add(u);
        }
      }

      return { success: Boolean(result), submittedCount: urlList.length };
    } catch (err: any) {
      this.totalFailures++;
      console.warn('[IndexNow] Submission error:', err?.message || err);
      // Re-queue items for later
      for (const u of urlList) {
        this.queue.add(u);
      }
      return { success: false, submittedCount: 0, error: err?.message || 'Unknown submission error' };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Diagnostic statistics
   */
  public getStats() {
    return {
      pendingQueueSize: this.queue.size,
      totalSubmittedUrls: this.totalSubmitted,
      successfulBatches: this.totalSuccess,
      failedBatches: this.totalFailures,
      lastSubmissionTime: this.lastSubmissionTime,
      circuitStatus: indexNowCircuit.getStatus()
    };
  }
}

export const indexNowQueue = new IndexNowQueue();

/**
 * Public helper to enqueue newly published announcement or page URLs
 */
export function notifySearchEnginesOfNewPages(urls: string | string[]): void {
  indexNowQueue.enqueue(urls);
}
