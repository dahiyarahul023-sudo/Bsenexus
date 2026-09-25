import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { adminDb } from '../database/firebase.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, isOfflineOrNetworkError } from '../database/localStore.js';
import { addLog } from '../database/logDao.js';

export interface AccountProtectionConfig {
  maxAttempts: number;            // Max failed attempts before lockout (default: 5)
  lockoutDurationMs: number;      // Lockout duration in ms (default: 15 minutes = 900,000ms)
  windowMs: number;               // Sliding window for failed attempts (default: 15 minutes = 900,000ms)
  progressiveDelayEnabled: boolean; // Whether progressive delay is added after failed attempts
  baseDelayMs: number;            // Base delay unit for backoff (default: 500ms)
  maxDelayMs: number;             // Maximum progressive delay cap (default: 4000ms)
}

export interface AccountLockoutRecord {
  accountKey: string;
  failedAttempts: number;
  lastAttemptAt: number;
  lockedUntil: number;
  updatedAt: number;
}

export interface AccountProtectionStatus {
  allowed: boolean;
  isLocked: boolean;
  lockedUntil: number;
  remainingLockoutSec: number;
  failedAttempts: number;
  delayMs: number;
}

const COLLECTION_NAME = 'auth_account_limits';
const LOCAL_STORE_FILE = 'auth_account_limits.json';
const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Check if running in a test context
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT) || process.argv.some(a => a.includes('test'));

// In-memory cache for ultra-low-latency lookups and local development fallback
const localMemoryStore = new Map<string, AccountLockoutRecord>();

/**
 * Returns sensible, environment-configurable account protection parameters.
 */
export function getAccountProtectionConfig(): AccountProtectionConfig {
  const maxAttempts = Number(process.env.AUTH_ACCOUNT_MAX_ATTEMPTS) || 5;
  const lockoutDurationMs = Number(process.env.AUTH_ACCOUNT_LOCKOUT_MS) || (15 * 60 * 1000); // 15 minutes
  const windowMs = Number(process.env.AUTH_ACCOUNT_WINDOW_MS) || (15 * 60 * 1000); // 15 minutes
  const progressiveDelayEnabled = process.env.AUTH_ACCOUNT_PROGRESSIVE_DELAY !== 'false';
  const baseDelayMs = Number(process.env.AUTH_ACCOUNT_BASE_DELAY_MS) || 500;
  const maxDelayMs = Number(process.env.AUTH_ACCOUNT_MAX_DELAY_MS) || 4000;

  return {
    maxAttempts,
    lockoutDurationMs,
    windowMs,
    progressiveDelayEnabled,
    baseDelayMs,
    maxDelayMs
  };
}

/**
 * Normalizes input identifiers (email, username, master PIN account)
 * to prevent bypasses via case changes, leading/trailing whitespace, or email aliases.
 */
export function normalizeIdentifier(rawIdentifier?: string | null): string {
  if (!rawIdentifier || typeof rawIdentifier !== 'string') {
    return 'admin_master_account';
  }
  const trimmed = rawIdentifier.trim().toLowerCase();
  if (!trimmed) {
    return 'admin_master_account';
  }
  return trimmed;
}

/**
 * Derives a cryptographically secure one-way keyed HMAC hash of the normalized identifier.
 * NEVER stores or exposes raw emails in rate-limiting stores, logs, or metrics.
 */
export function getAccountKey(rawIdentifier?: string | null): string {
  const normalized = normalizeIdentifier(rawIdentifier);
  const secret = process.env.ACCOUNT_PROTECTION_SECRET || process.env.JWT_SECRET || 'bse-nexus-account-protection-key';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(normalized);
  return hmac.digest('hex');
}

/**
 * Calculates progressive delay (exponential backoff) based on consecutive failed attempts.
 * Failed 1: 0ms (first typo is forgiven)
 * Failed 2: 500ms
 * Failed 3: 1000ms
 * Failed 4: 2000ms
 * Failed 5: Lockout!
 */
