import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import {
  noteQuotaError,
  setFirestoreQuotaExceeded,
  resetQuotaExceededFlag,
  isFirestoreQuotaExceeded,
  getManualStorageMode,
  setManualStorageMode,
  applyRemoteStorageMode,
  QUOTA_CONFIRM_THRESHOLD,
  QUOTA_CONFIRM_WINDOW_MS,
} from '../database/localStore.js';

/**
 * Auto storage switch hardening (1 Oct 2026).
 *
 * Old behavior: ONE quota-shaped error flipped the whole app into local-JSON
 * fallback until US Pacific midnight, and the admin's manual mode lived only
 * in a revision-local file, so every republish silently reset it to AUTO.
 * Rohit's report: the manual switch "fixed" everything instantly — the app
 * was parked in fallback, not truly quota-dead.
 *
 * New contract:
 *  - the global switch needs several quota errors inside a short window;
 *  - manual modes still win instantly (FORCE_LOCAL / FORCE_FIRESTORE);
 *  - applying a remote mode equal to the local mode is a no-op, so a boot
 *    sync can never clear a still-valid quota-exceeded state.
 */

beforeEach(() => {
  resetQuotaExceededFlag();
  setManualStorageMode('AUTO');
  resetQuotaExceededFlag();
});

after(() => {
  // Leave module state neutral for any suite sharing this process.
  resetQuotaExceededFlag();
  setManualStorageMode('AUTO');
  resetQuotaExceededFlag();
});

describe('quota switch confirmation', () => {
  test('a single quota error does not flip the app into local fallback', () => {
    assert.equal(noteQuotaError(Date.now()), false);
    assert.equal(isFirestoreQuotaExceeded(), false);
  });

  test('two quota errors still do not flip the switch', () => {
    const now = Date.now();
    noteQuotaError(now);
    assert.equal(noteQuotaError(now + 1_000), false);
    assert.equal(isFirestoreQuotaExceeded(), false);
  });

  test('the confirming error inside the window flips the switch', () => {
    const now = Date.now();
    for (let i = 0; i < QUOTA_CONFIRM_THRESHOLD - 1; i++) noteQuotaError(now + i * 1_000);
    assert.equal(noteQuotaError(now + QUOTA_CONFIRM_THRESHOLD * 1_000), true);
    assert.equal(isFirestoreQuotaExceeded(), true);
  });

  test('errors older than the window no longer count', () => {
    const now = Date.now();
    noteQuotaError(now - QUOTA_CONFIRM_WINDOW_MS - 5_000);
    noteQuotaError(now - QUOTA_CONFIRM_WINDOW_MS - 4_000);
    // Both previous errors have aged out of the rolling window.
    assert.equal(noteQuotaError(now), false);
    assert.equal(isFirestoreQuotaExceeded(), false);
  });

  test('explicit clear removes a confirmed quota state immediately', () => {
    const now = Date.now();
    for (let i = 0; i < QUOTA_CONFIRM_THRESHOLD; i++) noteQuotaError(now + i * 1_000);
    assert.equal(isFirestoreQuotaExceeded(), true);
    setFirestoreQuotaExceeded(false);
    assert.equal(isFirestoreQuotaExceeded(), false);
  });
});

describe('manual storage modes', () => {
  test('FORCE_LOCAL reports quota exceeded, FORCE_FIRESTORE reports healthy', () => {
    setManualStorageMode('FORCE_LOCAL');
    assert.equal(isFirestoreQuotaExceeded(), true);
    setManualStorageMode('FORCE_FIRESTORE');
    assert.equal(isFirestoreQuotaExceeded(), false);
  });

  test('applying the same remote mode is a no-op and keeps quota state', () => {
    const now = Date.now();
    for (let i = 0; i < QUOTA_CONFIRM_THRESHOLD; i++) noteQuotaError(now + i * 1_000);
    assert.equal(isFirestoreQuotaExceeded(), true);
    applyRemoteStorageMode('AUTO'); // same as local mode
    assert.equal(getManualStorageMode(), 'AUTO');
    assert.equal(isFirestoreQuotaExceeded(), true);
  });

  test('applying a different remote mode adopts it', () => {
    applyRemoteStorageMode('FORCE_FIRESTORE');
    assert.equal(getManualStorageMode(), 'FORCE_FIRESTORE');
    assert.equal(isFirestoreQuotaExceeded(), false);
    applyRemoteStorageMode('AUTO');
    assert.equal(getManualStorageMode(), 'AUTO');
  });
});
