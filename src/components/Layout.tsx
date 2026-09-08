import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Settings, List,
  CalendarDays, Zap, Sparkles, HelpCircle, Scale,
  User, Bell, ShieldAlert, Building2, BookOpen, ShieldCheck,
  AlertTriangle, X, WifiOff, Newspaper, Home, MoreHorizontal,
  Flame, SlidersHorizontal, Database, ChevronRight, Layers, MessageSquare,
  Search, Sun, Moon, RotateCcw
} from 'lucide-react';
import { MarketClock } from './ui/MarketClock';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { MarketTickerTape } from './ui/MarketTickerTape';
import { SyncStatusBadge } from './ui/SyncStatusBadge';
import { ComponentSkeleton } from './ui/ComponentSkeleton';
import { ScrollProgressBar } from './ui/ScrollProgressBar';
import { BackToTop } from './ui/BackToTop';
import { SupportModal } from './ui/SupportFloat';
import { AutosaveIndicator } from './ui/AutosaveIndicator';
import { CommandPalette } from './ui/CommandPalette';
import { useAuth } from '../context/AuthContext';
import { useIntelModal } from '../context/IntelModalContext';
import { customFetch } from '../api';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { springSnappy, springMorph, buttonTap, subtleHover } from '../utils/motionTokens';

import { UserProfileModal } from './UserProfileModal';
import { AuthModal } from './AuthModal';
import { ProUpgradeModal } from './ProUpgradeModal';
import { AdminPinModal } from './AdminPinModal';
import { HelpModal } from './HelpModal';
import { TermsModal } from './TermsModal';
import { NotificationInbox } from './NotificationInbox';
import { AlertRulesModal } from './AlertRulesModal';
import { CompanyIntelligenceModal } from './CompanyIntelligenceModal';
import { TodayMarketStoryModal } from './TodayMarketStoryModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
  onLogout: () => void;
  bseHealth?: { status: string; latency?: number };
  telegramHealth?: { status: string; latency?: number };
  isRunning?: boolean;
  onToggleEngine?: () => void;
}