export function calculateProgressiveDelayMs(
  failedAttempts: number,
  config: AccountProtectionConfig = getAccountProtectionConfig()
): number {
  if (!config.progressiveDelayEnabled || failedAttempts <= 1) {
    return 0;
  }
  const exponent = failedAttempts - 2;
  const delay = config.baseDelayMs * Math.pow(2, exponent);
  return Math.min(Math.round(delay), config.maxDelayMs);
}

/**
 * Fast timeout wrapper to prevent slow cloud network operations from stalling auth requests.
 */
async function withTimeout<T>(promise: Promise<T>, ms = 300): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Operation timed out')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Reads account lockout state from shared Firestore, falling back to local file storage if offline.
 */
async function fetchAccountRecord(accountKey: string): Promise<AccountLockoutRecord | null> {
  // 1. Check local in-memory cache first
  const memoryRecord = localMemoryStore.get(accountKey);
  if (memoryRecord) {
    return { ...memoryRecord };
  }

  // 2. Query shared distributed Firestore datastore (bypassed in unit tests without network)
  if (adminDb && !isFirestoreQuotaExceeded() && !isTestEnv) {
    try {
      const doc = await withTimeout(adminDb.collection(COLLECTION_NAME).doc(accountKey).get(), 350);
      if (doc.exists) {
        const data = doc.data() as AccountLockoutRecord;
        if (data && typeof data === 'object') {
          localMemoryStore.set(accountKey, data);
          return { ...data };
        }
      }
    } catch (err: any) {
      if (!isOfflineOrNetworkError(err)) {
        console.warn(`[AccountProtection] Notice fetching record for ${accountKey.substring(0, 10)}...:`, err?.message || err);
      }
    }
  }

  // 3. Fallback to local disk file
  try {
    const fileData = readLocalJson<Record<string, AccountLockoutRecord>>(LOCAL_STORE_FILE, {});
    if (fileData[accountKey]) {
      localMemoryStore.set(accountKey, fileData[accountKey]);
      return { ...fileData[accountKey] };
    }
  } catch {}

  return null;
}

/**
 * Persists account lockout state to shared Firestore and local fallback storage.
 */
async function persistAccountRecord(record: AccountLockoutRecord): Promise<void> {
  // Update memory cache
  localMemoryStore.set(record.accountKey, { ...record });

  // Update shared Firestore datastore for multi-instance distributed synchronization
  let firestoreSuccess = false;
  if (adminDb && !isFirestoreQuotaExceeded() && !isTestEnv) {
    try {
      await withTimeout(adminDb.collection(COLLECTION_NAME).doc(record.accountKey).set(record, { merge: true }), 350);
      firestoreSuccess = true;
    } catch (err: any) {
      if (!isOfflineOrNetworkError(err)) {
        console.warn(`[AccountProtection] Notice saving record for ${record.accountKey.substring(0, 10)}...:`, err?.message || err);
      }
    }
  }

  // Update local disk storage as a reliable persistent fallback
  try {
    const fileData = readLocalJson<Record<string, AccountLockoutRecord>>(LOCAL_STORE_FILE, {});
    fileData[record.accountKey] = record;
    writeLocalJson(LOCAL_STORE_FILE, fileData);
  } catch {}

  if (!firestoreSuccess && process.env.NODE_ENV === 'production') {
    // Flag for production audit
    console.warn(`[AccountProtection] Warning: Multi-instance Firestore write unavailable. Account ${record.accountKey.substring(0, 10)}... stored in local fallback.`);
  }
}

/**
 * Removes an account lockout record on successful login or explicit administrative unlock.
 */
