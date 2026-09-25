export interface CookieConsentPreferences {
  essential: boolean; // Always true
  preferences: boolean; // Theme, audio, UI layout
  analytics: boolean; // Anonymous reliability telemetry
  timestamp: number;
  version: string;
}

export const COOKIE_CONSENT_KEY = 'bse_nexus_cookie_consent_v1';

export function getCookieConsent(): CookieConsentPreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCookieConsent(prefs: Partial<CookieConsentPreferences>): CookieConsentPreferences {
  const fullPrefs: CookieConsentPreferences = {
    essential: true,
    preferences: prefs.preferences ?? true,
    analytics: prefs.analytics ?? false,
    timestamp: Date.now(),
    version: '1.0'
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(fullPrefs));
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: fullPrefs }));
  } catch (e) {
    console.error('Failed to save cookie consent', e);
  }
  return fullPrefs;
}

export function resetCookieConsent(): void {
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    window.dispatchEvent(new CustomEvent('cookie-consent-reset'));
  } catch (e) {
    console.error('Failed to reset cookie consent', e);
  }
}
