import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { 
  verifyRecaptchaToken, 
  clearConsumedTokensForTest,
  getRecaptchaThreshold
} from '../security/recaptchaService.js';

describe('Google reCAPTCHA Enterprise Strict Verification Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearConsumedTokensForTest();
    process.env.RECAPTCHA_API_KEY = 'test-recaptcha-api-key';
    process.env.RECAPTCHA_ALLOWED_HOSTNAMES = 'localhost,127.0.0.1,bsenexus.in,www.bsenexus.in';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('Missing or empty token fails closed', async () => {
    const result1 = await verifyRecaptchaToken('', 'LOGIN');
    assert.strictEqual(result1.valid, false);
    assert.strictEqual(result1.errorCode, 'MISSING_TOKEN');
    assert.ok(result1.userMessage);
    assert.ok(!result1.userMessage.includes('internal') && !result1.userMessage.includes('stack'));

    const result2 = await verifyRecaptchaToken(null as any, 'LOGIN');
    assert.strictEqual(result2.valid, false);
    assert.strictEqual(result2.errorCode, 'MISSING_TOKEN');

    const result3 = await verifyRecaptchaToken('   ', 'LOGIN');
    assert.strictEqual(result3.valid, false);
    assert.strictEqual(result3.errorCode, 'MISSING_TOKEN');
  });

  test('Blocked script or client failure flags fail closed', async () => {
    const resultBlocked = await verifyRecaptchaToken('BLOCKED_BY_CLIENT', 'LOGIN');
    assert.strictEqual(resultBlocked.valid, false);
    assert.strictEqual(resultBlocked.errorCode, 'BLOCKED_SCRIPT');
    assert.ok(resultBlocked.userMessage.toLowerCase().includes('shield') || resultBlocked.userMessage.toLowerCase().includes('filter'));

    const resultFailed = await verifyRecaptchaToken('SCRIPT_LOAD_FAILED', 'SIGNUP');
    assert.strictEqual(resultFailed.valid, false);
    assert.strictEqual(resultFailed.errorCode, 'BLOCKED_SCRIPT');
  });

  test('Action mismatch fails closed', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { valid: true, action: 'SIGNUP', hostname: 'localhost' },
        riskAnalysis: { score: 0.95 }
      })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('TOKEN_ABC', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorCode, 'ACTION_MISMATCH');
  });

  test('Low risk score below threshold fails closed', async () => {
    const threshold = getRecaptchaThreshold();
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { valid: true, action: 'LOGIN', hostname: 'localhost' },
        riskAnalysis: { score: threshold - 0.2 }
      })
    } as unknown as Response);

    const lowScoreResult = await verifyRecaptchaToken('TOKEN_LOW_SCORE', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(lowScoreResult.valid, false);
    assert.strictEqual(lowScoreResult.errorCode, 'SCORE_BELOW_THRESHOLD');
    assert.ok(lowScoreResult.score !== undefined && lowScoreResult.score < threshold);
  });

  test('Token replay fails closed (single-use requirement)', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { valid: true, action: 'LOGIN', hostname: 'localhost' },
        riskAnalysis: { score: 0.9 }
      })
    } as unknown as Response);

    // First attempt with this specific token
    const attempt1 = await verifyRecaptchaToken('TEST_SINGLE_USE_TOKEN_XYZ', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(attempt1.valid, true);

    // Second attempt with exact same token must fail without even calling Google
    const attempt2 = await verifyRecaptchaToken('TEST_SINGLE_USE_TOKEN_XYZ', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(attempt2.valid, false);
    assert.strictEqual(attempt2.errorCode, 'TOKEN_REPLAYED');
    assert.ok(attempt2.userMessage.includes('expired') || attempt2.userMessage.includes('refresh'));
  });

  test('Invalid token from Google assessment (DOMAIN_MISMATCH or any reason) fails closed', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { valid: false, invalidReason: 'DOMAIN_MISMATCH', hostname: 'unknown.com' },
        riskAnalysis: { score: 0.9 }
      })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('TOKEN_WITH_DOMAIN_MISMATCH', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorCode, 'INVALID_TOKEN');
  });

  test('Dev bypass tokens are strictly rejected (no bypass exists anywhere in any environment)', async () => {
    process.env.ENABLE_RECAPTCHA_DEV_BYPASS = 'true';
    delete process.env.RECAPTCHA_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const result = await verifyRecaptchaToken('DEV_BYPASS_TOKEN', 'LOGIN');
    assert.strictEqual(result.valid, false);
    // No bypass executed, fails closed with SERVICE_UNAVAILABLE since no API key is set
    assert.strictEqual(result.errorCode, 'SERVICE_UNAVAILABLE');
  });

  test('Valid assessment from Google succeeds with verified score and action', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { valid: true, action: 'LOGIN', hostname: 'localhost' },
        riskAnalysis: { score: 0.95 }
      })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('FRESH_VALID_TOKEN_1', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.action, 'LOGIN');
    assert.strictEqual(result.score, 0.95);
  });

  test('Hostname not in RECAPTCHA_ALLOWED_HOSTNAMES fails closed', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { valid: true, action: 'LOGIN', hostname: 'malicious-phishing.com' },
        riskAnalysis: { score: 0.95 }
      })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('TOKEN_BAD_HOST', 'LOGIN', undefined, {
      customFetcher: mockFetcher,
      allowedHostnames: ['example.com', 'bse-nexus.com']
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorCode, 'HOSTNAME_MISMATCH');
  });

  test('Cloud Run preview hostnames (*.run.app) pass default hostname allowlist', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { 
          valid: true, 
          action: 'LOGIN', 
          hostname: 'ais-dev-vntevulpyjszuwgtajbwz4-389563995519.asia-east1.run.app' 
        },
        riskAnalysis: { score: 0.95 }
      })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('TOKEN_CLOUD_RUN_PREVIEW', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.action, 'LOGIN');
  });

  test('Unauthorized origin fails closed under default allowlist', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { 
          valid: true, 
          action: 'LOGIN', 
          hostname: 'unauthorized-site.com' 
        },
        riskAnalysis: { score: 0.95 }
      })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('TOKEN_UNAUTHORIZED_ORIGIN', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorCode, 'HOSTNAME_MISMATCH');
  });

  test('Generic user-safe error messages never expose internal secrets', async () => {
    const mockFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tokenProperties: { valid: false, invalidReason: 'MALFORMED' }
      })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('UNKNOWN_MALFORMED_DATA_@#$%', 'LOGIN', undefined, {
      customFetcher: mockFetcher
    });
    assert.strictEqual(result.valid, false);
    assert.ok(!result.userMessage.includes('KEY'));
    assert.ok(!result.userMessage.includes('project_id'));
    assert.ok(!result.userMessage.includes('Error:'));
    assert.ok(!result.userMessage.includes('/'));
  });

  test('Server failure: Google verification API returns HTTP 500/503 fails closed', async () => {
    const mock503Fetcher = async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Service Unavailable', code: 503 } })
    } as unknown as Response);

    const result = await verifyRecaptchaToken('TEST_TOKEN_ON_503_DOWN', 'LOGIN', undefined, {
      customFetcher: mock503Fetcher
    });

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorCode, 'VERIFICATION_ERROR');
    assert.strictEqual(result.score, 0);
    assert.ok(result.userMessage);
    assert.ok(!result.userMessage.includes('503'));
    assert.ok(!result.userMessage.includes('test-recaptcha-api-key'));
  });

  test('Server failure: Google assessment API network outage or timeout fails closed', async () => {
    const mockNetworkErrorFetcher = async () => {
      throw new Error('connect ECONNREFUSED 142.250.190.42:443');
    };

    const result = await verifyRecaptchaToken('TEST_TOKEN_ON_NETWORK_CRASH', 'LOGIN', undefined, {
      customFetcher: mockNetworkErrorFetcher
    });

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorCode, 'VERIFICATION_ERROR');
    assert.strictEqual(result.score, 0);
    assert.ok(result.userMessage);
    assert.ok(result.userMessage.toLowerCase().includes('network') || result.userMessage.toLowerCase().includes('verification'));
    assert.ok(!result.userMessage.includes('ECONNREFUSED'));
    assert.ok(!result.userMessage.includes('142.250.190.42'));
  });

  test('Server failure: Missing API credentials fails closed in all environments', async () => {
    delete process.env.RECAPTCHA_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    // In development
    process.env.NODE_ENV = 'development';
    const resultDev = await verifyRecaptchaToken('ANY_TOKEN_DEV_NOCREDS', 'LOGIN');
    assert.strictEqual(resultDev.valid, false);
    assert.strictEqual(resultDev.errorCode, 'SERVICE_UNAVAILABLE');
    assert.strictEqual(resultDev.score, 0);

    // In production
    process.env.NODE_ENV = 'production';
    const resultProd = await verifyRecaptchaToken('ANY_TOKEN_PROD_NOCREDS', 'LOGIN');
    assert.strictEqual(resultProd.valid, false);
    assert.strictEqual(resultProd.errorCode, 'SERVICE_UNAVAILABLE');
    assert.strictEqual(resultProd.score, 0);
  });
});