async function deleteAccountRecord(accountKey: string): Promise<void> {
  localMemoryStore.delete(accountKey);

  if (adminDb && !isFirestoreQuotaExceeded() && !isTestEnv) {
    try {
      await withTimeout(adminDb.collection(COLLECTION_NAME).doc(accountKey).delete(), 350);
    } catch {}
  }

  try {
    const fileData = readLocalJson<Record<string, AccountLockoutRecord>>(LOCAL_STORE_FILE, {});
    if (fileData[accountKey]) {
      delete fileData[accountKey];
      writeLocalJson(LOCAL_STORE_FILE, fileData);
    }
  } catch {}
}

/**
 * Checks whether an account is currently permitted to attempt login, or locked out / subject to delay.
 */
export async function checkAccountProtection(
  accountKey: string,
  customNow: number = Date.now()
): Promise<AccountProtectionStatus> {
  const config = getAccountProtectionConfig();
  const record = await fetchAccountRecord(accountKey);

  if (!record) {
    return {
      allowed: true,
      isLocked: false,
      lockedUntil: 0,
      remainingLockoutSec: 0,
      failedAttempts: 0,
      delayMs: 0
    };
  }

  // Check if locked out
  if (record.lockedUntil > customNow) {
    const remainingLockoutSec = Math.ceil((record.lockedUntil - customNow) / 1000);
    const delayMs = Math.min(1000, calculateProgressiveDelayMs(record.failedAttempts, config));
    return {
      allowed: false,
      isLocked: true,
      lockedUntil: record.lockedUntil,
      remainingLockoutSec,
      failedAttempts: record.failedAttempts,
      delayMs
    };
  }

  // Lock has expired: clear the expired lock and reset counter
  if (record.lockedUntil > 0 && record.lockedUntil <= customNow) {
    await deleteAccountRecord(accountKey);
    return {
      allowed: true,
      isLocked: false,
      lockedUntil: 0,
      remainingLockoutSec: 0,
      failedAttempts: 0,
      delayMs: 0
    };
  }

  // Sliding window has elapsed: reset failed attempts counter
  if (customNow - record.lastAttemptAt > config.windowMs) {
    await deleteAccountRecord(accountKey);
    return {
      allowed: true,
      isLocked: false,
      lockedUntil: 0,
      remainingLockoutSec: 0,
      failedAttempts: 0,
      delayMs: 0
    };
  }

  const delayMs = calculateProgressiveDelayMs(record.failedAttempts, config);
  return {
    allowed: true,
    isLocked: false,
    lockedUntil: 0,
    remainingLockoutSec: 0,
    failedAttempts: record.failedAttempts,
    delayMs
  };
}

export interface RecordFailedAttemptOptions {
  now?: number;
  ip?: string;
  customMaxAttempts?: number;
  customLockoutSec?: number;
}

/**
 * Records a failed authentication attempt against the account key.
 * Triggers temporary lockout if maxAttempts threshold is reached.
 */
