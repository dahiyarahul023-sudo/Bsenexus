import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, Settings, Check, X, ExternalLink } from 'lucide-react';
import { getCookieConsent, saveCookieConsent, CookieConsentPreferences } from '../utils/cookieConsent';

interface CookieConsentBannerProps {
  onOpenPrivacyPolicy?: () => void;
  onOpenCookiePolicy?: () => void;
}

export function CookieConsentBanner({ onOpenPrivacyPolicy, onOpenCookiePolicy }: CookieConsentBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [preferences, setPreferences] = useState<CookieConsentPreferences>({
    essential: true,
    preferences: true,
    analytics: false,
    timestamp: Date.now(),
    version: '1.0'
  });

  useEffect(() => {
    const existing = getCookieConsent();
    if (!existing) {
      // Delay slightly for smooth page entry
      const timer = setTimeout(() => setShowBanner(true), 800);
      return () => clearTimeout(timer);
    } else {
      setPreferences(existing);
    }

    const handleOpenSettings = () => {
      setShowCustomModal(true);
      setShowBanner(true);
    };

    window.addEventListener('open-cookie-settings', handleOpenSettings);
    return () => window.removeEventListener('open-cookie-settings', handleOpenSettings);
  }, []);

  const handleAcceptAll = () => {
    saveCookieConsent({ preferences: true, analytics: true });
    setShowBanner(false);
    setShowCustomModal(false);
  };

  const handleEssentialOnly = () => {
    saveCookieConsent({ preferences: false, analytics: false });
    setShowBanner(false);
    setShowCustomModal(false);
  };

  const handleSaveCustom = () => {
    saveCookieConsent(preferences);
    setShowBanner(false);
    setShowCustomModal(false);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Non-intrusive floating banner */}
      <aside 
        aria-label="Cookie and Privacy Consent Banner"
        role="region"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-xl z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      >
        <div className="bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 text-slate-800 dark:text-slate-100 flex flex-col gap-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/50">
              <Cookie size={18} />
            </div>
            
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Data Privacy &amp; Cookie Consent</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold">
                    DPDP 2023 &bull; GDPR
                  </span>
                </h4>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                We use strictly essential local storage to remember your watchlists, secure auth session, and theme. We <strong>never</strong> sell user data, run 3rd-party ad trackers, or store Demat/broker credentials.
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pl-1">
            <button 
              type="button" 
              onClick={onOpenPrivacyPolicy}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>&bull;</span>
            <button 
              type="button" 
              onClick={onOpenCookiePolicy}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Cookie Policy
            </button>
            <span>&bull;</span>
            <button 
              type="button" 
              onClick={() => setShowCustomModal(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Settings size={11} />
              <span>Customize</span>
            </button>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={handleEssentialOnly}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Only store essential session & watchlists"
            >
              Essential Only
            </button>
            
            <button
              type="button"
              onClick={handleAcceptAll}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Check size={13} />
              <span>Accept All</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Preferences Customization Modal */}
      {showCustomModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setShowCustomModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-preferences-title"
        >
          <div 
            className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 id="cookie-preferences-title" className="text-sm font-bold text-slate-900 dark:text-white">
                  Cookie &amp; Storage Preferences
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                aria-label="Close preferences"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Essential Item */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <span>Strictly Essential (Required)</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded font-mono text-slate-700 dark:text-slate-300">Always Active</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Required for authentication tokens, local watchlist sync, and basic application security.
                  </p>
                </div>
                <input 
                  type="checkbox" 
                  checked 
                  disabled 
                  aria-label="Essential storage (Always active)" 
                  className="rounded text-indigo-600 cursor-not-allowed mt-1" 
                />
              </div>

              {/* Functional Preferences */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Functional &amp; UI Preferences
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Remembers your dark/light theme, audio bell toggles, and customized table column views.
                  </p>
                </div>
                <input 
                  type="checkbox" 
                  checked={preferences.preferences}
                  onChange={(e) => setPreferences(prev => ({ ...prev, preferences: e.target.checked }))}
                  aria-label="Functional and theme preferences"
                  className="rounded text-indigo-600 cursor-pointer mt-1" 
                />
              </div>

              {/* Performance & Error Telemetry */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Anonymous Reliability Telemetry
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Helps diagnose API timeouts and connection dropouts anonymously. No personal browsing activity tracked.
                  </p>
                </div>
                <input 
                  type="checkbox" 
                  checked={preferences.analytics}
                  onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                  aria-label="Anonymous error telemetry"
                  className="rounded text-indigo-600 cursor-pointer mt-1" 
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleEssentialOnly}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
              >
                Reject Non-Essential
              </button>
              
              <button
                type="button"
                onClick={handleSaveCustom}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
