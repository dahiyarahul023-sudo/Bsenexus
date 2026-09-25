import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CircuitBreaker, CircuitBreakerOpenError, CircuitBreakerTimeoutError } from '../utils/circuitBreaker.js';

describe('Circuit Breaker Resilience Tests', () => {
  test('Executes normally and maintains CLOSED state on success', async () => {
    const breaker = new CircuitBreaker('TEST_SUCCESS', { failureThreshold: 3, timeoutMs: 1000 });
    
    const result = await breaker.execute(async () => 'hello world');
    assert.strictEqual(result, 'hello world');
    assert.strictEqual(breaker.getState(), 'CLOSED');
    
    const status = breaker.getStatus();
    assert.strictEqual(status.totalCalls, 1);
    assert.strictEqual(status.totalSuccesses, 1);
    assert.strictEqual(status.totalFailures, 0);
  });

  test('Trips to OPEN after consecutive failures and fast-fails', async () => {
    const breaker = new CircuitBreaker('TEST_TRIP', { 
      failureThreshold: 2, 
      resetTimeoutMs: 500,
      timeoutMs: 1000 
    });

    let attempts = 0;
    const failingAction = async () => {
      attempts++;
      throw new Error('Upstream 503 Service Unavailable');
    };

    // First failure
    await assert.rejects(async () => {
      await breaker.execute(failingAction);
    }, /Upstream 503/);
    assert.strictEqual(breaker.getState(), 'CLOSED');
    assert.strictEqual(attempts, 1);

    // Second failure -> Trips to OPEN
    await assert.rejects(async () => {
      await breaker.execute(failingAction);
    }, /Upstream 503/);
    assert.strictEqual(breaker.getState(), 'OPEN');
    assert.strictEqual(attempts, 2);

    // Third call: Circuit is OPEN -> Should fast-fail IMMEDIATELY without calling failingAction!
    await assert.rejects(async () => {
      await breaker.execute(failingAction);
    }, (err: any) => {
      assert.ok(err instanceof CircuitBreakerOpenError);
      assert.strictEqual(err.breakerName, 'TEST_TRIP');
      return true;
    });

    // Failing action should NOT have been invoked on 3rd call
    assert.strictEqual(attempts, 2, 'Action was not executed because circuit was OPEN');
    assert.strictEqual(breaker.getStatus().totalRejections, 1);
  });

  test('Graceful fallback works on failure and when OPEN', async () => {
    const breaker = new CircuitBreaker('TEST_FALLBACK', { 
      failureThreshold: 1, 
      resetTimeoutMs: 10000,
      timeoutMs: 1000 
    });

    // 1. Fallback returned on failure
    const fallbackResult = await breaker.execute(
      async () => { throw new Error('Down'); },
      (err) => ({ fallback: true, message: err.message })
    );

    assert.deepStrictEqual(fallbackResult, { fallback: true, message: 'Down' });
    assert.strictEqual(breaker.getState(), 'OPEN');

    // 2. Fallback returned fast when OPEN without running action
    let executed = false;
    const secondResult = await breaker.execute<any>(
      async () => { executed = true; return 'real'; },
      () => ({ fallback: true, cached: true })
    );

    assert.strictEqual(executed, false, 'Underlying action skipped');
    assert.deepStrictEqual(secondResult, { fallback: true, cached: true });
  });

  test('Recovers from OPEN to HALF_OPEN to CLOSED after cooldown and successful probes', async () => {
    const breaker = new CircuitBreaker('TEST_RECOVERY', {
      failureThreshold: 1,
      resetTimeoutMs: 50, // Short cooldown for testing
      halfOpenSuccessThreshold: 2,
      timeoutMs: 1000
    });

    // Trip the circuit
    await assert.rejects(async () => {
      await breaker.execute(async () => { throw new Error('Fail'); });
    });
    assert.strictEqual(breaker.getState(), 'OPEN');

    // Wait for cooldown to elapse
    await new Promise(r => setTimeout(r, 65));
    assert.strictEqual(breaker.getState(), 'HALF_OPEN');

    // Probe 1 in HALF_OPEN
    const p1 = await breaker.execute(async () => 'probe 1 success');
    assert.strictEqual(p1, 'probe 1 success');
    assert.strictEqual(breaker.getState(), 'HALF_OPEN');

    // Probe 2 in HALF_OPEN -> Closes the circuit!
    const p2 = await breaker.execute(async () => 'probe 2 success');
    assert.strictEqual(p2, 'probe 2 success');
    assert.strictEqual(breaker.getState(), 'CLOSED');
  });

  test('Times out slow external dependencies and records timeout error', async () => {
    const breaker = new CircuitBreaker('TEST_TIMEOUT', {
      failureThreshold: 2,
      timeoutMs: 50 // Fast 50ms timeout
    });

    await assert.rejects(async () => {
      await breaker.execute(async () => {
        await new Promise(r => setTimeout(r, 200)); // Hangs for 200ms
        return 'too late';
      });
    }, (err: any) => {
      assert.ok(err instanceof CircuitBreakerTimeoutError);
      return true;
    });

    assert.strictEqual(breaker.getStatus().totalTimeouts, 1);
  });
});