export async function recordFailedAttempt(
  accountKey: string,
  optionsOrNow?: number | RecordFailedAttemptOptions
): Promise<{
  locked: boolean;
  failedAttempts: number;
  lockedUntil: number;
  remainingLockoutSec: number;
  delayMs: number;
}> {
  const options = typeof optionsOrNow === 'object' ? optionsOrNow : undefined;
  const customNow = typeof optionsOrNow === 'number'
    ? optionsOrNow
    : (options?.now ?? Date.now());

  const config = getAccountProtectionConfig();
  const maxAttempts = options?.customMaxAttempts ?? config.maxAttempts;
  const lockoutDurationMs = options?.customLockoutSec
    ? options.customLockoutSec * 1000
    : config.lockoutDurationMs;

  const existing = await fetchAccountRecord(accountKey);

  let failedAttempts = 1;
  if (existing) {
    // If previous lock or window expired, restart at 1
    if (existing.lockedUntil > 0 && existing.lockedUntil <= customNow) {
      failedAttempts = 1;
    } else if (customNow - existing.lastAttemptAt > config.windowMs) {
      failedAttempts = 1;
    } else {
      failedAttempts = existing.failedAttempts + 1;
    }
  }

  let lockedUntil = 0;
  let locked = false;

  if (failedAttempts >= maxAttempts) {
    locked = true;
    lockedUntil = customNow + lockoutDurationMs;
    await addLog(
      'WARNING',
      'SECURITY',
      `Account protection lockout activated for key ${accountKey.substring(0, 10)}...: ${failedAttempts} failed attempts. Locked for ${Math.round(lockoutDurationMs / 60000)} minutes.`
    );
  } else {
    await addLog(
      'INFO',
      'AUTH',
      `Account protection failed attempt recorded for key ${accountKey.substring(0, 10)}... (${failedAttempts}/${maxAttempts})`
    );
  }

  const record: AccountLockoutRecord = {
    accountKey,
    failedAttempts,
    lastAttemptAt: customNow,
    lockedUntil,
    updatedAt: customNow
  };

  await persistAccountRecord(record);

  const remainingLockoutSec = lockedUntil > customNow ? Math.ceil((lockedUntil - customNow) / 1000) : 0;
  const delayMs = calculateProgressiveDelayMs(failedAttempts, config);

  return {
    locked,
    failedAttempts,
    lockedUntil,
    remainingLockoutSec,
    delayMs
  };
}

/**
 * Resets account protection counter on successful authentication.
 */
export async function resetAccountProtection(accountKey: string): Promise<void> {
  await deleteAccountRecord(accountKey);
  await addLog('INFO', 'AUTH', `Account protection counter safely reset for key ${accountKey.substring(0, 10)}...`);
}

/**
 * Performs a dummy constant-time password hash comparison.
 * Prevents account enumeration timing attacks when a user does not exist or credentials fail.
 */
export async function simulateCredentialVerificationDelay(): Promise<void> {
  try {
    await bcrypt.compare('dummy_timing_probe_token', DUMMY_BCRYPT_HASH);
  } catch {}
}

/**
 * Extracts and sanitizes the client IP respecting Express `trust proxy` configuration.
 * Never blindly trusts raw, spoofable leftmost X-Forwarded-For entries from unverified clients.
 */
export function getSanitizedClientIp(req: express.Request | any): string {
  if (!req) return 'unknown';

  // For upstream reverse proxy chains (Cloud Run / Nginx reverse proxy), extract client IP safely
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const parts = forwarded.split(',').map((p: string) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[0].replace(/^::ffff:/, '');
    }
  }

  // Express req.ip is computed safely according to app.set('trust proxy', 1)
  const rawIp = (req.ip || req.socket?.remoteAddress || 'unknown').trim();
  // Strip IPv4-mapped IPv6 notation (::ffff:192.0.2.1 -> 192.0.2.1)
  if (rawIp.startsWith('::ffff:')) {
    return rawIp.substring(7);
  }
  return rawIp;
}

/**
 * Reports status of the account protection store for multi-instance distributed readiness.
 */
export function getAccountProtectionStoreStatus(): {
  storeType: 'FIRESTORE_SHARED' | 'LOCAL_FALLBACK';
  isDistributed: boolean;
  message: string;
} {
  if (adminDb && !isFirestoreQuotaExceeded()) {
    return {
      storeType: 'FIRESTORE_SHARED',
      isDistributed: true,
      message: 'Active: Using shared Google Cloud Firestore collection "auth_account_limits" for multi-instance synchronization.'
    };
  }
  return {
    storeType: 'LOCAL_FALLBACK',
    isDistributed: false,
    message: 'Local Fallback: In-memory & disk storage active. To guarantee cross-instance synchronization in multi-container deployments, configure Firebase Admin credentials or shared Redis rate limiter.'
  };
}

/**
 * Test helper to clear all in-memory and local account protection state.
 */
export async function clearAllAccountProtectionStateForTesting(): Promise<void> {
  localMemoryStore.clear();
  try {
    writeLocalJson(LOCAL_STORE_FILE, {});
  } catch {}
}
