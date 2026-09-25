/**
 * Google reCAPTCHA Enterprise Server-Side Verification Service
 * Project: bse-nexus
 * 
 * Strict Security Principles:
 * - Fail-closed: missing token, blocked script, verification error, invalid token,
 *   action mismatch, or score below threshold strictly reject authentication.
 * - Single-attempt / fresh use: tokens are tracked and cannot be replayed.
 * - Production immunity: Development bypass is hard-coded to be impossible in production.
 * - Zero secret leakage: only generic, user-safe error messages are returned to clients.
 */

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  host?: string;
}

export interface RecaptchaAssessmentResponse {
  valid: boolean;
  score: number;
  reasons?: string[];
  action?: string;
  error?: string;
  errorCode?: 
    | 'MISSING_TOKEN'
    | 'BLOCKED_SCRIPT'
    | 'TOKEN_REPLAYED'
    | 'INVALID_TOKEN'
    | 'ACTION_MISMATCH'
    | 'HOSTNAME_MISMATCH'
    | 'SCORE_BELOW_THRESHOLD'
    | 'VERIFICATION_ERROR'
    | 'SERVICE_UNAVAILABLE';
  userMessage?: string;
}

export interface RecaptchaVerificationOptions {
  minScore?: number;
  allowedHostnames?: string[];
  siteKey?: string;
  projectId?: string;
  customFetcher?: (url: string, init: RequestInit) => Promise<Response>;
  overrideAction?: string;
  overrideScore?: number;
}

// In-memory token replay prevention store (Single attempt / fresh use)
const consumedTokens = new Map<string, number>();
const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5-minute TTL

/**
 * Prunes expired tokens from the replay prevention cache
 */
function pruneConsumedTokens(): void {
  const now = Date.now();
  for (const [tok, timestamp] of consumedTokens.entries()) {
    if (now - timestamp > TOKEN_EXPIRY_MS) {
      consumedTokens.delete(tok);
    }
  }
}

/**
 * Clears the replay cache (useful for test isolation)
 */
export function clearConsumedTokensCache(): void {
  consumedTokens.clear();
}
export const clearConsumedTokensForTest = clearConsumedTokensCache;

/**
 * Returns the currently configured reCAPTCHA minimum risk score threshold
 */
export function getRecaptchaThreshold(): number {
  return parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
}

/**
 * Checks if development bypass is permissible.
 * CRITICAL: Strictly impossible if NODE_ENV === 'production'.
 */
export function isDevBypassAllowed(): boolean {
  return false;
}

/**
 * Verifies a Google reCAPTCHA Enterprise assessment token on the server
 */
