import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IntelModalProvider } from './context/IntelModalContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { customFetch } from './api';
import { verifyProPayment, clearPendingOrderId } from './utils/cashfree';
import { useVisibilityInterval } from './hooks/useVisibilityInterval';

import { LandingPage } from './components/LandingPage';
import { Layout } from './components/Layout';
import Announcements from './components/Announcements';
import { AuthModal } from './components/AuthModal';
import { ProUpgradeModal } from './components/ProUpgradeModal';
import { ProCheckoutView } from './components/ProCheckoutView';
import { ProReceiptView } from './components/ProReceiptView';
import { AdminPinModal } from './components/AdminPinModal';
import { HomeForYou } from './components/HomeForYou';
import { WatchlistManager } from './components/WatchlistManager';
import { ResultsCalendar } from './components/ResultsCalendar';
import { NewsPortal } from './components/NewsPortal';
import { StorageManager } from './components/StorageManager';
import { AdminDiagnostics } from './components/AdminDiagnostics';
import { LogsTab } from './components/LogsTab';
import { SettingsTab } from './components/SettingsTab';
import { SeoStudio } from './components/seo/SeoStudio';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { ScrollRestoredPill } from './components/ui/ScrollRestoredPill';
import { saveScrollPosition } from './utils/scrollState';
import { GuidesPage } from './components/GuidesPage';
import { CompaniesPage } from './components/CompaniesPage';
import { TrustPage } from './components/TrustPages';
import { NotFoundPage } from './components/NotFoundPage';

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
  const { user, refreshProfile, setReceipt } = useAuth();
  const { success, warning } = useToast();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let orderId: string | null = null;
    try {
      orderId = new URLSearchParams(window.location.search).get('cf_order_id');
    } catch { return; }
    if (!orderId || handledRef.current === orderId) return;
    // The order was created by a logged-in uid; wait until that session is
    // back before verifying (the uid in the JWT must match the order owner).
    if (!user) return;
    handledRef.current = orderId;
    (async () => {
      const v = await verifyProPayment(orderId as string);
      clearPendingOrderId();
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('cf_order_id');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch { /* non-fatal */ }
      if (v.paid) {
        await refreshProfile();
        // Open the receipt screen instead of a plain toast.
        if (v.receipt) {
          setReceipt(v.receipt);
        } else {
          success('Pro activated — your 30-day Pro pack is live. Welcome!');
        }
      } else {
        warning(v.error || 'Payment not confirmed yet. If money was debited, it will reflect shortly.');
      }
    })();
  }, [user]);

  return null;
}

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<'home' | 'pricing' | 'guides' | 'companies' | 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer' | '404'>(() => getAppPathRoute());
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
  
  const { user, profile, authLoading, isAdmin, adminUnlocked, logout, 
    setIsAuthModalOpen, setIsProModalOpen,
    isAuthModalOpen, isProModalOpen, isAdminPinModalOpen 
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
    if (newTab === activeTab) {
      // Tap active tab to scroll to top (like iOS / Twitter)
      scrollToTop();
      return;
    }
    if (newTab === 'companies') {
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

  if (currentRoute === 'guides') {
    return (
      <>
        <GuidesPage
          onEnterTerminal={(tab) => {
            setCurrentRoute('home');
            if (tab) handleTabChange(tab);
            else setIsAuthModalOpen(true);
          }}
        />
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === 'companies') {
    return (
      <>
        <CompaniesPage
          onEnterTerminal={(tab) => {
            setCurrentRoute('home');
            if (tab) handleTabChange(tab);
            else setIsAuthModalOpen(true);
          }}
        />
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
        <TrustPage
          type={currentRoute}
          onEnterTerminal={(tab) => {
            setCurrentRoute('home');
            if (tab) handleTabChange(tab);
            else setIsAuthModalOpen(true);
          }}
        />
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === '404') {
    return (
      <>
        <NotFoundPage
          onEnterTerminal={(tab) => {
            setCurrentRoute('home');
            if (tab) handleTabChange(tab);
            else setIsAuthModalOpen(true);
          }}
        />
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
            <WatchlistManager />
          </div>
        )}
        {visitedTabs.has('results-calendar') && (
          <div className={activeTab === 'results-calendar' ? '' : 'hidden'}>
            <ResultsCalendar />
          </div>
        )}
        {visitedTabs.has('news') && (
          <div className={activeTab === 'news' ? '' : 'hidden'}>
            <NewsPortal 
              watchlists={watchlists} 
              user={user} 
              onOpenWatchlists={() => handleTabChange('watchlists')}
              onOpenSettings={() => handleTabChange('settings')}
            />
          </div>
        )}
        {isAdmin && visitedTabs.has('seo-suite') && (
          <div className={activeTab === 'seo-suite' ? '' : 'hidden'}>
            <SeoStudio />
          </div>
        )}
        {isAdmin && visitedTabs.has('storage') && (
          <div className={activeTab === 'storage' ? '' : 'hidden'}>
            <StorageManager />
          </div>
        )}
        {isAdmin && visitedTabs.has('diagnostics') && (
          <div className={activeTab === 'diagnostics' ? '' : 'hidden'}>
            <AdminDiagnostics />
          </div>
        )}
        {isAdmin && visitedTabs.has('logs') && (
          <div className={activeTab === 'logs' ? '' : 'hidden'}>
            <LogsTab logs={logs} onRefreshLogs={fetchLogs} />
          </div>
        )}
        {visitedTabs.has('settings') && (
          <div className={activeTab === 'settings' ? '' : 'hidden'}>
            <SettingsTab 
              settings={settings} 
              setSettings={setSettings} 
              fetchSettings={fetchSettings} 
              theme={theme} 
              setTheme={setTheme} 
              onNavigate={(tab: string) => handleTabChange(tab)}
            />
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
        <ToastProvider>
          <AppContent />
          <CashfreeReturnHandler />
          <ProCheckoutView />
          <ProReceiptView />
        </ToastProvider>
      </IntelModalProvider>
    </AuthProvider>
  );
}
