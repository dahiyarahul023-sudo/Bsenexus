import { addLog } from '../database/logDao.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;       // Number of consecutive failures before opening (default: 4)
  timeoutMs?: number;              // Execution timeout in ms (default: 8000)
  resetTimeoutMs?: number;         // Time to wait in OPEN before attempting HALF_OPEN (default: 30000)
  halfOpenSuccessThreshold?: number; // Successful requests in HALF_OPEN to close circuit (default: 2)
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

export interface CircuitBreakerStatus {
  name: string;
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  failureThreshold: number;
  timeoutMs: number;
  resetTimeoutMs: number;
  lastFailureTime: number | null;
  lastStateChange: number;
  totalCalls: number;
  totalSuccesses: number;
  totalFailures: number;
  totalRejections: number;
  totalTimeouts: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly breakerName: string, public readonly cooldownRemainingMs: number) {
    super(`Circuit breaker '${breakerName}' is OPEN (cooling down for ${Math.round(cooldownRemainingMs / 1000)}s). Requests fast-failed to protect resources.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(public readonly breakerName: string, public readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms in circuit breaker '${breakerName}'.`);
    this.name = 'CircuitBreakerTimeoutError';
  }
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number = Date.now();
  
  private totalCalls = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalRejections = 0;
  private totalTimeouts = 0;

  public readonly failureThreshold: number;
  public readonly timeoutMs: number;
  public readonly resetTimeoutMs: number;
  public readonly halfOpenSuccessThreshold: number;
  private onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 4;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 2;
    this.onStateChange = options.onStateChange;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN' && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN', 'Cooldown elapsed, probing service recovery');
      }
    }
    return this.state;
  }

  private transitionTo(newState: CircuitState, reason: string): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === 'HALF_OPEN') {
      this.consecutiveSuccesses = 0;
    } else if (newState === 'CLOSED') {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
    }

    // Notify listeners & log state transition
    if (this.onStateChange) {
      try {
        this.onStateChange(oldState, newState, this.name);
      } catch {
        // Safe swallow
      }
    }

    const logLevel = newState === 'OPEN' ? 'WARNING' : 'INFO';
    addLog(
      logLevel,
      'CIRCUIT_BREAKER',
      `[${this.name}] State changed: ${oldState} ➔ ${newState} (${reason})`
    ).catch(() => {});
  }

  public async execute<T>(
    action: (signal?: AbortSignal) => Promise<T>,
    fallback?: (err: Error) => Promise<T> | T,
    customTimeoutMs?: number
  ): Promise<T> {
    this.totalCalls++;
    const currentState = this.getState();

    // 1. Fast-Fail if OPEN
    if (currentState === 'OPEN') {
      this.totalRejections++;
      const remainingCooldown = Math.max(0, this.resetTimeoutMs - (Date.now() - (this.lastFailureTime || 0)));
      const openErr = new CircuitBreakerOpenError(this.name, remainingCooldown);

      if (fallback) {
        return fallback(openErr);
      }
      throw openErr;
    }

    // 2. Execute with strict timeout protection
    const effectiveTimeout = customTimeoutMs || this.timeoutMs;
    const controller = new AbortController();
    let timeoutHandle: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        this.totalTimeouts++;
        reject(new CircuitBreakerTimeoutError(this.name, effectiveTimeout));
      }, effectiveTimeout);
    });

    try {
      const result = await Promise.race([
        action(controller.signal),
        timeoutPromise
      ]);

      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.handleSuccess();
      return result;
    } catch (err: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const executionError = err instanceof Error ? err : new Error(String(err));
      this.handleFailure(executionError);

      if (fallback) {
        return fallback(executionError);
      }
      throw executionError;
    }
  }

  private handleSuccess(): void {
    this.totalSuccesses++;
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED', `Probe requests succeeded (${this.consecutiveSuccesses}/${this.halfOpenSuccessThreshold})`);
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  private handleFailure(error: Error): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // In HALF_OPEN, a single failure trips immediately back to OPEN
      this.transitionTo('OPEN', `Probe request failed during recovery check: ${error.message}`);
    } else if (this.state === 'CLOSED' && this.consecutiveFailures >= this.failureThreshold) {
      this.transitionTo('OPEN', `Consecutive failure threshold reached (${this.consecutiveFailures}/${this.failureThreshold}): ${error.message}`);
    }
  }

  public getStatus(): CircuitBreakerStatus {
    // Calling getState() will automatically evaluate cooldown if expired
    const state = this.getState();
    return {
      name: this.name,
      state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      failureThreshold: this.failureThreshold,
      timeoutMs: this.timeoutMs,
      resetTimeoutMs: this.resetTimeoutMs,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalCalls: this.totalCalls,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      totalRejections: this.totalRejections,
      totalTimeouts: this.totalTimeouts
    };
  }

  public reset(): void {
    this.transitionTo('CLOSED', 'Manual admin reset');
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = null;
  }

  public trip(): void {
    this.transitionTo('OPEN', 'Manual trip triggered');
    this.lastFailureTime = Date.now();
  }
}

// Global registry for standard external services
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  public getOrCreate(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  public get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  public getAllStatuses(): CircuitBreakerStatus[] {
    return Array.from(this.breakers.values()).map(b => b.getStatus());
  }

  public resetAll(): void {
    for (const b of this.breakers.values()) {
      b.reset();
    }
  }
}

export const circuitRegistry = new CircuitBreakerRegistry();

// Standard singleton circuit breakers for key external services:
export const bseCircuitBreaker = circuitRegistry.getOrCreate('BSE_API', {
  failureThreshold: 4,
  timeoutMs: 9000,
  resetTimeoutMs: 25000,
  halfOpenSuccessThreshold: 2
});

export const telegramCircuitBreaker = circuitRegistry.getOrCreate('TELEGRAM_API', {
  failureThreshold: 3,
  timeoutMs: 6000,
  resetTimeoutMs: 20000,
  halfOpenSuccessThreshold: 2
});

export const geminiCircuitBreaker = circuitRegistry.getOrCreate('GEMINI_API', {
  failureThreshold: 3,
  timeoutMs: 15000,
  resetTimeoutMs: 30000,
  halfOpenSuccessThreshold: 1
});

export const externalFeedsCircuitBreaker = circuitRegistry.getOrCreate('EXTERNAL_FEEDS', {
  failureThreshold: 3,
  timeoutMs: 7000,
  resetTimeoutMs: 30000,
  halfOpenSuccessThreshold: 2
});
