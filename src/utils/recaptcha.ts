/// <reference types="vite/client" />

/**
 * Google reCAPTCHA Enterprise Utility for BSE Nexus
 * 
 * Architecture Principle:
 * - Read key exclusively from environment variable (VITE_RECAPTCHA_SITE_KEY) - NEVER hardcoded.
 * - Lazy on-demand loading: The script is ONLY loaded when the user opens the auth modal.
 * - Zero impact on public pages: Search engine crawlers (Googlebot, ChatGPT Search bot,
 *   Bing, Perplexity) get 100% clean, fast public pages without any bot challenge blocking.
 */

declare global {
  interface Window {
    grecaptcha?: {
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

export const RECAPTCHA_SITE_KEY: string = 
  ((import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY as string) || '';

let recaptchaLoadPromise: Promise<boolean> | null = null;

/**
 * Ensure Google's floating badge does not leak or stay visible on other pages.
 * By Google reCAPTCHA Enterprise terms, hiding the badge is permitted as long as
 * the branding notice is displayed in the user flow (which is in ModernAuthCard).
 */
export function hideRecaptchaBadge(): void {
  if (typeof document === 'undefined') return;
  const badges = document.querySelectorAll<HTMLElement>('.grecaptcha-badge');
  badges.forEach((b) => {
    b.style.display = 'none';
    b.style.visibility = 'hidden';
    b.style.opacity = '0';
    b.style.pointerEvents = 'none';
  });
}

/**
 * Dynamically loads the reCAPTCHA Enterprise script on demand.
 * Key-aware: ensures script is loaded with render=<RECAPTCHA_SITE_KEY> so enterprise.execute() works.
 */
export async function loadRecaptchaScript(): Promise<boolean> {
  if (typeof document === 'undefined' || !RECAPTCHA_SITE_KEY) {
    return false;
  }

  // (b) If already tagged with site key and window.grecaptcha.enterprise is present, wait for ready
  const existingScript = document.querySelector('script[src*="recaptcha/enterprise.js"]') as HTMLScriptElement | null;
  if (existingScript && existingScript.src.includes(RECAPTCHA_SITE_KEY) && window.grecaptcha?.enterprise) {
    try {
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        try { window.grecaptcha!.enterprise.ready(done); } catch { done(); }
        setTimeout(done, 5000);
      });
    } catch { /* fall through */ }
    hideRecaptchaBadge();
    return true;
  }

  // Deduplicate in-flight loading
  if (recaptchaLoadPromise) {
    return recaptchaLoadPromise;
  }

  recaptchaLoadPromise = (async () => {
    try {
      const scriptTag = document.querySelector('script[src*="recaptcha/enterprise.js"]') as HTMLScriptElement | null;
      if (!scriptTag) {
        // (c) Inject script with render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
          script.async = true;
          script.defer = true;

          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error('reCAPTCHA script load timeout'));
            }
          }, 10000);

          script.onload = () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve();
            }
          };

          script.onerror = () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(new Error('reCAPTCHA script failed to load'));
            }
          };

          document.head.appendChild(script);
        });
      } else if (scriptTag.src.includes(RECAPTCHA_SITE_KEY)) {
        if (!window.grecaptcha?.enterprise) {
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                reject(new Error('reCAPTCHA script wait timeout'));
              }
            }, 10000);

            scriptTag.addEventListener('load', () => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve();
              }
            });
            scriptTag.addEventListener('error', () => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(new Error('reCAPTCHA script failed to load'));
              }
            });
          });
        }
      }

      // Wait for enterprise.ready()
      if (window.grecaptcha?.enterprise) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => { if (!settled) { settled = true; resolve(); } };
          try { window.grecaptcha!.enterprise.ready(done); } catch { done(); }
          setTimeout(done, 5000);
        });
        hideRecaptchaBadge();
        return true;
      }

      return false;
    } catch {
      recaptchaLoadPromise = null;
      return false;
    }
  })();

  return recaptchaLoadPromise;
}

export type RecaptchaAction = 'LOGIN' | 'SIGNUP' | 'RESET_PASSWORD' | 'ADMIN_PIN' | 'SESSION' | 'EXPORT_DATA' | 'PROTECTED_ACTION';

export interface RecaptchaResult {
  success: boolean;
  token?: string;
  blocked?: boolean;
  bypassed?: boolean;
  error?: string;
}

/**
 * Executes a reCAPTCHA Enterprise risk assessment token on demand.
 * If blocked by ad-blocker/privacy extension, sends the appropriate signal to the server
 * so server-side fail-closed policies evaluate cleanly.
 */
export async function executeRecaptcha(action: RecaptchaAction): Promise<RecaptchaResult> {
  try {
    if (!RECAPTCHA_SITE_KEY) {
      const isDev = Boolean((import.meta as any).env?.DEV);
      if (isDev) {
        return { success: true, token: 'DEV_BYPASS_TOKEN', bypassed: true };
      }
      return { 
        success: false, 
        blocked: true,
        token: 'BLOCKED_BY_CLIENT', 
        error: 'Security verification key is not configured.' 
      };
    }

    const isLoaded = await loadRecaptchaScript();
    if (!isLoaded || !window.grecaptcha?.enterprise) {
      return { 
        success: false, 
        blocked: true, 
        token: 'BLOCKED_BY_CLIENT', 
        error: 'Security script blocked by browser or content filter.' 
      };
    }

    return new Promise((resolve) => {
      window.grecaptcha!.enterprise.ready(async () => {
        try {
          const token = await window.grecaptcha!.enterprise.execute(RECAPTCHA_SITE_KEY, { action });
          hideRecaptchaBadge();
          resolve({ success: true, token });
        } catch (err: any) {
          hideRecaptchaBadge();
          resolve({ 
            success: false, 
            blocked: true, 
            token: 'SCRIPT_LOAD_FAILED', 
            error: err?.message || 'reCAPTCHA execution error' 
          });
        }
      });
    });
  } catch (err: any) {
    return { 
      success: false, 
      blocked: true, 
      token: 'BLOCKED_BY_CLIENT', 
      error: err?.message || 'reCAPTCHA exception' 
    };
  }
}
