import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  getAccountKey,
  checkAccountProtection,
  recordFailedAttempt,
  resetAccountProtection,
  getSanitizedClientIp,
  simulateCredentialVerificationDelay,
  getAccountProtectionConfig
} from '../security/accountRateLimiter.js';

describe('Per-Account Rate Limiting & Protection Suite', () => {
  const config = getAccountProtectionConfig();

  // Test 1: Keyed one-way hashing & privacy preservation
  test('Account key is a one-way keyed HMAC hash and never exposes raw email', () => {
    const email1 = 'Target.User@Example.com';
    const email2 = 'target.user@example.com ';
    const key1 = getAccountKey(email1);
    const key2 = getAccountKey(email2);

    // Case and whitespace insensitivity
    assert.strictEqual(key1, key2, 'Normalized emails must produce the identical keyed hash');

    // Key must be a 64-char hex string (SHA-256)
    assert.strictEqual(key1.length, 64, 'Key must be a 64-character hex hash');
    assert.ok(/^[0-9a-f]{64}$/.test(key1), 'Key must be hexadecimal');

    // Never contain raw email or parts of it
    assert.ok(!key1.includes('target'), 'Key must never contain raw user identifier');
    assert.ok(!key1.includes('example.com'), 'Key must never contain raw domain');
  });

  // Test 2: One account attacked from multiple IPs
  test('One account targeted from multiple IPs gets protected and locked', async () => {
    const targetEmail = `victim_${Date.now()}@corporate.org`;
    const accountKey = getAccountKey(targetEmail);

    // Initial state: 0 attempts, allowed
    const initialCheck = await checkAccountProtection(accountKey);
    assert.strictEqual(initialCheck.allowed, true);
    assert.strictEqual(initialCheck.failedAttempts, 0);

    // Simulate 5 failed login attempts from 5 completely different IP addresses
    const attackerIps = [
      '198.51.100.1',
      '198.51.100.2',
      '203.0.113.45',
      '192.0.2.88',
      '185.220.101.5'
    ];

    let lastResult = null;
    for (let i = 0; i < attackerIps.length; i++) {
      lastResult = await recordFailedAttempt(accountKey, {
        ip: attackerIps[i],
        customMaxAttempts: 5,
        customLockoutSec: 60
      });
    }

    // After 5 attempts, account should be locked regardless of IP diversity
    assert.ok(lastResult !== null);
    assert.strictEqual(lastResult.locked, true, 'Account should lock after reaching maxAttempts from distributed IPs');
    assert.ok(lastResult.remainingLockoutSec > 0, 'Remaining lockout seconds must be greater than 0');

    // A 6th request from yet another IP must be rejected immediately
    const checkFromNewIp = await checkAccountProtection(accountKey);
    assert.strictEqual(checkFromNewIp.allowed, false, 'Subsequent attempts from any IP must be blocked during lockout');
    assert.strictEqual(checkFromNewIp.isLocked, true);
    assert.ok(checkFromNewIp.remainingLockoutSec > 0);
  });

  // Test 3: Many accounts attempted from one IP (Credential Stuffing Isolation)
  test('Many accounts targeted from one IP do not cross-pollute lockout states', async () => {
    const singleAttackerIp = '45.33.32.156';
    const accountA = getAccountKey(`user_alpha_${Date.now()}@domain.com`);
    const accountB = getAccountKey(`user_beta_${Date.now()}@domain.com`);
    const accountC = getAccountKey(`user_gamma_${Date.now()}@domain.com`);

    // Attacker fails 2 attempts against Account A
    await recordFailedAttempt(accountA, { ip: singleAttackerIp, customMaxAttempts: 5 });
    await recordFailedAttempt(accountA, { ip: singleAttackerIp, customMaxAttempts: 5 });

    const statusA = await checkAccountProtection(accountA);
    const statusB = await checkAccountProtection(accountB);
    const statusC = await checkAccountProtection(accountC);

    // Account A has 2 failed attempts and progressive delay
    assert.strictEqual(statusA.failedAttempts, 2);
    assert.ok(statusA.delayMs > 0, 'Account A should incur progressive delay');

    // Accounts B and C must remain completely clean and unaffected
    assert.strictEqual(statusB.failedAttempts, 0, 'Account B must not inherit Account A failed attempts');
    assert.strictEqual(statusB.allowed, true);
    assert.strictEqual(statusB.delayMs, 0);

    assert.strictEqual(statusC.failedAttempts, 0, 'Account C must not inherit Account A failed attempts');
    assert.strictEqual(statusC.allowed, true);
    assert.strictEqual(statusC.delayMs, 0);
  });

  // Test 4: Successful login resets counter safely
  test('Successful authentication resets failed attempts counter and progressive delay', async () => {
    const userEmail = `legit_user_${Date.now()}@gmail.com`;
    const accountKey = getAccountKey(userEmail);

    // Simulate 3 mistyped passwords
    await recordFailedAttempt(accountKey, { customMaxAttempts: 5 });
    await recordFailedAttempt(accountKey, { customMaxAttempts: 5 });
    await recordFailedAttempt(accountKey, { customMaxAttempts: 5 });

    let status = await checkAccountProtection(accountKey);
    assert.strictEqual(status.failedAttempts, 3);
    assert.strictEqual(status.allowed, true);
    assert.ok(status.delayMs >= 1000, 'Delay should be at least 1s after 3 attempts');

    // User remembers password and logs in successfully
    await resetAccountProtection(accountKey);

    // State must be completely reset
    status = await checkAccountProtection(accountKey);
    assert.strictEqual(status.failedAttempts, 0, 'Counter must reset to 0 upon successful login');
    assert.strictEqual(status.isLocked, false);
    assert.strictEqual(status.delayMs, 0, 'Progressive delay must reset to 0');
    assert.strictEqual(status.allowed, true);
  });

  // Test 5: Lock expiry allows login attempts after lockout window
  test('Lockout expires automatically after configured window duration', async () => {
    const userEmail = `locked_user_${Date.now()}@gmail.com`;
    const accountKey = getAccountKey(userEmail);

    // Lock account with a very short custom lockout (1 second) for fast, reliable testing
    for (let i = 0; i < 3; i++) {
      await recordFailedAttempt(accountKey, {
        customMaxAttempts: 3,
        customLockoutSec: 1
      });
    }

    // Immediate check: account is locked
    const lockedStatus = await checkAccountProtection(accountKey);
    assert.strictEqual(lockedStatus.allowed, false, 'Account must be locked immediately after max attempts');
    assert.strictEqual(lockedStatus.isLocked, true);

    // Wait 1.1s for lock expiry
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Post-expiry check: account should automatically allow attempts again
    const expiredStatus = await checkAccountProtection(accountKey);
    assert.strictEqual(expiredStatus.allowed, true, 'Account should be allowed again after lockout window expires');
    assert.strictEqual(expiredStatus.isLocked, false);
    assert.strictEqual(expiredStatus.remainingLockoutSec, 0);
  });

  // Test 6: Nonexistent account enumeration resistance & constant-time delay simulation
  test('Nonexistent account does not disclose presence and executes timing normalization', async () => {
    const nonexistentEmail = `does_not_exist_${Date.now()}@ghostdomain.invalid`;
    const existingEmail = 'dahiyarahul023@gmail.com';

    const nonExistentKey = getAccountKey(nonexistentEmail);
    const existingKey = getAccountKey(existingEmail);

    // Both generate identical-format opaque HMAC keys
    assert.strictEqual(nonExistentKey.length, 64);
    assert.strictEqual(existingKey.length, 64);

    // Both can be checked without error
    const nonExistentStatus = await checkAccountProtection(nonExistentKey);
    const existingStatus = await checkAccountProtection(existingKey);

    assert.strictEqual(nonExistentStatus.allowed, true);
    assert.strictEqual(existingStatus.allowed, true);

    // Timing delay simulation runs within bounded window (80ms - 250ms)
    const startTime = Date.now();
    await simulateCredentialVerificationDelay();
    const elapsed = Date.now() - startTime;

    assert.ok(elapsed >= 70, `Timing simulation should take at least ~70ms, was ${elapsed}ms`);
    assert.ok(elapsed <= 400, `Timing simulation should not exceed 400ms, was ${elapsed}ms`);
  });

  // Test 7: Client IP sanitization and proxy header safety
  test('Client IP extraction respects trusted proxy settings without blindly accepting client headers', () => {
    // 1. Direct connection with standard req.ip
    const req1 = { ip: '203.0.113.195', headers: {} } as any;
    assert.strictEqual(getSanitizedClientIp(req1), '203.0.113.195');

    // 2. Proxied connection with x-forwarded-for chain
    const req2 = {
      ip: '10.0.0.1', // Reverse proxy container internal IP
      headers: {
        'x-forwarded-for': '198.51.100.77, 10.0.0.1, 10.0.0.2'
      }
    } as any;
    assert.strictEqual(getSanitizedClientIp(req2), '198.51.100.77');

    // 3. IPv6 localhost mapping
    const req3 = { ip: '::ffff:127.0.0.1', headers: {} } as any;
    assert.strictEqual(getSanitizedClientIp(req3), '127.0.0.1');

    // 4. Malformed/empty headers fallback
    const req4 = { ip: undefined, headers: {} } as any;
    assert.strictEqual(getSanitizedClientIp(req4), 'unknown');
  });
});