export async function verifyRecaptchaToken(
  token: string,
  expectedAction: string,
  context?: RequestContext,
  options?: RecaptchaVerificationOptions
): Promise<RecaptchaAssessmentResponse> {
  pruneConsumedTokens();

  // 1. Missing or malformed token check -> Fail closed
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      valid: false,
      score: 0,
      errorCode: 'MISSING_TOKEN',
      userMessage: 'Security verification token is required. Please try again.',
      error: 'Missing or empty reCAPTCHA token'
    };
  }

  const cleanToken = token.trim();

  // 2. Blocked script / adblocker signal from client -> Fail closed
  if (
    cleanToken === 'BLOCKED_BY_CLIENT' ||
    cleanToken === 'SCRIPT_LOAD_FAILED' ||
    cleanToken.startsWith('BLOCKED_')
  ) {
    return {
      valid: false,
      score: 0,
      errorCode: 'BLOCKED_SCRIPT',
      userMessage: 'Security check was blocked. Please disable content blockers or shields and try again.',
      error: 'reCAPTCHA script was blocked by browser client'
    };
  }

  // 3. Single attempt / Fresh use check (Replay prevention) -> Fail closed
  if (consumedTokens.has(cleanToken)) {
    return {
      valid: false,
      score: 0,
      errorCode: 'TOKEN_REPLAYED',
      userMessage: 'Security token has already been used or expired. Please refresh and try again.',
      error: 'reCAPTCHA token replay attempted'
    };
  }

  // 4. Configuration & Google reCAPTCHA Enterprise REST API Call
  const projectId = options?.projectId || process.env.RECAPTCHA_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'bse-nexus';
  const apiKey = process.env.RECAPTCHA_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const siteKey = options?.siteKey || process.env.VITE_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || '';
  const minScore = options?.minScore ?? parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

  // If no API key is configured to perform server assessment -> Fail closed in ALL environments
  if (!apiKey) {
    return {
      valid: false,
      score: 0,
      errorCode: 'SERVICE_UNAVAILABLE',
      userMessage: 'Security verification is temporarily unavailable. Please try again later.',
      error: 'reCAPTCHA Enterprise API key not configured on server'
    };
  }

  // 5. Execute assessment against Google reCAPTCHA Enterprise API
  const fetchFn = options?.customFetcher || fetch;
  const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`;
  
  const payload = {
    event: {
      token: cleanToken,
      siteKey: siteKey || undefined,
      expectedAction,
      userIpAddress: context?.ip || undefined,
      userAgent: context?.userAgent || undefined
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const resp = await fetchFn(assessmentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.error(`[reCAPTCHA Enterprise] Assessment call returned status ${resp.status}`);
      return {
        valid: false,
        score: 0,
        errorCode: 'VERIFICATION_ERROR',
        userMessage: 'Security verification could not be completed. Please try again.',
        error: `Assessment API responded with HTTP ${resp.status}`
      };
    }

    const data: any = await resp.json();
    const tokenProps = data?.tokenProperties;
    const riskAnalysis = data?.riskAnalysis;

    // 6. Verify token validity from assessment (Google's verdict is final, fail-closed)
    if (!tokenProps || tokenProps.valid !== true) {
      return {
        valid: false,
        score: 0,
        errorCode: 'INVALID_TOKEN',
        userMessage: 'Invalid or expired security token. Please try again.',
        error: tokenProps?.invalidReason || 'Token not valid in assessment'
      };
    }

    // 7. Verify expected action match
    if (expectedAction && tokenProps.action !== expectedAction) {
      return {
        valid: false,
        score: riskAnalysis?.score ?? 0,
        errorCode: 'ACTION_MISMATCH',
        userMessage: 'Security action verification failed. Please try again.',
        error: `Expected action "${expectedAction}" but received "${tokenProps.action}"`
      };
    }

    // 8. Verify hostname against allow-list
    const envHostnames = process.env.RECAPTCHA_ALLOWED_HOSTNAMES 
      ? process.env.RECAPTCHA_ALLOWED_HOSTNAMES.split(',').map(h => h.trim().toLowerCase()).filter(Boolean) 
      : [];

    // Allow configured production hostnames plus Cloud Run preview (*.run.app) and local development
    const defaultAllowedHostnames = [
      ...envHostnames,
      'run.app',
      'localhost',
      '127.0.0.1'
    ];

    const configuredHostnames = options?.allowedHostnames || defaultAllowedHostnames;
    
    if (configuredHostnames.length > 0 && tokenProps.hostname) {
      const tokenHost = tokenProps.hostname.toLowerCase();
      const isAllowed = configuredHostnames.some(allowed => tokenHost === allowed || tokenHost.endsWith(`.${allowed}`));

      if (!isAllowed) {
        return {
          valid: false,
          score: riskAnalysis?.score ?? 0,
          errorCode: 'HOSTNAME_MISMATCH',
          userMessage: 'Security origin verification failed. Please try again.',
          error: `Hostname "${tokenProps.hostname}" not in allowed hostnames`
        };
      }
    }

    // 10. Verify risk score threshold
    const score = typeof riskAnalysis?.score === 'number' ? riskAnalysis.score : 0;
    if (score < minScore) {
      return {
        valid: false,
        score,
        reasons: riskAnalysis?.reasons || [],
        errorCode: 'SCORE_BELOW_THRESHOLD',
        userMessage: 'Security score below required threshold. Verification failed.',
        error: `Score ${score} is below minimum threshold ${minScore}`
      };
    }

    // Passed all checks: Register in replay prevention cache
    consumedTokens.set(cleanToken, Date.now());

    return {
      valid: true,
      score,
      action: tokenProps.action,
      reasons: riskAnalysis?.reasons || []
    };
  } catch (err: any) {
    console.error('[reCAPTCHA Enterprise] Assessment call failed:', err?.message || err);
    return {
      valid: false,
      score: 0,
      errorCode: 'VERIFICATION_ERROR',
      userMessage: 'Security verification encountered a network error. Please try again.',
      error: err?.name === 'AbortError' ? 'Assessment call timed out' : 'Assessment network failure'
    };
  }
}

