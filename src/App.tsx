import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IntelModalProvider } from './context/IntelModalContext';
import { NoteEditorProvider } from './context/NoteEditorContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { customFetch } from './api';
import { verifyProPayment, clearPendingOrderId, getPlanDisplayFromOrderId, isValidPlanId } from './utils/cashfree';
import { useVisibilityInterval } from './hooks/useVisibilityInterval';
import type { DesignTheme } from './types';

import { LandingPage } from './components/LandingPage';
import { Layout } from './components/Layout';
import Announcements from './components/Announcements';
import { AuthModal } from './components/AuthModal';
import { ProUpgradeModal } from './components/ProUpgradeModal';
import { ProCheckoutView } from './components/ProCheckoutView';
import { ProReceiptView } from './components/ProReceiptView';
import { AdminPinModal } from './components/AdminPinModal';
import { HomeForYou } from './components/HomeForYou';
// Route-level code splitting: heavy tab/route panels load on first visit,
// keeping the initial bundle (landing + feed) small for fast first paint.
// The feed (Announcements) and home stay eager — everything else is lazy.
const WatchlistManager = lazy(() => import('./components/WatchlistManager').then(m => ({ default: m.WatchlistManager })));
const ResultsCalendar = lazy(() => import('./components/ResultsCalendar').then(m => ({ default: m.ResultsCalendar })));
const NewsPortal = lazy(() => import('./components/NewsPortal').then(m => ({ default: m.NewsPortal })));
const StorageManager = lazy(() => import('./components/StorageManager').then(m => ({ default: m.StorageManager })));
const AdminDiagnostics = lazy(() => import('./components/AdminDiagnostics').then(m => ({ default: m.AdminDiagnostics })));
const LogsTab = lazy(() => import('./components/LogsTab').then(m => ({ default: m.LogsTab })));
const SettingsTab = lazy(() => import('./components/SettingsTab').then(m => ({ default: m.SettingsTab })));
const SeoStudio = lazy(() => import('./components/seo/SeoStudio').then(m => ({ default: m.SeoStudio })));

