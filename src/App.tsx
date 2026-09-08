import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IntelModalProvider } from './context/IntelModalContext';
import { ToastProvider } from './context/ToastContext';
import { customFetch } from './api';
import { useVisibilityInterval } from './hooks/useVisibilityInterval';

import { LandingPage } from './components/LandingPage';
import { Layout } from './components/Layout';
import Announcements from './components/Announcements';
import { AuthModal } from './components/AuthModal';
import { ProUpgradeModal } from './components/ProUpgradeModal';
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

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
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
  
  const { 
    user, profile, authLoading, isAdmin, adminUnlocked, logout, 
    setIsAuthModalOpen, 
    isAuthModalOpen, isProModalOpen, isAdminPinModalOpen 
  } = useAuth();
  const [serverAuth, setServerAuth] = useState<{ isAuthenticated: boolean; hasPin: boolean } | null>(null);

  // Check URL query parameters on mount (Share Target API, shortcuts, and deep links)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      const sharedTitle = searchParams.get('title') || '';
      const sharedText = searchParams.get('text') || '';
      const sharedUrl = searchParams.get('url') || '';
      const queryParam = searchParams.get('q') || searchParams.get('stock') || searchParams.get('scrip') || '';

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
  }, []);

  useEffect(() => {
    setVisitedTabs(prev => prev.has(activeTab) ? prev : new Set(prev).add(activeTab));
    // Ensure body scroll is unlocked when navigating tabs
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, [activeTab]);

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
      const res = await fetch('/auth/status');
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

  // If user is not authenticated, strictly show Home Overview landing page IMMEDIATELY
  // with zero delay for instant First Contentful Paint & Core Web Vitals optimization
  if (!user) {
    return (
      <>
        <LandingPage
          onEnterTerminal={(tab) => {
            if (tab) {
              setActiveTab(tab);
            }
            setIsAuthModalOpen(true);
          }}
          theme={theme}
          setTheme={setTheme}
          bseHealth={health.bse}
          telegramHealth={health.telegram}
        />
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
        {isAdminPinModalOpen && <AdminPinModal />}
      </>
    );
  }

  // Only show the terminal loader if user has entered the terminal and auth is actively syncing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0D0C15] flex flex-col items-center justify-center p-6 select-none transition-colors">
        <div className="w-full max-w-xs flex flex-col items-center space-y-5 text-center">
          {/* Logo badge with spinning emerald ring */}
          <div className="relative flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] shadow-sm flex items-center justify-center">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                BSE
              </span>
            </div>
            <div className="absolute -inset-2 border-2 border-emerald-500/20 border-t-emerald-500 rounded-2xl animate-spin" />
          </div>

          {/* App title and pulsating status */}
          <div className="space-y-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              BSE Nexus Terminal
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium animate-pulse">
              Authenticating secure session...
            </p>
          </div>

          {/* Clean loading skeleton placeholders */}
          <div className="w-full space-y-2 pt-2">
            <div className="h-2.5 w-3/4 mx-auto bg-slate-200/80 dark:bg-[#201E2E] rounded-full animate-pulse" />
            <div className="h-2 w-1/2 mx-auto bg-slate-200/60 dark:bg-[#201E2E]/60 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab} 
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
          <HomeForYou onNavigate={(tab) => setActiveTab(tab)} />
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
                onOpenWatchlists={() => setActiveTab('watchlists')}
                onOpenSettings={() => setActiveTab('settings')}
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
                onNavigate={(tab: string) => setActiveTab(tab)}
              />
            </div>
          )}
      </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <IntelModalProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </IntelModalProvider>
    </AuthProvider>
  );
}