export function Layout({ 
  children, 
  activeTab, 
  onTabChange, 
  theme, 
  setTheme, 
  bseHealth = { status: 'stable', latency: 85 },
  telegramHealth = { status: 'connected', latency: 120 },
  isRunning = true,
  onToggleEngine
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [hasSeenStory, setHasSeenStory] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const todayKey = `bse_story_viewed_${new Date().toISOString().slice(0, 10)}`;
    return localStorage.getItem(todayKey) === 'true';
  });

  const handleStoryViewed = () => {
    setHasSeenStory(true);
    try {
      const todayKey = `bse_story_viewed_${new Date().toISOString().slice(0, 10)}`;
      localStorage.setItem(todayKey, 'true');
    } catch {
      // Ignore local storage error
    }
  };

  // Advanced Features State
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationInboxOpen, setNotificationInboxOpen] = useState(false);
  const [alertRulesModalOpen, setAlertRulesModalOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [networkDisrupted, setNetworkDisrupted] = useState<boolean>(false);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
  const [quotaBannerDismissed, setQuotaBannerDismissed] = useState<boolean>(false);

  const { isIntelModalOpen, selectedStock, openIntelModal, closeIntelModal } = useIntelModal();

  const { 
    user, 
    profile, 
    isAdmin, 
    isPro, 
    proDaysLeft,
    setIsAuthModalOpen, 
    setIsProModalOpen,
    isAuthModalOpen,
    isProModalOpen,
    isAdminPinModalOpen,
  } = useAuth();

  // Listen to network disruptions
  useEffect(() => {
    const handleNetworkStatus = (e: any) => {
      if (e.detail) {
        setNetworkDisrupted(!e.detail.isOnline);
      }
    };
    window.addEventListener('network-status', handleNetworkStatus);
    const handleOnline = () => setNetworkDisrupted(false);
    const handleOffline = () => setNetworkDisrupted(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('network-status', handleNetworkStatus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkQuotaStatus = async () => {
    try {
      const res = await customFetch('/api/storage/quota-mode');
      if (res.ok) {
        const data = await res.json();
        if (data.isQuotaExceeded) {
          setQuotaExceeded(true);
        } else {
          setQuotaExceeded(false);
        }
      }
    } catch {}
  };

  useEffect(() => {
    checkQuotaStatus();
  }, []);

  useVisibilityInterval(checkQuotaStatus, 30000);

  const fetchUnreadCount = async () => {
    try {
      const res = await customFetch('/api/notifications/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifCount(data.unreadCount || 0);
      }
    } catch {
      // Ignore background errors
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  useVisibilityInterval(fetchUnreadCount, 15000);

  const handleOpenCompanyIntel = (scripCode?: string, symbol?: string, companyName?: string) => {
    openIntelModal({ scripCode, symbol, companyName });
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === 'more') {
      setIsMoreSheetOpen(true);
      return;
    }
    onTabChange(tabId);
  };

  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  useBodyScrollLock(isMoreSheetOpen);

  const renderNavIcon = (itemId: string, isActive: boolean) => {
    if (itemId === 'home') {
      return (
        <Home 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors",
            isActive ? "text-amber-500 fill-amber-500/20" : "text-slate-400 group-hover:text-amber-500"
          )} 
        />
      );
    }

    if (itemId === 'dashboard') {
      return (
        <Flame 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors",
            isActive ? "fill-amber-500 text-amber-500" : "text-slate-400 group-hover:text-amber-500"
          )} 
        />
      );
    }

    if (itemId === 'watchlists') {
      return (
        <div className="w-4 h-4 sm:w-4.5 sm:h-4.5 flex flex-col justify-center gap-[3px] py-0.5">
          <span 
            className={cn(
              "h-[2px] rounded-full transition-all duration-300",
              isActive ? "bg-white w-3.5" : "bg-slate-400 group-hover:bg-slate-600 dark:group-hover:bg-slate-300 w-3"
            )} 
          />
          <span 
            className={cn(
              "h-[2px] rounded-full transition-all duration-300",
              isActive ? "bg-white w-4" : "bg-slate-400 group-hover:bg-slate-600 dark:group-hover:bg-slate-300 w-4"
            )} 
          />
          <span 
            className={cn(
              "h-[2px] rounded-full transition-all duration-300",
              isActive ? "bg-white w-2.5" : "bg-slate-400 group-hover:bg-slate-600 dark:group-hover:bg-slate-300 w-2.5"
            )} 
          />
        </div>
      );
    }

    if (itemId === 'results-calendar') {
      return (
        <div className="relative flex items-center justify-center">
          <div className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-[4px] border flex flex-col overflow-hidden transition-all shadow-2xs",
            isActive 
              ? "bg-white dark:bg-[#222030] border-slate-400 dark:border-[#4A4364] ring-1 ring-slate-300 dark:ring-[#4A4364]" 
              : "bg-white dark:bg-[#1C1A27] border-slate-300 dark:border-[#2D283E]"
          )}>
            <div className={cn("h-1.5 w-full flex items-center justify-center gap-0.5", isActive ? "bg-slate-700 dark:bg-[#3D3754]" : "bg-slate-400 dark:bg-slate-600")}>
              <span className="w-0.5 h-0.5 rounded-full bg-white opacity-80" />
              <span className="w-0.5 h-0.5 rounded-full bg-white opacity-80" />
            </div>
            <div className={cn(
              "flex-1 flex items-center justify-center text-[8px] font-black leading-none",
              isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
            )}>
              {new Date().getDate()}
            </div>
          </div>
        </div>
      );
    }

    if (itemId === 'news') {
      return (
        <Newspaper 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors", 
            isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
          )} 
        />
      );
    }

    if (itemId === 'more') {
      return (
        <MoreHorizontal 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors", 
            isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
          )} 
        />
      );
    }

    if (itemId === 'seo-suite') {
      return (
        <Sparkles 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors", 
            isActive ? "text-amber-400 fill-amber-400/20" : "text-slate-400 group-hover:text-amber-400"
          )} 
        />
      );
    }

    return <Activity className={cn("w-4 h-4 sm:w-4.5 sm:h-4.5", isActive ? "text-white" : "text-slate-400")} />;
  };

  interface NavItem {
    id: string;
    label: string;
    shortLabel: string;
    icon: any;
    badge?: string | number;
  }

  const navItems: NavItem[] = [
    { id: 'home', label: 'For You', shortLabel: 'For You', icon: Home },
    { id: 'dashboard', label: 'Filings', shortLabel: 'Filings', icon: Flame },
    { id: 'watchlists', label: 'My Watchlist', shortLabel: 'Watchlist', icon: List },
    { id: 'results-calendar', label: 'Earnings Calendar', shortLabel: 'Earnings', icon: CalendarDays },
    { id: 'news', label: 'Market News', shortLabel: 'News', icon: Newspaper },
    { id: 'more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
  ];

  // Mobile Bottom Bar: Clean 5 tabs strictly adhering to touch-friendly mobile design
  const mobileNavItems: NavItem[] = [
    { id: 'home', label: 'For You', shortLabel: 'For You', icon: Home },
    { id: 'dashboard', label: 'Filings', shortLabel: 'Filings', icon: Flame },
    { id: 'watchlists', label: 'Watchlist', shortLabel: 'Watchlist', icon: List },
    { id: 'results-calendar', label: 'Earnings', shortLabel: 'Earnings', icon: CalendarDays },
    { id: 'more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#12131C] text-slate-800 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200">
      {/* Accessibility: Skip to main content bypass link for keyboard & screen reader users (WCAG 2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-emerald-600 focus:text-white focus:font-bold focus:text-xs focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Top Main Navigation Bar with Apple Frosted Chrome */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#12131C]/80 backdrop-blur-xl backdrop-saturate-180 border-b border-slate-200/60 dark:border-white/10 shadow-xs transition-colors">
        {/* Item 15: Slim Top Scroll Progress Bar */}
        <ScrollProgressBar />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Row 1: Brand Logo & Right Utility Controls */}
          <div className="flex items-center justify-between h-14 sm:h-12 gap-2 sm:gap-3">
            
            {/* Brand Logo & Title with Circular Story Ring */}
            <div className="flex items-center gap-2 shrink-0 select-none">
              <motion.button 
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={springSnappy}
                onClick={() => setStoryModalOpen(true)}
                className={cn(
                  "relative rounded-full cursor-pointer select-none group shrink-0 transition-all duration-300",
                  hasSeenStory 
                    ? "p-[2px] border-2 border-slate-300/80 dark:border-slate-700/80 shadow-2xs" 
                    : "p-[2.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-500 shadow-xs hover:shadow-md"
                )} 
                aria-label="View Today's Market Story (Daily Highlights)"
                title={hasSeenStory ? "Today's Story (Viewed) • Click to replay" : "View Today's Market Story • Live Highlights"}
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-[#0E0C18] flex items-center justify-center overflow-hidden">
                  <BseNexusLogo className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 transition-transform group-hover:scale-105 shrink-0" />
                </div>
                {/* Live indicator dot - only shown when story is NOT yet viewed */}
                {!hasSeenStory && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#161424] animate-pulse" />
                )}
              </motion.button>

              <div 
                className="flex items-center gap-1.5 cursor-pointer select-none"
                onClick={() => onTabChange('dashboard')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange('dashboard'); }}
                aria-label="BSE Nexus Dashboard"
              >
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white font-display">
                  BSE<span className="text-emerald-500">NEXUS</span>
                </span>
                
                {/* Interactive Story Pill Trigger */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStoryModalOpen(true);
                  }}
                  className={cn(
                    "hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full cursor-pointer transition-all",
                    hasSeenStory
                      ? "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                      : "bg-gradient-to-r from-rose-500/15 via-amber-500/15 to-emerald-500/15 text-rose-600 dark:text-rose-400 border border-rose-300/40 dark:border-rose-500/30"
                  )}
                  title={hasSeenStory ? "Today's Story (Viewed)" : "Today's Market Story • Live Highlights"}
                >
                  {!hasSeenStory && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                  <span>Story</span>
                </motion.button>
              </div>
            </div>

            {/* Right Tools: Status, Clock, Theme, Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Item 1: ⌘K Quick Search Trigger */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="Search companies, filings, commands (Command + K)"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-h-[36px] sm:min-h-[32px]"
                title="Search companies & commands (⌘K)"
              >
                <Search size={14} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-semibold hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-[#352F48] text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300">
                  ⌘K
                </kbd>
              </motion.button>

              {/* Engine Toggle Pill with Live Radar Beacon (Desktop only) */}
              <motion.div 
                whileHover={{ scale: 1.03 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={onToggleEngine}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleEngine?.(); }}
                aria-label={isRunning ? "BSE indexing engine active. Click to pause." : "BSE indexing engine paused. Click to resume."}
                className={cn(
                  "hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-pointer transition-colors shadow-xs shrink-0 select-none min-h-[32px]",
                  isRunning
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950"
                    : "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700/80 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                )}
                title="Click to toggle real-time BSE indexing engine"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  {isRunning && (
                    <motion.span 
                      animate={{ scale: [1, 2, 2.5], opacity: [0.8, 0.4, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute inline-flex h-full w-full rounded-full bg-emerald-400" 
                    />
                  )}
                  <span className={cn("relative inline-flex rounded-full h-2 w-2", isRunning ? "bg-emerald-500" : "bg-amber-500")} />
                </span>
                <span className="whitespace-nowrap">{isRunning ? "Active" : "Paused"}</span>
              </motion.div>

              {/* Item 6: Autosave Status Indicator */}
              <AutosaveIndicator className="hidden xl:inline-flex" />

              {/* Sync Status Badge (Desktop large screens) */}
              <SyncStatusBadge className="hidden xl:inline-flex" />

              {/* Realtime Market Clock - Visible on laptops and desktops (>= 1024px) */}
              <MarketClock className="hidden lg:flex shrink-0" />

              {/* Passive Alerts Status & In-App Notification Bell */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setNotificationInboxOpen(true)}
                aria-label={unreadNotifCount > 0 ? `In-app notifications (${unreadNotifCount} unread)` : "In-app notifications"}
                className="relative flex items-center justify-center p-2 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-h-[36px] sm:min-h-[32px] min-w-[36px] sm:min-w-auto"
                title="In-App Notifications & Alerts"
              >
                <Bell size={15} className="text-slate-600 dark:text-slate-300 shrink-0" />
                <span className="hidden sm:inline text-xs font-semibold">Alerts</span>
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 sm:static sm:top-auto sm:right-auto flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-slate-900 dark:bg-white text-[9px] font-bold text-white dark:text-slate-900 leading-none">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </motion.button>

              {/* Item 9: Quick Sun/Moon Dark Mode Toggle - Hidden on Settings tab to prevent duplicate appearance controls */}
              {activeTab !== 'settings' && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="flex items-center justify-center p-2 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-w-[36px] sm:min-w-[32px] min-h-[36px] sm:min-h-[32px]"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? (
                    <Sun size={15} className="text-amber-400" />
                  ) : (
                    <Moon size={15} className="text-slate-600" />
                  )}
                </motion.button>
              )}

              {/* Dedicated Settings Gear Icon - Visible on tablet/desktop */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => onTabChange('settings')}
                aria-label="Open Settings and Preferences"
                className="hidden md:flex items-center justify-center p-2 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-w-[32px] min-h-[32px]"
                title="Open Settings & Preferences"
              >
                <Settings size={15} className="text-slate-600 dark:text-slate-300" />
              </motion.button>

              {/* Pro Upgrade Quick Button for Free/Guest Users */}
              {!isPro && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => (!user || user.isAnonymous) ? setIsAuthModalOpen(true) : setIsProModalOpen(true)}
                  aria-label="30-Day Free Pro with Google Login"
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold shadow-xs cursor-pointer shrink-0 min-h-[32px]"
                  title="Sign in with Google to get 30 Days Free Pro Trial"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>30D Free Pro</span>
                </motion.button>
              )}

              {/* Circular User Avatar Button - Round shape, initial only ('G' or initial), story-ready */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => (user || profile ? setProfileModalOpen(true) : setIsAuthModalOpen(true))}
                aria-label={user || profile ? `User: ${profile?.displayName || 'Guest User'}` : 'Guest Profile & Sign In'}
                className={cn(
                  "relative w-8.5 h-8.5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center cursor-pointer select-none shrink-0 transition-all",
                  "p-[2px] bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 shadow-xs hover:shadow-md"
                )}
                title={user || profile ? `${profile?.displayName || 'User'} (${isAdmin ? 'Admin' : isPro ? 'Pro' : 'Guest'})` : 'Guest / Sign In'}
              >
                <div className="w-full h-full rounded-full bg-white dark:bg-[#1E1B2E] flex items-center justify-center overflow-hidden">
                  {profile?.photoURL ? (
                    <img 
                      src={profile.photoURL} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 select-none">
                      {((user?.isAnonymous || (!user && !profile)) 
                        ? 'G' 
                        : (profile?.displayName || profile?.email || 'U')).charAt(0)}
                    </span>
                  )}
                </div>

                {/* Story ready indicator status badge */}
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1E1B2E]",
                  isAdmin ? "bg-purple-500" : isPro ? "bg-emerald-500" : "bg-emerald-400"
                )} />
              </motion.button>
            </div>
          </div>

          {/* Row 2: Clean Tabs Navigation Bar with Fluid FLIP Floating Pill */}
          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-1 pb-2 pt-1 border-t border-slate-100 dark:border-[#2D283E]/60 overflow-x-auto no-scrollbar relative">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  whileHover={subtleHover}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "group relative flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg whitespace-nowrap select-none cursor-pointer z-10 transition-colors",
                    isActive
                      ? "text-white font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                  )}
                >
                  {/* Floating active background pill */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavTabPill"
                      transition={springSnappy}
                      className="absolute inset-0 bg-slate-900 dark:bg-[#262335] rounded-lg shadow-xs border border-slate-900/10 dark:border-[#3C3652] -z-10"
                    />
                  )}

                  {renderNavIcon(item.id, isActive)}
                  <span className="relative z-10">{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      "text-[8.5px] font-bold px-1.5 py-0.2 rounded-full relative z-10",
                      isActive
                        ? "bg-white/20 text-white dark:bg-white/15"
                        : "bg-slate-200 dark:bg-[#252233] text-slate-600 dark:text-slate-400"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Dropdown Menu with AnimatePresence */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springMorph}
              className="md:hidden border-t border-slate-200 dark:border-[#2D283E] bg-white dark:bg-[#1A1926] px-4 pt-2 pb-4 space-y-1 overflow-hidden"
            >
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    whileTap={buttonTap}
                    onClick={() => {
                      handleTabClick(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-slate-900 text-white dark:bg-[#2A263D] dark:text-white font-bold shadow-xs border border-slate-900/10 dark:border-[#423A5B]"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#222030] font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {renderNavIcon(item.id, isActive)}
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-[#252233] text-slate-600 dark:text-slate-400"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}

              {!isPro && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsProModalOpen(true);
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#252233] dark:hover:bg-[#302B42] text-white rounded-lg text-xs font-bold border border-slate-700/60 dark:border-[#3E3854] shadow-2xs"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Pro Features (100% Free)</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Network Offline Notice */}
      <AnimatePresence>
        {networkDisrupted && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springMorph}
            className="bg-rose-500/10 border-b border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs px-4 py-2 flex items-center justify-between z-30 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Connection offline. Viewing cached BSE filings.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (navigator.onLine) {
                  setNetworkDisrupted(false);
                } else {
                  customFetch('/api/health').then(() => setNetworkDisrupted(false)).catch(() => {});
                }
              }}
              className="px-2.5 py-0.5 rounded-md bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 cursor-pointer transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage Quota Alert Banner */}
      <AnimatePresence>
        {quotaExceeded && !quotaBannerDismissed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springMorph}
            role="status"
            aria-live="polite"
            className="bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs px-4 py-2 flex items-center justify-between z-30 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Cloud storage limit reached — changes are currently cached locally and synced seamlessly.</span>
            </div>
            <button 
              onClick={() => setQuotaBannerDismissed(true)} 
              aria-label="Dismiss cloud storage notice"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Market Ticker Tape - Responsive for Mobile and Desktop */}
      <MarketTickerTape bseLatency={bseHealth?.latency || 85} />

      {/* Main Content Area with Smooth Layout Transition and Keyboard Focus Target */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 pb-24 md:pb-6 transition-all duration-200 focus:outline-none">
        {children}
      </main>

      {/* App-Style Bottom Navigation Dock for Mobile (Always Visible & Intuitive with FLIP indicator) */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1A1926]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-[#2D283E] py-1 px-1 sm:px-2 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-around gap-1">
          {mobileNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.95 }}
                transition={springSnappy}
                onClick={() => handleTabClick(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 min-h-[48px] py-1.5 px-0.5 rounded-xl cursor-pointer select-none touch-manipulation",
                  isActive
                    ? "text-slate-900 dark:text-white font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-all relative flex items-center justify-center min-w-[32px] min-h-[32px]",
                  isActive && "bg-slate-100 dark:bg-[#282438] text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-[#3D3754]"
                )}>
                  {renderNavIcon(item.id, isActive)}
                  {item.id === 'dashboard' && isRunning && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  )}
                  {item.badge && item.id !== 'dashboard' && (
                    <span className="absolute -top-1 -right-1 text-[8px] font-bold px-1 rounded-full text-white leading-tight bg-slate-700 dark:bg-[#3D3754]">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
                  {item.shortLabel || item.label}
                </span>
                {isActive && (
                  <motion.span 
                    layoutId="mobileNavActivePill"
                    transition={springSnappy}
                    className="w-4 h-0.5 rounded-full mt-0.5 bg-slate-900 dark:bg-slate-200" 
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* More Bottom Sheet / Drawer Modal */}
      <AnimatePresence>
        {isMoreSheetOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-options-title"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreSheetOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springSnappy}
              className="relative w-full max-w-lg bg-white dark:bg-[#181624] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl overflow-hidden z-10 p-5 space-y-4 overscroll-contain"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2D283E] pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-slate-500 dark:text-slate-400" />
                  <h3 id="more-options-title" className="text-base font-black text-slate-900 dark:text-white font-display">
                    More Options & Tools
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreSheetOpen(false)}
                  aria-label="Close options sheet"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 select-none">
                {/* Market News */}
                <motion.button
                  type="button"
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => {
                    onTabChange('news');
                    setIsMoreSheetOpen(false);
                  }}
                  className="min-h-[48px] p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#201E2E] dark:hover:bg-[#2A263D] border border-slate-200/80 dark:border-[#352F48] flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <Newspaper size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Market News Feed</div>
                      <div className="text-[10px] text-slate-400">Live Indian business & macro news</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </motion.button>


                {/* Alert Rules & Triggers */}
                <motion.button
                  type="button"
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => {
                    setAlertRulesModalOpen(true);
                    setIsMoreSheetOpen(false);
                  }}
                  className="min-h-[48px] p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#201E2E] dark:hover:bg-[#2A263D] border border-slate-200/80 dark:border-[#352F48] flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Bell size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Alerts & Triggers</div>
                      <div className="text-[10px] text-slate-400">Keyword & filing filters</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </motion.button>

                {/* Settings & Preferences */}
                <motion.button
                  type="button"
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => {
                    onTabChange('settings');
                    setIsMoreSheetOpen(false);
                  }}
                  className="min-h-[48px] p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#201E2E] dark:hover:bg-[#2A263D] border border-slate-200/80 dark:border-[#352F48] flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                      <Settings size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Settings & Preferences</div>
                      <div className="text-[10px] text-slate-400">Telegram, audio & theme</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </motion.button>

                {/* Help & User Guides */}
                <motion.button
                  type="button"
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => {
                    setHelpModalOpen(true);
                    setIsMoreSheetOpen(false);
                  }}
                  className="min-h-[48px] p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#201E2E] dark:hover:bg-[#2A263D] border border-slate-200/80 dark:border-[#352F48] flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                      <HelpCircle size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Help & User Guides</div>
                      <div className="text-[10px] text-slate-400">SEBI LODR & disclosure guides</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </motion.button>

                {/* Feedback & Support */}
                <motion.button
                  type="button"
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => {
                    setSupportModalOpen(true);
                    setIsMoreSheetOpen(false);
                  }}
                  className="min-h-[48px] p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#201E2E] dark:hover:bg-[#2A263D] border border-slate-200/80 dark:border-[#352F48] flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Feedback & Support</div>
                      <div className="text-[10px] text-slate-400">Direct assistance, Telegram & feedback</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </motion.button>

                {/* Admin Exclusive Controls (only visible to unlocked admins) */}
                {isAdmin && (
                  <>
                    {/* Storage & Cloud Sync (Admin Only) */}
                    <motion.button
                      type="button"
                      whileTap={buttonTap}
                      transition={springSnappy}
                      onClick={() => {
                        onTabChange('storage');
                        setIsMoreSheetOpen(false);
                      }}
                      className="min-h-[48px] p-3 rounded-xl bg-purple-50/70 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-between text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                          <Database size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-purple-700 dark:text-purple-300">Storage Manager & Sync</div>
                          <div className="text-[10px] text-slate-400">Firestore database, backups & cache</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-purple-400" />
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={buttonTap}
                      transition={springSnappy}
                      onClick={() => {
                        onTabChange('diagnostics');
                        setIsMoreSheetOpen(false);
                      }}
                      className="min-h-[48px] p-3 rounded-xl bg-purple-50/70 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-between text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-purple-700 dark:text-purple-300">System Diagnostics</div>
                          <div className="text-[10px] text-slate-400">Admin health checks & telemetry</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-purple-400" />
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={buttonTap}
                      transition={springSnappy}
                      onClick={() => {
                        onTabChange('logs');
                        setIsMoreSheetOpen(false);
                      }}
                      className="min-h-[48px] p-3 rounded-xl bg-purple-50/70 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-between text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                          <Activity size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-purple-700 dark:text-purple-300">Engine Activity Logs</div>
                          <div className="text-[10px] text-slate-400">Live background stream & AI</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-purple-400" />
                    </motion.button>

                    {/* Super SEO Suite (Admin Exclusive) */}
                    <motion.button
                      type="button"
                      whileTap={buttonTap}
                      transition={springSnappy}
                      onClick={() => {
                        onTabChange('seo-suite');
                        setIsMoreSheetOpen(false);
                      }}
                      className="min-h-[48px] p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-between text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-amber-700 dark:text-amber-300">Super SEO Suite (11 Skills)</div>
                          <div className="text-[10px] text-slate-400">Page audits, EEAT, snippets & anti-slop engine</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-amber-400" />
                    </motion.button>
                  </>
                )}
              </div>

              {/* Bottom Helpers: Terms & SEBI */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#2D283E] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="text-[11px]">BSENEXUS v2.5.0</span>
                <button
                  type="button"
                  onClick={() => {
                    setTermsModalOpen(true);
                    setIsMoreSheetOpen(false);
                  }}
                  className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <Scale size={14} />
                  <span>SEBI & Legal Disclaimer</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Modals */}
      {isAuthModalOpen && <AuthModal />}
      {isProModalOpen && <ProUpgradeModal />}
      {isAdminPinModalOpen && <AdminPinModal />}
      {profileModalOpen && (
        <UserProfileModal 
          isOpen={profileModalOpen} 
          onClose={() => setProfileModalOpen(false)}
          onOpenSettings={() => onTabChange('settings')}
          onOpenWatchlist={() => onTabChange('watchlists')}
          onOpenAlertRules={() => setAlertRulesModalOpen(true)}
          onOpenHelp={() => setHelpModalOpen(true)}
          onOpenTerms={() => setTermsModalOpen(true)}
        />
      )}
      {helpModalOpen && (
        <HelpModal 
          isOpen={helpModalOpen} 
          onClose={() => setHelpModalOpen(false)}
          onOpenSettings={() => onTabChange('settings')}
        />
      )}
      {supportModalOpen && (
        <SupportModal
          isOpen={supportModalOpen}
          onClose={() => setSupportModalOpen(false)}
          onOpenHelp={() => {
            setSupportModalOpen(false);
            setHelpModalOpen(true);
          }}
        />
      )}
      {storyModalOpen && (
        <TodayMarketStoryModal
          isOpen={storyModalOpen}
          onClose={() => setStoryModalOpen(false)}
          onStoryViewed={handleStoryViewed}
          onOpenCompanyIntel={handleOpenCompanyIntel}
        />
      )}
      {termsModalOpen && (
        <TermsModal 
          isOpen={termsModalOpen} 
          onClose={() => setTermsModalOpen(false)}
        />
      )}
      {notificationInboxOpen && (
        <NotificationInbox
          isOpen={notificationInboxOpen}
          onClose={() => setNotificationInboxOpen(false)}
          onOpenCompanyIntel={handleOpenCompanyIntel}
          onOpenAlertRules={() => {
            setNotificationInboxOpen(false);
            setAlertRulesModalOpen(true);
          }}
          unreadCount={unreadNotifCount}
          onRefreshCount={fetchUnreadCount}
        />
      )}
      {alertRulesModalOpen && (
        <AlertRulesModal
          isOpen={alertRulesModalOpen}
          onClose={() => setAlertRulesModalOpen(false)}
        />
      )}
      {isIntelModalOpen && (
        <CompanyIntelligenceModal
          isOpen={isIntelModalOpen}
          onClose={closeIntelModal}
          scripCode={selectedStock.scripCode}
          symbol={selectedStock.symbol}
          companyName={selectedStock.companyName}
        />
      )}

      {/* Reconnecting / Network Interruption Banner */}
      <AnimatePresence>
        {networkDisrupted && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={springMorph}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-600 dark:bg-amber-700 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-bold"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>⚠️ Network connection lost. Reconnecting to BSE Nexus live stream...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Compact Footer with Quick Help & Terms */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0F172A] py-4 text-xs text-slate-500 dark:text-slate-400 pb-16 md:pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">BSE Nexus Active</span>
            <span>• Continuous BSE India Disclosure Poller & AI Engine</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setHelpModalOpen(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <HelpCircle size={13} />
              <span>Help & Guides</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setSupportModalOpen(true)}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <MessageSquare size={13} />
              <span>Support</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setTermsModalOpen(true)}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <Scale size={13} />
              <span>Terms & SEBI Disclaimer</span>
            </motion.button>

            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            <span className="hidden sm:inline">Latency: ~{bseHealth.latency || 85}ms</span>
          </div>
        </div>
      </footer>

      {/* Item 12: Tactile Floating Back to Top with Scroll Progress Ring */}
      <BackToTop />

      {/* Item 1: Global ⌘K Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        activeTab={activeTab}
        onTabChange={onTabChange}
        theme={theme}
        setTheme={setTheme}
        isRunning={isRunning}
        onToggleEngine={onToggleEngine}
        isAdmin={isAdmin}
      />
    </div>
  );
}