// Minimal route-level suspense fallback: matches the app's existing loading
// language; visible only while a tab's chunk loads on first visit.
function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16" aria-label="Loading section">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-slate-500 dark:border-t-slate-300 animate-spin" />
    </div>
  );
}
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { TabErrorBoundary } from './components/ui/TabErrorBoundary';
import { ScrollRestoredPill } from './components/ui/ScrollRestoredPill';
import { saveScrollPosition } from './utils/scrollState';
import { parseShareablePath } from './utils/shareUrls';
import { FilingPage } from './components/filing/FilingPage';
import { ResultsPage } from './components/results/ResultsPage';
import { NoteEditorHost } from './components/notes/NoteEditor';
const GuidesPage = lazy(() => import('./components/GuidesPage').then(m => ({ default: m.GuidesPage })));
const CompaniesPage = lazy(() => import('./components/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const TrustPage = lazy(() => import('./components/TrustPages').then(m => ({ default: m.TrustPage })));
const NotFoundPage = lazy(() => import('./components/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

function getAppPathRoute(): 'home' | 'pricing' | 'guides' | 'companies' | 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer' | '404' {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return 'home';
  if (path === '/pricing' || path === '/plans') return 'pricing';
  if (path === '/guides' || path === '/market-guides') return 'guides';
  if (path === '/companies' || path === '/company-directory') return 'companies';
  if (path === '/about') return 'about';
  if (path === '/contact') return 'contact';
  if (path === '/disclaimer') return 'disclaimer';
  if (path === '/privacy' || path === '/privacy-policy') return 'privacy';
  if (path === '/terms' || path === '/terms-of-service') return 'terms';
  if (
    path.startsWith('/faq') ||
    path.startsWith('/company/') ||
    path.startsWith('/stock/') ||
    path.startsWith('/guides/') ||
    path.startsWith('/announcement/') ||
    path.startsWith('/announcements') ||
    path.startsWith('/filing/') ||
    path.startsWith('/results/') ||
    path === '/live' ||
    path.startsWith('/results-calendar') ||
    path.startsWith('/watchlist') ||
    path.startsWith('/watchlists') ||
    path.startsWith('/embed/')
  ) {
    return 'home';
  }
  return '404';
}

function Dashboard({ bseHealth, telegramHealth, isRunning, handleToggle }: any) {
  return (
    <div className="space-y-2">
      {/* Main Announcements Feed */}
      <Announcements 
        isRunning={isRunning}
        onToggleEngine={handleToggle}
        bseHealth={bseHealth}
        telegramHealth={telegramHealth}
      />
    </div>
  );
}

/**
 * Handles the return from Cashfree checkout: /?cf_order_id=...
 * Verifies the payment with OUR server (source of truth — never trusts the
 * redirect alone), refreshes the profile, and shows the result.
 * Runs on every route so a payment return always lands in the React app.
 */
function CashfreeReturnHandler() {
  const { user, refreshProfile, setReceipt, setIsAuthModalOpen } = useAuth();
  const { success, warning } = useToast();
  const handledRef = useRef<string | null>(null);
  // While our server confirms the payment with Cashfree, show a processing
  // overlay so the screen never sits blank before the invoice appears.
  const [verifying, setVerifying] = useState(false);
  // UI-001 (1 Oct 2026 audit): Tracks the case where a payment return URL lands
  // without an active Firebase session (incognito, different browser, session
  // expiry). Previously the boot splash painted forever and the user had no
  // path forward — the payment was already deducted. Now we drop the splash and
  // surface an explicit "sign in to confirm" prompt.
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let orderId: string | null = null;
    try {
      orderId = new URLSearchParams(window.location.search).get('cf_order_id');
    } catch { return; }
    if (!orderId || handledRef.current === orderId) return;

    // UI-001 fix: If no user after auth has resolved, drop the splash and show
    // the sign-in prompt. Stash the orderId so we can re-verify after login.
    if (!user) {
      try {
        document.getElementById('cf-boot-splash')?.remove();
      } catch { /* non-fatal */ }
      try {
        sessionStorage.setItem('cf_pending_order_id', orderId);
      } catch { /* non-fatal */ }
      setNeedsLogin(true);
      return;
    }
    handledRef.current = orderId;
    (async () => {
      // React has booted: drop the instant boot splash (see index.html) and
      // continue with the in-app processing overlay — one seamless handoff.
      try {
        document.getElementById('cf-boot-splash')?.remove();
      } catch { /* non-fatal */ }
      setNeedsLogin(false);
      setVerifying(true);
      const v = await verifyProPayment(orderId as string);
      clearPendingOrderId();
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('cf_order_id');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch { /* non-fatal */ }
      setVerifying(false);
      if (v.paid) {
        await refreshProfile();
        // Open the invoice screen instead of a plain toast.
        if (v.receipt) {
          setReceipt(v.receipt);
        } else {
          const planLabel = getPlanDisplayFromOrderId(orderId).label;
          success(`${planLabel} activated — welcome!`);
        }
      } else {
        warning(v.error || 'Payment not confirmed yet. If money was debited, it will reflect shortly.');
      }
    })();
  }, [user]);

  // UI-001: When user signs in after seeing the needs-login prompt, re-trigger
  // verification using the stashed orderId.
  useEffect(() => {
    if (user && needsLogin) {
      const stashed = sessionStorage.getItem('cf_pending_order_id');
      if (stashed) {
        sessionStorage.removeItem('cf_pending_order_id');
        setNeedsLogin(false);
        // Re-run the main effect by clearing the handled guard.
        handledRef.current = null;
        // Force re-render via state toggle.
        setVerifying(false);
      }
    }
  }, [user, needsLogin]);

  if (needsLogin) {
    return (
      <div
        className="fixed inset-0 z-[96] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to confirm payment"
      >
        <div className="w-full max-w-[360px] rounded-[28px] bg-white shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4 text-2xl" aria-hidden="true">🔐</div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Sign in to confirm your payment</h2>
          <p className="text-sm text-slate-600 mb-6">Your payment was processed. Sign in to the same account that placed the order to view your receipt and activate Pro.</p>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full px-5 py-3 rounded-full bg-slate-950 text-white font-medium hover:bg-slate-800 transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (!verifying) return null;
  return (
    <div
      className="fixed inset-0 z-[96] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="status"
      aria-live="polite"
      aria-label="Confirming payment"
    >
      <div className="w-full max-w-[320px] rounded-[28px] bg-white shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        <span className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-950 animate-spin" aria-hidden="true" />
        <h2 className="mt-5 text-[16px] font-black text-slate-900">Confirming your payment…</h2>
        <p className="mt-2 text-[12px] font-medium text-slate-500 leading-relaxed">
          We're verifying it with Cashfree and preparing your invoice. One moment.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<'home' | 'pricing' | 'guides' | 'companies' | 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer' | '404'>(() => getAppPathRoute());
  // Shareable deep-link route (/filing/:symbol/:newsId, /results/:symbol/:quarterKey).
  // Rendered as standalone public pages; must survive the tab-sync pushState logic.
  // Legacy /announcement/:newsId URLs 301-redirect server-side, so only the two
  // canonical kinds become share routes here.
  const sharePathFor = (pathname: string) => {
    const p = parseShareablePath(pathname);
    return p && (p.kind === 'filing' || p.kind === 'results') ? p : null;
  };
  const [shareRoute, setShareRoute] = useState(() => sharePathFor(window.location.pathname));
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        if (pathname === '/announcements') return 'dashboard';
        if (pathname === '/live') return 'dashboard';
        if (pathname === '/results-calendar') return 'results-calendar';
        if (pathname === '/watchlist' || pathname === '/watchlists') return 'watchlists';

        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const hasShared = params.get('text') || params.get('title') || params.get('url') || params.get('q');
        if (hasShared || tab === 'announcements' || tab === 'dashboard') return 'dashboard';
        if (tab === 'watchlist' || tab === 'watchlists') return 'watchlists';
        if (tab === 'results' || tab === 'results-calendar') return 'results-calendar';
        if (tab === 'news') return 'news';
        if (tab === 'settings') return 'settings';
      } catch {}
    }
    return 'home';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.location.hostname && window.location.hostname.indexOf('ai.studio') !== -1) {
        let robotsMeta = document.querySelector('meta[name="robots"]');
        if (robotsMeta) {
          robotsMeta.setAttribute('content', 'noindex, nofollow');
        } else {
          robotsMeta = document.createElement('meta');
          robotsMeta.setAttribute('name', 'robots');
          robotsMeta.setAttribute('content', 'noindex, nofollow');
          document.head.appendChild(robotsMeta);
        }
        window.location.replace('https://bsenexus.in' + window.location.pathname + window.location.search);
        return;
      }
    } catch {}
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/announcement/') && path.includes('batch_test_')) {
      let metaRobots = document.querySelector('meta[name="robots"]');
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.setAttribute('name', 'robots');
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute('content', 'noindex, nofollow');
    }
  }, []);

  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['home', activeTab]));
  const [theme, setTheme] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') || 'dark';
      }
    } catch {}
    return 'dark';
  });
  const [settings, setSettings] = useState<any>({});
  const [logs, setLogs] = useState([]);
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [health, setHealth] = useState({ bse: { status: 'stable', latency: 85 }, telegram: { status: 'connected', latency: 120 } });
  
  const { user, profile, authLoading, isAdmin, isPro, adminUnlocked, logout, 
    setIsAuthModalOpen, setIsProModalOpen, setCheckoutPlanId,
    isAuthModalOpen, isProModalOpen, isAdminPinModalOpen,
    isPaidProActive, updateNotificationPreferences
  } = useAuth();
  const [serverAuth, setServerAuth] = useState<{ isAuthenticated: boolean; hasPin: boolean } | null>(null);

  // Terminal-entry intent: when a logged-out visitor taps "Launch Terminal" (or any
  // terminal entry) on the landing page, we open the auth modal instead of entering
  // silently — guest sessions are ONLY ever created by the dedicated guest button
  // inside that modal. After a successful explicit login, we complete the entry.
  const pendingTerminalTabRef = useRef<string | null>(null);
  const prevAuthModalOpenRef = useRef(false);
  useEffect(() => {
    // If the modal was closed without a successful login, drop the pending intent
    // so a later unrelated sign-in doesn't unexpectedly jump into the terminal.
    if (prevAuthModalOpenRef.current && !isAuthModalOpen && !user) {
      pendingTerminalTabRef.current = null;
    }
    prevAuthModalOpenRef.current = isAuthModalOpen;
  }, [isAuthModalOpen, user]);

  // Apple-Grade Scroll State & Restoration System ("Scroll is state")
  const { restoredInfo, scrollToTop } = useScrollRestoration({
    activeKey: activeTab,
    enabled: true
  });

  const handleTabChange = (newTab: string) => {
    // Watchlist is Pro-only: free users get the upgrade sheet instead (covers
    // deep links, profile-modal shortcut and in-app buttons).
    const canUseWatchlist = Boolean(isPro || isAdmin || adminUnlocked || profile?.tier === 'admin');
    if (newTab === 'watchlists' && !canUseWatchlist) {
      setIsProModalOpen(true);
      return;
    }
    if (newTab === activeTab) {
      // Tap active tab to scroll to top (like iOS / Twitter)
      scrollToTop();
      return;
    }
    if (newTab === 'companies') {
      // Legacy: companies now lives under Settings → BSE Listed Companies.
      window.location.href = '/companies';
      return;
    }
    // Save previous tab scroll position immediately before switching
    saveScrollPosition(activeTab);
    setActiveTab(newTab);

    if (typeof window !== 'undefined') {
      let targetPath = '/';
      switch (newTab) {
        case 'dashboard':
          targetPath = '/announcements';
          break;
        case 'watchlists':
          targetPath = '/watchlist';
          break;
        case 'results-calendar':
          targetPath = '/results-calendar';
          break;
        case 'news':
          targetPath = '/?tab=news';
          break;
        case 'seo-suite':
          targetPath = '/?tab=seo-suite';
          break;
        case 'settings':
          targetPath = '/settings';
          break;
        case 'home':
        default:
          targetPath = '/';
          break;
      }
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  // Check URL query parameters on mount (Share Target API, shortcuts, and deep links)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (pathname === '/announcements') {
        setActiveTab('dashboard');
      } else if (pathname === '/results-calendar') {
        setActiveTab('results-calendar');
      } else if (pathname === '/watchlist' || pathname === '/watchlists') {
        setActiveTab('watchlists');
      } else if (pathname === '/settings') {
        setActiveTab('settings');
      }

      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      const actionParam = searchParams.get('action');
      const sharedTitle = searchParams.get('title') || '';
      const sharedText = searchParams.get('text') || '';
      const sharedUrl = searchParams.get('url') || '';
      const queryParam = searchParams.get('q') || searchParams.get('stock') || searchParams.get('scrip') || '';

      if (actionParam === 'upgrade' || actionParam === 'trial' || actionParam === 'pro') {
        // /pricing deep links pass ?plan=pro_yearly etc. — preselect it in checkout.
        const planParam = searchParams.get('plan');
        if (isValidPlanId(planParam)) setCheckoutPlanId(planParam as string);
        setIsProModalOpen(true);
      }

      if (tabParam) {
        if (tabParam === 'announcements' || tabParam === 'dashboard') {
          setActiveTab('dashboard');
        } else if (tabParam === 'watchlist' || tabParam === 'watchlists') {
          setActiveTab('watchlists');
        } else if (tabParam === 'results' || tabParam === 'results-calendar') {
          setActiveTab('results-calendar');
        } else if (tabParam === 'news') {
          setActiveTab('news');
        } else if (tabParam === 'seo' || tabParam === 'seo-suite' || tabParam === 'superseo') {
          if (isAdmin) {
            setActiveTab('seo-suite');
          }
        } else if (tabParam === 'settings') {
          setActiveTab('settings');
        }
      }

      const combinedShared = [sharedText, sharedTitle, sharedUrl, queryParam].filter(Boolean).join(' ').trim();
      if (combinedShared) {
        setActiveTab('dashboard');
        sessionStorage.setItem('bse_shared_query', combinedShared);
        window.dispatchEvent(new CustomEvent('bse-share-target', {
          detail: { title: sharedTitle, text: sharedText, url: sharedUrl, query: combinedShared }
        }));
      }
    } catch {}

    const handlePopState = () => {
      setCurrentRoute(getAppPathRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronize browser address bar with activeTab navigation without reloading
  const isFirstTabSyncRender = useRef(true);
  useEffect(() => {
    if (isFirstTabSyncRender.current) {
      isFirstTabSyncRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;

    let targetPath = '/';
    switch (activeTab) {
      case 'dashboard':
        // Keep /live stable as the shareable feed URL when the user is on it;
        // otherwise the dashboard tab canonicalizes to /announcements.
        targetPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') === '/live'
          ? '/live'
          : '/announcements';
        break;
      case 'watchlists':
        targetPath = '/watchlist';
        break;
      case 'results-calendar':
        targetPath = '/results-calendar';
        break;
      case 'news':
        targetPath = '/?tab=news';
        break;
      case 'seo-suite':
        targetPath = '/?tab=seo-suite';
        break;
      case 'settings':
        targetPath = '/?tab=settings';
        break;
      case 'home':
      default:
        targetPath = '/';
        break;
    }

    const currentUrl = window.location.pathname + window.location.search;
    if (currentUrl !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [activeTab]);

  // Synchronize activeTab when navigating via browser Back / Forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      try {
        const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        // Shareable filing/results pages survive back/forward navigation as standalone routes.
        const shared = sharePathFor(window.location.pathname);
        setShareRoute(shared);
        if (shared) return;
        if (pathname === '/announcements') {
          setActiveTab('dashboard');
          return;
        }
        if (pathname === '/live') {
          setActiveTab('dashboard');
          return;
        }
        if (pathname === '/results-calendar') {
          setActiveTab('results-calendar');
          return;
        }
        if (pathname === '/watchlist' || pathname === '/watchlists') {
          setActiveTab('watchlists');
          return;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = searchParams.get('tab');

        if (tabParam) {
          if (tabParam === 'announcements' || tabParam === 'dashboard') {
            setActiveTab('dashboard');
          } else if (tabParam === 'watchlist' || tabParam === 'watchlists') {
            setActiveTab('watchlists');
          } else if (tabParam === 'results' || tabParam === 'results-calendar') {
            setActiveTab('results-calendar');
          } else if (tabParam === 'news') {
            setActiveTab('news');
          } else if (tabParam === 'seo' || tabParam === 'seo-suite' || tabParam === 'superseo') {
            if (isAdmin) {
              setActiveTab('seo-suite');
            }
          } else if (tabParam === 'settings') {
            setActiveTab('settings');
          } else {
            setActiveTab('home');
          }
        } else {
          setActiveTab('home');
        }
      } catch {}
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAdmin]);

  useEffect(() => {
    setVisitedTabs(prev => prev.has(activeTab) ? prev : new Set(prev).add(activeTab));
    // Ensure body scroll is unlocked when navigating tabs
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, [activeTab]);

  // When user successfully signs in, immediately navigate inside to the live terminal dashboard
  const prevUserRef = useRef<any>(null);
  useEffect(() => {
    if (user && !prevUserRef.current) {
      setActiveTab(prev => (prev === 'home' ? 'dashboard' : prev));
    }
    prevUserRef.current = user;
  }, [user]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- Design theme: 'classic' (current Helios look) vs 'softglass' (PRO-only) ---
  // DEV-only visual-QA override: ?design=softglass forces the theme without PRO.
  const devDesignOverride: boolean = (() => {
    try {
      return import.meta.env.DEV && new URLSearchParams(window.location.search).get('design') === 'softglass';
    } catch { return false; }
  })();

  const [designTheme, setDesignThemeState] = useState<DesignTheme>(() => {
    try {
      if (typeof window !== 'undefined') {
        if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('design') === 'softglass') return 'softglass';
        const saved = localStorage.getItem('bse_design_theme');
        if (saved === 'softglass' || saved === 'classic') return saved;
      }
    } catch {}
    return 'classic';
  });

  const canUseSoftGlass = devDesignOverride || isPaidProActive;

  const setDesignTheme = useCallback(async (next: DesignTheme): Promise<boolean> => {
    if (next === 'softglass' && !canUseSoftGlass) {
      // PRO gate: trial/free users get the upgrade sheet instead.
      setIsProModalOpen(true);
      return false;
    }
    setDesignThemeState(next);
    try {
      localStorage.setItem('bse_design_theme', next);
      if (user?.uid) localStorage.setItem(`bse_design_theme_${user.uid}`, next);
    } catch {}
    // Cross-device persistence via the profile (fire-and-forget).
    if (user) {
      try { await updateNotificationPreferences({ designTheme: next }); } catch {}
    }
    return true;
  }, [canUseSoftGlass, user, setIsProModalOpen, updateNotificationPreferences]);

  // Apply the theme to <html>. Soft-glass is inherently light: while active the
  // dark class is forced off (the user's dark/light choice is kept and restored
  // when they switch back to Classic).
  useEffect(() => {
    const root = document.documentElement;
    if (designTheme === 'softglass') {
      root.dataset.designTheme = 'softglass';
      root.classList.remove('dark');
    } else {
      delete root.dataset.designTheme;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    }
  }, [designTheme, theme]);

  // Hydrate from the profile (cross-device) once auth resolves, and enforce the
  // PRO gate: a stored softglass choice without active PRO falls back to classic
  // (e.g. subscription expired, or another user on the same device).
  useEffect(() => {
    if (authLoading || devDesignOverride) return;
    const fromProfile = profile?.notificationPreferences?.designTheme;
    let fromLocal: string | null = null;
    try {
      fromLocal = localStorage.getItem(user?.uid ? `bse_design_theme_${user.uid}` : 'bse_design_theme');
    } catch {}
    const valid = (v: unknown): v is DesignTheme => v === 'classic' || v === 'softglass';
    let wanted: DesignTheme = 'classic';
    if (valid(fromProfile)) wanted = fromProfile;
    else if (valid(fromLocal)) wanted = fromLocal;
    if (wanted === 'softglass' && !isPaidProActive) wanted = 'classic';
    if (wanted !== designTheme) {
      setDesignThemeState(wanted);
      try { localStorage.setItem(user?.uid ? `bse_design_theme_${user.uid}` : 'bse_design_theme', wanted); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid, profile?.notificationPreferences?.designTheme, isPaidProActive]);

  const fetchWatchlists = async () => {
    try {
      const res = await customFetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  const checkAuth = async () => {
    try {
      const res = await customFetch('/auth/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setServerAuth(data);
    } catch (e) {
      setServerAuth({ isAuthenticated: false, hasPin: false });
    }
  };

  useEffect(() => {
    checkAuth();
    if (user) {
      fetchWatchlists();
    }
    const handleAuthExpired = () => {
      checkAuth();
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await customFetch('/api/settings');
      if (res.ok) setSettings(await res.json());
    } catch (e) {}
  };

  const isUserAdmin = Boolean(isAdmin || adminUnlocked || user?.isAdmin || profile?.tier === 'admin');

  const fetchLogs = async () => {
    if (!isUserAdmin) return;
    try {
      const res = await customFetch('/api/logs?limit=400');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.bseHealth && data.telegramHealth) {
          setHealth({ bse: data.bseHealth, telegram: data.telegramHealth });
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchSettings();
    fetchWatchlists();
  }, []);

  useEffect(() => {
    if (isUserAdmin) {
      fetchLogs();
    }
  }, [isUserAdmin]);

  // Only poll /api/logs every 20s when the user is admin, with visibility gating
  useVisibilityInterval(fetchLogs, 20000, isUserAdmin);

  const handleLogout = async () => {
    await logout();
    setActiveTab('home');
    checkAuth();
  };

  const handleToggle = async () => {
    await customFetch('/api/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRunning: !settings.isRunning })
    });
    fetchSettings();
  };

  // Render dedicated standalone routes with direct navigation, refresh, and SEO support

  // Leave a shareable page: drop the share route and return to the app home.
  const exitShareRoute = () => {
    window.history.pushState(null, '', '/');
    setShareRoute(null);
    setCurrentRoute('home');
    setActiveTab('home');
    window.scrollTo(0, 0);
  };

  // Shareable filing / results pages — public, standalone, no login to view.
  // Mounted here (before the landing guard) so tab-sync never clobbers the URL,
  // and with NoteEditorHost so Save-note + guest sign-in work outside Layout.
  if (shareRoute?.kind === 'filing') {
    return (
      <>
        <FilingPage onBack={exitShareRoute} />
        <NoteEditorHost />
      </>
    );
  }

  if (shareRoute?.kind === 'results') {
    return (
      <>
        <ResultsPage onBack={exitShareRoute} />
        <NoteEditorHost />
      </>
    );
  }

  if (currentRoute === 'guides') {
    return (
      <>
        <TabErrorBoundary label="guides">
        <Suspense fallback={<TabFallback />}>
          <GuidesPage
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === 'companies') {
    return (
      <>
        <TabErrorBoundary label="companies">
        <Suspense fallback={<TabFallback />}>
          <CompaniesPage
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (
    currentRoute === 'about' ||
    currentRoute === 'contact' ||
    currentRoute === 'privacy' ||
    currentRoute === 'terms' ||
    currentRoute === 'disclaimer'
  ) {
    return (
      <>
        <TabErrorBoundary label="trust-page">
        <Suspense fallback={<TabFallback />}>
          <TrustPage
            type={currentRoute}
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === '404') {
    return (
      <>
        <TabErrorBoundary label="not-found">
        <Suspense fallback={<TabFallback />}>
          <NotFoundPage
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  // If user is not authenticated and on home route ('/'), show LandingPage
  if (!user && activeTab === 'home' && !authLoading) {
    return (
      <>
        <LandingPage
          onEnterTerminal={(tab) => {
            // No silent entry for logged-out visitors: open the auth modal so they
            // explicitly choose Sign in / Create account / Continue as Guest.
            if (!user) {
              pendingTerminalTabRef.current = tab || 'dashboard';
              setIsAuthModalOpen(true);
              return;
            }
            if (tab) {
              const safeTab = (tab === 'diagnostics' || tab === 'logs' || tab === 'storage' || tab === 'seo-suite') && !isAdmin
                ? 'dashboard'
                : tab;
              handleTabChange(safeTab);
            } else {
              setIsAuthModalOpen(true);
            }
          }}
          theme={theme}
          setTheme={setTheme}
          bseHealth={health.bse}
          telegramHealth={health.telegram}
        />
        {isAuthModalOpen && (
          <AuthModal
            onSuccess={() => {
              // Complete the pending terminal entry after an explicit login.
              const t = pendingTerminalTabRef.current;
              pendingTerminalTabRef.current = null;
              if (t) handleTabChange(t);
            }}
          />
        )}
        {isProModalOpen && <ProUpgradeModal />}
        {isAdminPinModalOpen && <AdminPinModal />}
      </>
    );
  }

  // If user is on home route during initial auth evaluation, show LandingPage immediately without blank spinner
  if (!user && activeTab === 'home') {
    return (
      <>
        <LandingPage
          onEnterTerminal={(tab) => {
            // No silent entry for logged-out visitors: open the auth modal so they
            // explicitly choose Sign in / Create account / Continue as Guest.
            if (!user) {
              pendingTerminalTabRef.current = tab || 'dashboard';
              setIsAuthModalOpen(true);
              return;
            }
            if (tab) {
              const safeTab = (tab === 'diagnostics' || tab === 'logs' || tab === 'storage' || tab === 'seo-suite') && !isAdmin
                ? 'dashboard'
                : tab;
              handleTabChange(safeTab);
            } else {
              setIsAuthModalOpen(true);
            }
          }}
          theme={theme}
          setTheme={setTheme}
          bseHealth={health.bse}
          telegramHealth={health.telegram}
        />
        {isAuthModalOpen && (
          <AuthModal
            onSuccess={() => {
              // Complete the pending terminal entry after an explicit login.
              const t = pendingTerminalTabRef.current;
              pendingTerminalTabRef.current = null;
              if (t) handleTabChange(t);
            }}
          />
        )}
        {isProModalOpen && <ProUpgradeModal />}
        {isAdminPinModalOpen && <AdminPinModal />}
      </>
    );
  }

  return (
    <>
      <Layout 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        theme={theme} 
        setTheme={setTheme} 
        onLogout={handleLogout}
        bseHealth={health.bse}
        telegramHealth={health.telegram}
        isRunning={settings.isRunning}
        onToggleEngine={handleToggle}
      >
        {visitedTabs.has('home') && (
          <div className={activeTab === 'home' ? '' : 'hidden'}>
            <HomeForYou onNavigate={(tab) => handleTabChange(tab)} />
          </div>
        )}
        {visitedTabs.has('dashboard') && (
          <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
            <Dashboard 
              bseHealth={health.bse} 
              telegramHealth={health.telegram} 
              isRunning={settings.isRunning} 
              handleToggle={handleToggle} 
            />
          </div>
        )}
        {visitedTabs.has('watchlists') && (
          <div className={activeTab === 'watchlists' ? '' : 'hidden'}>
            <TabErrorBoundary label="watchlists">
            <Suspense fallback={<TabFallback />}>
              <WatchlistManager />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {visitedTabs.has('results-calendar') && (
          <div className={activeTab === 'results-calendar' ? '' : 'hidden'}>
            <TabErrorBoundary label="results-calendar">
            <Suspense fallback={<TabFallback />}>
              <ResultsCalendar />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {visitedTabs.has('news') && (
          <div className={activeTab === 'news' ? '' : 'hidden'}>
            <TabErrorBoundary label="news">
            <Suspense fallback={<TabFallback />}>
              <NewsPortal
                watchlists={watchlists}
                user={user}
                onOpenWatchlists={() => handleTabChange('watchlists')}
                onOpenSettings={() => handleTabChange('settings')}
              />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && visitedTabs.has('seo-suite') && (
          <div className={activeTab === 'seo-suite' ? '' : 'hidden'}>
            <TabErrorBoundary label="seo-suite">
            <Suspense fallback={<TabFallback />}>
              <SeoStudio />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && visitedTabs.has('storage') && (
          <div className={activeTab === 'storage' ? '' : 'hidden'}>
            <TabErrorBoundary label="storage">
            <Suspense fallback={<TabFallback />}>
              <StorageManager />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && visitedTabs.has('diagnostics') && (
          <div className={activeTab === 'diagnostics' ? '' : 'hidden'}>
            <TabErrorBoundary label="diagnostics">
            <Suspense fallback={<TabFallback />}>
              <AdminDiagnostics />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && visitedTabs.has('logs') && (
          <div className={activeTab === 'logs' ? '' : 'hidden'}>
            <TabErrorBoundary label="logs">
            <Suspense fallback={<TabFallback />}>
              <LogsTab logs={logs} onRefreshLogs={fetchLogs} />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {visitedTabs.has('settings') && (
          <div className={activeTab === 'settings' ? '' : 'hidden'}>
            <TabErrorBoundary label="settings" onBack={() => handleTabChange('home')}>
            <Suspense fallback={<TabFallback />}>
              <SettingsTab
                settings={settings}
                setSettings={setSettings}
                fetchSettings={fetchSettings}
                theme={theme}
                setTheme={setTheme}
                designTheme={designTheme}
                setDesignTheme={setDesignTheme}
                canUseSoftGlass={canUseSoftGlass}
                onNavigate={(tab: string) => handleTabChange(tab)}
              />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
      </Layout>

      {/* Floating Reassurance Indicator when restoring scroll position */}
      <ScrollRestoredPill 
        restoredY={restoredInfo?.y ?? null} 
        onScrollToTop={scrollToTop} 
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <IntelModalProvider>
        <NoteEditorProvider>
        <ToastProvider>
          <AppContent />
          <CashfreeReturnHandler />
          <ProCheckoutView />
          <ProReceiptView />
        </ToastProvider>
        </NoteEditorProvider>
      </IntelModalProvider>
    </AuthProvider>
  );
}
