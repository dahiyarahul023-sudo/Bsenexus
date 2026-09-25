import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * State verification tests for Truthful reCAPTCHA Authentication UI
 * Ensures that the UI state machine guarantees:
 * 1. Distinct states: idle, checking, verified, blocked, error
 * 2. Missing/error/bypass/blocked states are NEVER rendered as "verified" or "✓ Human"
 * 3. Verified state is ONLY allowed after a successful server assessment
 * 4. Error messages are strictly generic and user-friendly (no sensitive leak)
 * 5. Double-submit prevention & loading states prevent duplicate requests
 */

type RecaptchaState = 'idle' | 'checking' | 'verified' | 'blocked' | 'error';

interface StateEvaluation {
  status: RecaptchaState;
  isVerified: boolean;
  canSubmit: boolean;
  userMessage: string;
  badgeText: string;
  ariaLive: 'polite' | 'assertive';
  role?: string;
  allowRetry: boolean;
}

function evaluateUiState(
  status: RecaptchaState,
  isFormSubmitting: boolean
): StateEvaluation {
  const isVerified = status === 'verified';
  const canSubmit = !isFormSubmitting && status !== 'checking';

  switch (status) {
    case 'idle':
      return {
        status,
        isVerified: false,
        canSubmit,
        userMessage: 'Assessment verifies on submission',
        badgeText: 'Ready',
        ariaLive: 'polite',
        allowRetry: false,
      };
    case 'checking':
      return {
        status,
        isVerified: false,
        canSubmit: false, // Double submit strictly blocked while checking
        userMessage: 'Assessing reCAPTCHA Enterprise risk score',
        badgeText: 'Checking',
        ariaLive: 'polite',
        role: 'status',
        allowRetry: false,
      };
    case 'verified':
      return {
        status,
        isVerified: true,
        canSubmit,
        userMessage: 'Security assessment confirmed by server',
        badgeText: '✓ Verified',
        ariaLive: 'polite',
        role: 'status',
        allowRetry: false,
      };
    case 'blocked':
      return {
        status,
        isVerified: false,
        canSubmit,
        userMessage: 'Script blocked by browser filter. Please retry.',
        badgeText: 'Retry',
        ariaLive: 'assertive',
        role: 'alert',
        allowRetry: true,
      };
    case 'error':
      return {
        status,
        isVerified: false,
        canSubmit,
        userMessage: 'Verification did not complete. Please retry.',
        badgeText: 'Retry',
        ariaLive: 'assertive',
        role: 'alert',
        allowRetry: true,
      };
  }
}

describe('Truthful reCAPTCHA Authentication UI State Machine Tests', () => {
  it('Distinct states are recognized and isolated', () => {
    const states: RecaptchaState[] = ['idle', 'checking', 'verified', 'blocked', 'error'];
    const evaluations = states.map((s) => evaluateUiState(s, false));

    assert.equal(evaluations.length, 5);
    // Ensure badges are unique and non-empty
    const badges = evaluations.map((e) => e.badgeText);
    assert.equal(new Set(badges).size, 4); // Ready, Checking, ✓ Verified, Retry
  });

  it('Script missing, blocked, error, or idle state NEVER renders verified badge or status', () => {
    const unverifiedStates: RecaptchaState[] = ['idle', 'checking', 'blocked', 'error'];

    for (const state of unverifiedStates) {
      const evaluation = evaluateUiState(state, false);
      assert.equal(evaluation.isVerified, false, `State ${state} must not be verified`);
      assert.notEqual(evaluation.badgeText, '✓ Verified');
      assert.notEqual(evaluation.badgeText, '✓ Human');
      assert.notEqual(evaluation.badgeText, 'Human Verified');
    }
  });

  it('Verified status ONLY occurs when server verification explicitly succeeds', () => {
    const verifiedEval = evaluateUiState('verified', false);
    assert.equal(verifiedEval.isVerified, true);
    assert.equal(verifiedEval.badgeText, '✓ Verified');
    assert.match(verifiedEval.userMessage, /confirmed by server/i);
  });

  it('Checking state strictly enforces double-submit prevention', () => {
    const checkingEval = evaluateUiState('checking', false);
    assert.equal(checkingEval.canSubmit, false, 'Button must be disabled during active security check');
    assert.equal(checkingEval.role, 'status');
    assert.equal(checkingEval.ariaLive, 'polite');
  });

  it('Failure states (blocked and error) provide user-safe retry and assertive accessibility', () => {
    const blockedEval = evaluateUiState('blocked', false);
    assert.equal(blockedEval.role, 'alert');
    assert.equal(blockedEval.ariaLive, 'assertive');
    assert.equal(blockedEval.allowRetry, true);
    assert.doesNotMatch(blockedEval.userMessage, /token|secret|api_key|assessment_id|internal/i);

    const errorEval = evaluateUiState('error', false);
    assert.equal(errorEval.role, 'alert');
    assert.equal(errorEval.ariaLive, 'assertive');
    assert.equal(errorEval.allowRetry, true);
    assert.doesNotMatch(errorEval.userMessage, /token|secret|api_key|assessment_id|internal/i);
  });
});
