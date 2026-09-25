import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { customFetch } from '../api';
import { 
  FileText, ExternalLink, Search, Send, Clock, 
  Upload, Sparkles, ArrowUpRight, CheckCircle2, 
  TrendingUp, Building2, ChevronRight, ChevronDown, Info, X, RefreshCw,
  Layers, Zap, Copy, Check, Flame, Bot, Share2,
  VolumeX, Moon, BarChart2,
  LayoutGrid, List, Bookmark, SlidersHorizontal, Sliders
} from 'lucide-react';
import { useDeveloperMode } from '../utils/developerMode';
import { CustomDropdown } from './ui/CustomDropdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatFullDateTime, formatShortDateTime, formatTimeOnly, formatDateOnly, formatCleanDateTime, formatCleanTime, formatFilingRelativeTime } from '../utils/timeFormat';
import { cleanBseSubject } from '../utils/cleanBseSubject';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { useAuth } from '../context/AuthContext';
import { useIntelModal } from '../context/IntelModalContext';
import { useAiQuota, syncQuotaFromResponse } from '../utils/aiQuota';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { PullToRefreshIndicator } from './ui/PullToRefreshIndicator';
import { ActionButton } from './ui/ActionButton';
import { clusterAnnouncements, AnnouncementCluster } from '../utils/clusterAnnouncements';
import { detectFilingType, getMutedTypes, saveMutedTypes, getMutedCompanies, saveMutedCompanies } from '../utils/noiseFilter';
import { getCacheItem, setCacheItem } from '../utils/cache';
import { 
  springStandard, 
  springSnappy, 
  springMorph, 
  springBouncy,
  springSmoothPill,
  containerStaggerVariants, 
  itemFadeUpVariants, 
  buttonTap, 
  subtleHover, 
  accordionTransition, 
  modalBackdropVariants 
} from '../utils/motionTokens';
import { AiSummaryViewer } from './AiSummaryViewer';
import { WatchlistStarButton } from './ui/motion/WatchlistStarButton';
import { ShareActionMenu } from './ui/motion/ShareActionMenu';
import { RollingNumber } from './ui/motion/RollingNumber';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TELEGRAM_SUCCESS_MESSAGES = [
  "🚀 Rocket Dispatched! Live BSE filing shot straight into your Telegram channel.",
  "⚡ Instant Delivery! Realtime corporate alert beamed to your subscribers.",
  "📈 Market Alpha Delivered! Your Telegram channel received the latest corporate intelligence.",
  "✨ Bullseye! Full Gemini synopsis and official BSE PDF link published.",
  "💎 Precision Broadcast! Fast-track corporate disclosure delivered to your audience.",
  "🔥 Breaking Alert! Telegram community updated with zero latency.",
  "🎯 Target Acquired! Instant corporate filing notification forwarded successfully.",
  "⚡ Quantum Speed! Corporate filing broadcasted seamlessly to Telegram."
];

const AI_THINKING_STEPS = [
  "Reading official BSE corporate disclosure...",
  "Gemini neural model analyzing key revenue & metric points...",
  "Filtering corporate noise and extracting financial impact...",
  "Synthesizing high-impact executive highlights..."
];

export interface AnnouncementsProps {
  bseHealth?: { status?: string; latency?: number };
  telegramHealth?: { status?: string; latency?: number };
  isRunning?: boolean;
  onToggleEngine?: () => void;
}

export function Announcements({
  bseHealth: propBseHealth,
  telegramHealth: propTelegramHealth,
  isRunning: propIsRunning,
  onToggleEngine: propOnToggleEngine
}: AnnouncementsProps = {}) {
  const { user, profile, isAdmin, isPro, adminUnlocked, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const { isDeveloperMode } = useDeveloperMode();
  const { openIntelModal } = useIntelModal();

  // SWR: Initialize announcements immediately from client cache to achieve 0ms initial paint
  const [announcements, setAnnouncements] = useState<any[]>(() => {
    const cached = getCacheItem<any[]>('announcements_feed', 5 * 60 * 1000);
    if (cached && cached.length > 0) return cached;
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedText = urlParams.get('text') || urlParams.get('title') || urlParams.get('url') || urlParams.get('q') || urlParams.get('stock') || urlParams.get('scrip') || '';
        if (sharedText) return sharedText.trim();
        const stored = sessionStorage.getItem('bse_shared_query');
        if (stored) {
          sessionStorage.removeItem('bse_shared_query');
          return stored.trim();
        }
      } catch {}
    }
    return '';
  });

  // Listen to incoming share target events
  useEffect(() => {
    const handleShareTarget = (e: any) => {
      if (e.detail?.query) {
        setSearch(e.detail.query);
      }
    };
    window.addEventListener('bse-share-target', handleShareTarget);
    return () => window.removeEventListener('bse-share-target', handleShareTarget);
  }, []);

  // Deep Link listener: Auto-select and display announcement if shared link (?announcement=:id or ?id=:id) is opened
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const annId = urlParams.get('announcement') || urlParams.get('id');
      if (annId) {
        const found = announcements.find(a => (a.id || a.newsId) === annId);
        if (found) {
          setSelectedItem(found);
          if (window.innerWidth < 1024) setIsMobileDetailOpen(true);
        } else if (announcements.length > 0) {
          customFetch(`/api/announcements/${encodeURIComponent(annId)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data && (data.id || data.newsId)) {
                setAnnouncements(prev => [data, ...prev.filter(p => (p.id || p.newsId) !== (data.id || data.newsId))]);
                setSelectedItem(data);
                if (window.innerWidth < 1024) setIsMobileDetailOpen(true);
              }
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, [announcements.length]);

  const [filterType, setFilterType] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isSmartClustering, setIsSmartClustering] = useState<boolean>(true);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isStatusExpanded, setIsStatusExpanded] = useState<boolean>(false);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);

  // Responsive View Mode (Grid on PC / Large screen, List on Mobile by default, user-customizable)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('nexus_announcements_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
      return typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('nexus_announcements_view_mode', mode);
    } catch {}
  };

  // Creative Feature 1: "Since you last checked" Divider
  const [lastCheckedTime, setLastCheckedTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('nexus_last_checked_ts');
      return saved ? Number(saved) : Date.now() - 45 * 60 * 1000;
    } catch {
      return Date.now() - 45 * 60 * 1000;
    }
  });
  const [isNewDividerDismissed, setIsNewDividerDismissed] = useState<boolean>(false);

  // Creative Feature 2: Density toggle (Comfortable | Compact | Dense Bloomberg mode)
  const [density, setDensity] = useState<'comfortable' | 'compact' | 'dense'>(() => {
    try {
      const saved = localStorage.getItem('nexus_feed_density');
      return (saved === 'comfortable' || saved === 'dense') ? saved : 'compact';
    } catch {
      return 'compact';
    }
  });

  const handleSetDensity = (newDensity: 'comfortable' | 'compact' | 'dense') => {
    setDensity(newDensity);
    try {
      localStorage.setItem('nexus_feed_density', newDensity);
    } catch {}
  };

  // Creative Feature 3: Market-hours aware UI & After-Hours Summary Mode
  const [isMarketHours, setIsMarketHours] = useState<boolean>(() => {
    try {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const ist = new Date(utc + (3600000 * 5.5));
      const day = ist.getDay();
      if (day === 0 || day === 6) return false;
      const totalMinutes = ist.getHours() * 60 + ist.getMinutes();
      return totalMinutes >= (9 * 60 + 15) && totalMinutes <= (15 * 60 + 30);
    } catch {
      return false;
    }
  });
  const [isAfterHoursSummaryOpen, setIsAfterHoursSummaryOpen] = useState<boolean>(false);

  // Creative Feature 4: "Result Day" Super Mode (⚡ Result Day)
  const [isResultDayMode, setIsResultDayMode] = useState<boolean>(false);

  // Creative Feature 7: Muted Filing Types & Muted Companies
  const [mutedTypes, setMutedTypes] = useState<string[]>(() => getMutedTypes());
  const [mutedCompanies, setMutedCompanies] = useState<string[]>(() => getMutedCompanies());
  const [activeMuteMenuId, setActiveMuteMenuId] = useState<string | null>(null);

  // Creative Feature 9: Inline AI Summary Accordion (Modal-free)
  const [inlineAiExpanded, setInlineAiExpanded] = useState<Record<string, boolean>>({});
  const [inlineGeneratingMap, setInlineGeneratingMap] = useState<Record<string, boolean>>({});

  // Non-intrusive Toast Notifications (Avoid blocking browser window.alert in iFrame)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleToggleInlineAi = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const willExpand = !inlineAiExpanded[itemId];
    setInlineAiExpanded(prev => ({ ...prev, [itemId]: willExpand }));
    
    // If expanding and doesn't have AI summary yet, auto-generate
    const targetItem = announcements.find(a => a.id === itemId);
    if (willExpand && targetItem && !targetItem.aiSummary && !inlineGeneratingMap[itemId]) {
      await handleGenerateSummary(itemId);
    }
  };

  const handleMuteFilingType = (typeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!mutedTypes.includes(typeId)) {
      const updated = [...mutedTypes, typeId];
      setMutedTypes(updated);
      saveMutedTypes(updated);
    }
    setActiveMuteMenuId(null);
  };

  const handleUnmuteFilingType = (typeId: string) => {
    const updated = mutedTypes.filter(t => t !== typeId);
    setMutedTypes(updated);
    saveMutedTypes(updated);
  };

  const handleMuteCompany = (companyName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!mutedCompanies.includes(companyName)) {
      const updated = [...mutedCompanies, companyName];
      setMutedCompanies(updated);
      saveMutedCompanies(updated);
    }
    setActiveMuteMenuId(null);
  };

  const handleUnmuteCompany = (companyName: string) => {
    const updated = mutedCompanies.filter(c => c !== companyName);
    setMutedCompanies(updated);
    saveMutedCompanies(updated);
  };

  const handleAcknowledgeNewDivider = () => {
    const now = Date.now();
    setLastCheckedTime(now);
    setIsNewDividerDismissed(true);
    try {
      localStorage.setItem('nexus_last_checked_ts', String(now));
    } catch {}
  };

  // Read Announcements Tracker (Session / LocalStorage persistence)
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('nexus_read_filings');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsRead = (id: string) => {
    setReadAnnouncementIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('nexus_read_filings', JSON.stringify(Array.from(next).slice(-500)));
      } catch {}
      return next;
    });
  };

  // Watchlist quick-action states
  const [activeScope, setActiveScope] = useState<'all' | 'watchlist'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [userWatchlists, setUserWatchlists] = useState<any[]>([]);
  const [userWatchlistSymbols, setUserWatchlistSymbols] = useState<Set<string>>(new Set());
  const [isSavingWatchlist, setIsSavingWatchlist] = useState<boolean>(false);
  const [watchlistToast, setWatchlistToast] = useState<string | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);

  // Lock background scroll when filing mobile detail or filter sheet is open
  useBodyScrollLock(Boolean(isMobileDetailOpen || isFilterSheetOpen));

  const fetchUserWatchlists = async () => {
    if (!user && !profile) {
      setUserWatchlists([]);
      setUserWatchlistSymbols(new Set());
      return;
    }
    try {
      const res = await customFetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setUserWatchlists(data);
        const syms = new Set<string>();
        if (Array.isArray(data)) {
          data.forEach((w: any) => {
            (w.items || []).forEach((it: any) => {
              const sym = typeof it === 'string' ? it.trim().toUpperCase() : it?.symbol?.trim()?.toUpperCase();
              if (sym) syms.add(sym);
            });
          });
        }
        setUserWatchlistSymbols(syms);
      }
    } catch {}
  };

  useEffect(() => {
    fetchUserWatchlists();
    const handleAuthChanged = () => fetchUserWatchlists();
    window.addEventListener('auth-state-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-state-changed', handleAuthChanged);
  }, [user?.uid, profile?.uid]);

  const handleToggleWatchlist = async (scripCode?: string | number, companyName?: string) => {
    if (!user && !profile) {
      setIsAuthModalOpen(true);
      return;
    }

    const symbolOrScrip = String(scripCode || '').trim().toUpperCase() || (companyName || '').trim().toUpperCase();
    if (!symbolOrScrip) return;

    const isAlreadyInWatchlist = userWatchlistSymbols.has(symbolOrScrip) || 
      (scripCode && userWatchlistSymbols.has(String(scripCode).trim().toUpperCase())) || 
      (companyName && userWatchlistSymbols.has(companyName.trim().toUpperCase()));

    if (isAlreadyInWatchlist) {
      setIsSavingWatchlist(true);
      try {
        let targetList = userWatchlists.find(w => w.is_active === 1) || userWatchlists[0];
        if (targetList) {
          const deleteRes = await customFetch(`/api/watchlists/${targetList.id}/symbols/${encodeURIComponent(symbolOrScrip)}`, {
            method: 'DELETE'
          });
          if (deleteRes.ok) {
            setUserWatchlistSymbols(prev => {
              const next = new Set(prev);
              next.delete(symbolOrScrip);
              if (scripCode) next.delete(String(scripCode).trim().toUpperCase());
              if (companyName) next.delete(companyName.trim().toUpperCase());
              return next;
            });
            setWatchlistToast(`Removed "${companyName || symbolOrScrip}" from Watchlist`);
            setTimeout(() => setWatchlistToast(null), 3000);
            fetchUserWatchlists();
          }
        }
      } catch (e: any) {
        console.error("Failed to remove from watchlist:", e);
      } finally {
        setIsSavingWatchlist(false);
      }
      return;
    }

    setIsSavingWatchlist(true);
    try {
      let targetList = userWatchlists.find(w => w.is_active === 1) || userWatchlists[0];
      if (!targetList) {
        const createRes = await customFetch('/api/watchlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Watchlist' })
        });
        if (createRes.ok) {
          targetList = await createRes.json();
        }
      }

      if (targetList) {
        const addRes = await customFetch(`/api/watchlists/${targetList.id}/symbols`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: symbolOrScrip,
            priority: 'HIGH'
          })
        });
        if (addRes.ok) {
          setUserWatchlistSymbols(prev => {
            const next = new Set(prev);
            next.add(symbolOrScrip);
            if (companyName) next.add(companyName.trim().toUpperCase());
            return next;
          });
          setWatchlistToast(`✓ Added "${companyName || symbolOrScrip}" to Watchlist!`);
          setTimeout(() => setWatchlistToast(null), 3500);
          fetchUserWatchlists();
        } else if (addRes.status === 402) {
          setIsProModalOpen(true);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSavingWatchlist(false);
    }
  };

  // Engine state fallback
  const [internalIsRunning, setInternalIsRunning] = useState<boolean>(true);
  const [internalBseHealth, setInternalBseHealth] = useState<any>({ status: 'HEALTHY', latency: 58 });
  const [internalTelegramHealth, setInternalTelegramHealth] = useState<any>({ status: 'CONNECTED' });

  // Native Pull to Refresh Hook
  const { containerRef: feedScrollRef, pullDistance, isPulling, isRefreshing: isPullRefreshing, progress: pullProgress } = usePullToRefresh<HTMLDivElement>({
    onRefresh: async () => {
      await fetchData(true);
    }
  });

  useEffect(() => {
    // Fetch engine settings on mount if not controlled externally
    customFetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (typeof data.isRunning === 'boolean') {
          setInternalIsRunning(data.isRunning);
        } else if (typeof data.is_running === 'number') {
          setInternalIsRunning(data.is_running === 1);
        }
      })
      .catch(() => {});
  }, []);

  const effectiveIsRunning = propIsRunning !== undefined ? propIsRunning : internalIsRunning;
  const effectiveBseHealth = propBseHealth || internalBseHealth;
  const effectiveTelegramHealth = propTelegramHealth || internalTelegramHealth;

  const handleToggleEngine = async () => {
    if (propOnToggleEngine) {
      propOnToggleEngine();
      return;
    }
    const nextState = !internalIsRunning;
    setInternalIsRunning(nextState);
    try {
      await customFetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRunning: nextState })
      });
    } catch {}
  };

  const toggleCluster = (clusterId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedClusters(prev => ({
      ...prev,
      [clusterId]: !prev[clusterId]
    }));
  };
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [isPlaneFlying, setIsPlaneFlying] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiStepIndex, setAiStepIndex] = useState(0);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [lightningId, setLightningId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const isProOrAdmin = Boolean(isAdmin || (isPro && !user?.isAnonymous) || profile?.tier === 'admin');
  const aiQuota = useAiQuota(user, profile, isPro, isAdmin);

  // Cycle through AI thinking steps
  useEffect(() => {
    if (!isGeneratingAi) return;
    const interval = setInterval(() => {
      setAiStepIndex(prev => (prev + 1) % AI_THINKING_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [isGeneratingAi]);

  const handleManualSendTelegram = async (item: any) => {
    if (!item) return;

    if (!isProOrAdmin) {
      if (!user || user.isAnonymous) {
        setIsAuthModalOpen(true);
        showToast('🔒 Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial to broadcast to Telegram!', 'info');
      } else {
        setIsProModalOpen(true);
        showToast('🔒 Direct Telegram Broadcasting is a Pro feature (1-week trial ended. Upgrade to Pro for ₹499/mo).', 'info');
      }
      return;
    }

    setIsSendingTelegram(true);
    setIsPlaneFlying(true);
    setTelegramStatus(null);

    // Pick random inspiring message
    const randomMsg = TELEGRAM_SUCCESS_MESSAGES[Math.floor(Math.random() * TELEGRAM_SUCCESS_MESSAGES.length)];

    try {
      const res = await customFetch('/api/send-to-telegram-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsId: item.id,
          companyName: item.companyName,
          subject: item.subject,
          details: item.details || item.headline || '',
          category: item.category || 'OTHER',
          pdfLink: item.pdfLink || item.attachmentUrl || '',
          scripCode: item.scrip_cd
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramStatus(randomMsg);
        showToast('🚀 Corporate alert broadcasted to Telegram!', 'success');
        setSelectedItem((prev: any) => prev && prev.id === item.id ? { ...prev, is_sent: 1 } : prev);
        setAnnouncements((prev: any[]) => prev.map(a => a.id === item.id ? { ...a, is_sent: 1 } : a));
      } else {
        showToast(data.error || 'Failed to send alert to Telegram', 'error');
      }
    } catch (err: any) {
      showToast('Failed to send to Telegram: ' + err.message, 'error');
    } finally {
      setIsSendingTelegram(false);
      setTimeout(() => setIsPlaneFlying(false), 1200);
    }
  };

  const handleGenerateSummary = async (id: string) => {
    // 1. Guests are strictly view-only: prompt Google sign-in for 1-week Free Pro
    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      showToast('🔒 Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial with Gemini AI summaries!', 'info');
      return;
    }

    // 2. Authenticated user without active Pro trial / admin
    if (!isProOrAdmin) {
      setIsProModalOpen(true);
      showToast('🔒 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) to continue generating Gemini AI summaries!', 'info');
      return;
    }

    if (!aiQuota.canGenerate) {
      showToast('🔒 Daily Pro AI limit reached (100 summaries/day). Resets at 00:00 IST.', 'info');
      return;
    }

    setIsGeneratingAi(true);
    setAiStepIndex(0);
    try {
      const currentItem = announcements.find(a => a.id === id) || (selectedItem && selectedItem.id === id ? selectedItem : {});
      const res = await customFetch(`/api/announcements/${id}/generate-summary`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentItem)
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        showToast(data?.error || '🔒 Google Sign-In Required: Sign in to enjoy 1 week of Free Pro AI features.', 'info');
        return;
      }

      if (res.status === 429) {
        syncQuotaFromResponse(data || { remainingQuota: 0 });
        const errMsg = data?.error || 'Daily AI summary quota reached.';
        showToast(`🔒 ${errMsg}`, 'error');
        return;
      }

      if (res.ok && data && data.aiSummary) {
        syncQuotaFromResponse(data);
        showToast('✨ Gemini AI neural synthesis ready!', 'success');
        setSelectedItem((prev: any) => prev && prev.id === id ? { ...prev, aiSummary: data.aiSummary } : prev);
        setAnnouncements((prev: any[]) => prev.map(a => a.id === id ? { ...a, aiSummary: data.aiSummary } : a));
      } else {
        const errMsg = data?.error || 'AI summary service is currently busy or rate-limited. Please retry shortly.';
        showToast(`⚠️ AI Summary Alert: ${errMsg}`, 'error');
      }
    } catch (e: any) {
      showToast(`⚠️ AI processing error: ${e.message || 'Connection interrupted'}`, 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSelectAnnouncement = (item: any) => {
    setSelectedItem(item);
    setLightningId(item.id);
    setCopiedSummary(false);
    markAsRead(item.id);
    setTimeout(() => {
      setLightningId(null);
    }, 850);

    // On mobile view, show dedicated Slide-up Bottom Sheet Modal
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileDetailOpen(true);
    }
  };

  const handleCopySummary = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Shareable live-feed link (bsenexus.in/live) — one-tap copy for forwarding
  const [feedLinkCopied, setFeedLinkCopied] = useState(false);
  const handleShareFeedLink = () => {
    try {
      navigator.clipboard.writeText('https://bsenexus.in/live');
    } catch {}
    setFeedLinkCopied(true);
    setTimeout(() => setFeedLinkCopied(false), 2000);
  };

  const handleOpenIntel = (scripCode?: string, symbol?: string, companyName?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    openIntelModal({ scripCode, symbol: symbol || companyName, companyName: companyName || symbol });
  };

  // Efficient 60s background polling with visibility gating and immediate resume on active
  useEffect(() => {
    fetchData(true);
  }, []);

  useVisibilityInterval(() => {
    fetchData(false);
  }, 60000);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, itemsPerPage]);

  const fetchData = async (isInitial: boolean = false) => {
    if (isInitial && announcements.length === 0) {
      setIsLoading(true);
    }
    try {
      // 300 items is fast, rich, and prevents browser hanging / memory exhaustion
      const res = await customFetch('/api/announcements?limit=300');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const uniqueMap = new Map<string, any>();
          for (const item of data) {
            const idKey = item?.id || item?.newsId;
            if (idKey && !uniqueMap.has(idKey)) {
              uniqueMap.set(idKey, item);
            } else if (!idKey) {
              uniqueMap.set(`item-${Math.random()}`, item);
            }
          }
          const incomingList = Array.from(uniqueMap.values());
          incomingList.sort((a, b) => {
            const tsA = (typeof a.bseTimestamp === 'number' && !isNaN(a.bseTimestamp) && a.bseTimestamp > 0) ? a.bseTimestamp : (a.fetched_at || 0);
            const tsB = (typeof b.bseTimestamp === 'number' && !isNaN(b.bseTimestamp) && b.bseTimestamp > 0) ? b.bseTimestamp : (b.fetched_at || 0);
            return tsB - tsA;
          });

          if (isInitial) {
            setAnnouncements(incomingList);
            setCacheItem('announcements_feed', incomingList.slice(0, 150));
          } else {
            // Stable delta merge: avoids jumpy scroll position on background polling
            setAnnouncements(prev => {
              const existingIds = new Set(prev.map(p => p.id || p.newsId));
              const newItems = incomingList.filter(item => !existingIds.has(item.id || item.newsId));
              let updatedList: any[];
              if (newItems.length === 0) {
                // Update only modified properties (e.g. aiSummary or is_sent) without replacing references
                updatedList = prev.map(existing => {
                  const updated = incomingList.find(inc => (inc.id || inc.newsId) === (existing.id || existing.newsId));
                  if (updated && (updated.aiSummary !== existing.aiSummary || updated.is_sent !== existing.is_sent)) {
                    return { ...existing, ...updated };
                  }
                  return existing;
                });
              } else {
                updatedList = [...newItems, ...prev];
              }
              setCacheItem('announcements_feed', updatedList.slice(0, 150));
              return updatedList;
            });
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching announcements:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredByScope = announcements.filter(a => {
    if (activeScope === 'watchlist') {
      if (userWatchlistSymbols.size === 0) return false;
      const sym = (a.companyName || '').toUpperCase();
      const scrip = String(a.scrip_cd || '').toUpperCase();
      for (const s of userWatchlistSymbols) {
        if (sym.includes(s) || scrip === s) return true;
      }
      return false;
    }
    return true;
  });

  const filteredByType = filteredByScope.filter(a => {
    // 1. Result Day Super Mode Filter
    if (isResultDayMode && a.category !== 'RESULTS') return false;

    // 2. Muted Companies Filter
    if (mutedCompanies.length > 0 && mutedCompanies.includes(a.companyName)) return false;

    // 3. Muted Filing Types Filter
    if (mutedTypes.length > 0) {
      const detected = detectFilingType(a.subject);
      if (detected && mutedTypes.includes(detected.id)) return false;
    }

    if (filterType === 'ALL') return true;
    if (filterType === 'AI_SYNTHESIZED') return Boolean(a.aiSummary && a.aiSummary.trim().length > 0);
    if (filterType === 'RESULTS') return a.category === 'RESULTS';
    if (filterType === 'CONFERENCE CALL') return a.category === 'CONFERENCE_CALL';
    if (filterType === 'HIGH PRIORITY') return a.category === 'HIGH_PRIORITY' || (a.priority === 'HIGH' && a.category !== 'RESULTS' && a.category !== 'CONFERENCE_CALL');
    if (filterType === 'OTHER') return !['RESULTS', 'CONFERENCE_CALL', 'HIGH_PRIORITY'].includes(a.category) && a.priority !== 'HIGH';
    return true;
  });

  const searched = filteredByType.filter(a => {
    const q = (search || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (a.companyName || '').toLowerCase().includes(q) || 
      (a.subject || '').toLowerCase().includes(q) ||
      (a.headline || '').toLowerCase().includes(q) ||
      (a.details || '').toLowerCase().includes(q) ||
      (a.category || '').toLowerCase().includes(q) ||
      (a.scrip_cd || '').toString().includes(q)
    );
  });

  const filtered = React.useMemo(() => {
    if (sortOrder === 'oldest') {
      return [...searched].reverse();
    }
    return searched;
  }, [searched, sortOrder]);

  // Calculate items arrived since last checked
  const newSinceLastCheckedCount = React.useMemo(() => {
    return filtered.filter(a => {
      const ts = (typeof a.bseTimestamp === 'number' && a.bseTimestamp > 0) ? a.bseTimestamp : (a.fetched_at || 0);
      return ts > lastCheckedTime;
    }).length;
  }, [filtered, lastCheckedTime]);

  const clusteredAnnouncements = React.useMemo<AnnouncementCluster[]>(() => {
    if (!isSmartClustering) {
      return filtered.map((item, idx) => ({
        id: `single-${item.id || item.newsId || idx}`,
        isCluster: false,
        companyName: item.companyName,
        scrip_cd: item.scrip_cd,
        count: 1,
        primaryItem: item,
        items: [item],
        categories: [item.category || 'OTHER'],
        hasResults: item.category === 'RESULTS',
        hasConcall: item.category === 'CONFERENCE_CALL',
        hasHighPriority: item.category === 'HIGH_PRIORITY' || item.priority === 'HIGH',
        isSentToTelegram: Boolean(item.is_sent),
        timeSpanLabel: '',
        isDuplicateSubject: false,
      }));
    }
    return clusterAnnouncements(filtered);
  }, [filtered, isSmartClustering]);

  const clusterStats = React.useMemo(() => {
    const totalBundles = clusteredAnnouncements.filter(c => c.isCluster).length;
    const reducedClutterCount = clusteredAnnouncements.reduce((acc, c) => acc + (c.isCluster ? c.count - 1 : 0), 0);
    return { totalBundles, reducedClutterCount };
  }, [clusteredAnnouncements]);

  const totalPages = Math.max(1, Math.ceil(clusteredAnnouncements.length / itemsPerPage));
  const paginatedItems = clusteredAnnouncements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate unread filings count
  const unreadCount = React.useMemo(() => {
    return announcements.filter(a => {
      const id = a.id || a.newsId;
      return id && !readAnnouncementIds.has(id);
    }).length;
  }, [announcements, readAnnouncementIds]);

  const resultsCount = announcements.filter(a => a.category === 'RESULTS').length;
  const ccCount = announcements.filter(a => a.category === 'CONFERENCE_CALL').length;
  const hpCount = announcements.filter(a => a.category === 'HIGH_PRIORITY' || (a.priority === 'HIGH' && a.category !== 'RESULTS' && a.category !== 'CONFERENCE_CALL')).length;
  const aiCount = announcements.filter(a => Boolean(a.aiSummary && a.aiSummary.trim().length > 0)).length;

  // After-hours summary stats
  const todayResults = announcements.filter(a => a.category === 'RESULTS');
  const todayConcalls = announcements.filter(a => a.category === 'CONFERENCE_CALL');
  const todayPriorities = announcements.filter(a => a.category === 'HIGH_PRIORITY' || a.priority === 'HIGH');

  // Reusable Drawer Content Component to avoid duplication between Desktop and Mobile Modal
  const renderDrawerBody = (item: any, isMobileModal: boolean = false) => {
    const isSavedInWatchlist = Boolean(
      (item.scrip_cd && userWatchlistSymbols.has(String(item.scrip_cd).trim().toUpperCase())) ||
      (item.companyName && userWatchlistSymbols.has(String(item.companyName).trim().toUpperCase()))
    );
    const cleanSub = cleanBseSubject(item.subject, item.companyName, item.scrip_cd);
    const detectedNoiseType = detectFilingType(item.subject);

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 overscroll-contain">
        {/* Watchlist Quick Toast inside Drawer */}
        {watchlistToast && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold rounded-xl shadow-xs flex items-center justify-between gap-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2">
              <Bookmark size={13} className="text-amber-600 dark:text-amber-400 fill-amber-500 shrink-0" />
              <span>{watchlistToast}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setWatchlistToast(null)}
              className="text-amber-600 hover:text-amber-900 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Header Details */}
        <div className="border-b border-slate-200/90 dark:border-[#2D283E] pb-4 space-y-2 relative">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
                <span>{item.scrip_cd ? `BSE: ${item.scrip_cd}` : 'BSE Listed'}</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#352F48] select-none whitespace-nowrap">
                {cleanSub.regulation || 'Reg 30 (LODR)'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
              {formatDateOnly(item.bseTime || item.fetched_at)}
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 pt-1">
            <motion.h3 
              layoutId={`company-title-${item.id}`}
              transition={springStandard}
              className="text-lg font-black text-slate-900 dark:text-white leading-snug tracking-tight font-display"
            >
              {item.companyName}
            </motion.h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <WatchlistStarButton
                isSaved={isSavedInWatchlist}
                isLoading={isSavingWatchlist}
                onToggle={() => handleToggleWatchlist(item.scrip_cd, item.companyName)}
                showLabel={true}
                size="sm"
              />
              <ShareActionMenu
                title={`${item.companyName} (${item.scrip_cd ? `BSE: ${item.scrip_cd}` : 'BSE'})`}
                headline={cleanSub.headline || item.subject}
                companyName={item.companyName}
                scripCode={item.scrip_cd}
                newsId={item.id || item.newsId}
                category={item.category}
                pdfUrl={item.pdfLink || item.ATTACHMENTNAME || item.attachmentName}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Primary Action: Original PDF Button */}
        {item.pdfLink && (
          <div>
            <motion.a 
              whileTap={buttonTap}
              href={getSafePdfUrl(item.pdfLink, item.ATTACHMENTNAME || item.attachmentName, item.id, item.scrip_cd)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full min-h-[44px] flex items-center justify-center gap-2.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer select-none whitespace-nowrap"
            >
              <FileText size={16} className="text-white" />
              <span>Open Official BSE Document (PDF)</span>
              <ExternalLink size={13} className="opacity-80 ml-0.5" />
            </motion.a>
          </div>
        )}

        {/* Disclosed Timing Box */}
        <div className="bg-slate-50 dark:bg-[#15141E] rounded-xl p-3 space-y-1.5 border border-slate-200/90 dark:border-[#2D283E] text-xs font-medium">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500 dark:text-slate-400" />
              BSE Disclosed Time:
            </span>
            <strong className="text-slate-900 dark:text-white font-mono font-bold">
              {formatFullDateTime(item.bseTime || item.fetched_at)}
            </strong>
          </div>
        </div>

        {/* Human Title & Headline Subject */}
        <div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
            Announcement
          </span>
          <div className="bg-slate-50 dark:bg-[#15141E] p-3.5 rounded-xl border border-slate-200/90 dark:border-[#2D283E] space-y-1.5">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {cleanSub.humanTitle || 'Corporate announcement'}
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {cleanSub.headline}
            </p>
          </div>
        </div>

        {/* Plain-English / AI Summary Block (Placed Below Announcement) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-500 fill-purple-500" />
                <span>AI Plain-English Digest</span>
              </span>
            </div>

            {!item.aiSummary && !isGeneratingAi && (
              <ActionButton
                onClick={() => handleGenerateSummary(item.id)}
                isLoading={isGeneratingAi}
                loadingText="Analyzing..."
                variant="secondary"
                size="sm"
                icon={<Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                className="text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800"
              >
                Generate deeper analysis
              </ActionButton>
            )}
          </div>

          {isGeneratingAi ? (
            /* AI Intelligence Thinking Status Box */
            <div className="p-4 rounded-xl border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-700/80 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-700 dark:text-purple-300 animate-ai-orb" />
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <span className="text-xs font-bold text-purple-800 dark:text-purple-200 uppercase tracking-wider font-display">
                      AI Summary Engine
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-normal">
                    {AI_THINKING_STEPS[aiStepIndex]}
                  </p>
                </div>
              </div>
              <div className="w-full bg-purple-200/60 dark:bg-purple-950/80 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full animate-ai-gradient w-full" />
              </div>
            </div>
          ) : item.aiSummary ? (
            <AiSummaryViewer
              summaryText={item.aiSummary}
              category={item.category}
              companyName={item.companyName}
              onRegenerate={() => handleGenerateSummary(item.id)}
              isGenerating={isGeneratingAi}
            />
          ) : null}
        </div>

        {/* Full Details */}
        {item.details && (
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Filing Body
            </span>
            <div className="max-h-44 overflow-y-auto p-3 bg-slate-50 dark:bg-[#15141E] rounded-xl border border-slate-200/90 dark:border-[#2D283E] text-[11px] font-mono text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {item.details}
            </div>
          </div>
        )}

        {/* Noise Filter & Mute Quick Actions */}
        <div className="p-3 bg-slate-50 dark:bg-[#15141E] rounded-xl border border-slate-200/90 dark:border-[#2D283E] flex items-center justify-between gap-2 text-xs flex-wrap">
          <span className="text-slate-600 dark:text-slate-400 font-medium">Mute notifications:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {detectedNoiseType && (
              <button
                type="button"
                onClick={(e) => handleMuteFilingType(detectedNoiseType.id, e)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-rose-50 dark:bg-[#252233] text-slate-700 dark:text-slate-300 hover:text-rose-600 border border-slate-200 dark:border-[#38324E] cursor-pointer whitespace-nowrap"
              >
                Mute "{detectedNoiseType.label}"
              </button>
            )}
            <button
              type="button"
              onClick={(e) => handleMuteCompany(item.companyName, e)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-rose-50 dark:bg-[#252233] text-slate-700 dark:text-slate-300 hover:text-rose-600 border border-slate-200 dark:border-[#38324E] cursor-pointer whitespace-nowrap"
            >
              Mute Company
            </button>
          </div>
        </div>

        {/* Telegram Dispatch Action */}
        <div className="pt-1 space-y-2">
          <ActionButton
            onClick={() => handleManualSendTelegram(item)}
            isLoading={isSendingTelegram}
            loadingText="Launching Broadcast to Telegram..."
            variant="secondary"
            size="md"
            icon={
              <Send 
                size={14} 
                className={cn(
                  "text-blue-500 transition-transform",
                  isPlaneFlying ? "animate-plane-fly" : ""
                )} 
              />
            }
            className="w-full min-h-[44px] bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 rounded-xl whitespace-nowrap"
          >
            Forward to Telegram Channel
          </ActionButton>

          {/* Telegram Dispatch Message Alert */}
          {telegramStatus && (
            <div className="p-3 bg-slate-100 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs animate-in fade-in zoom-in-95 duration-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-snug">{telegramStatus}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* 1. ALERT STATE: Loud Banner when Engine is Paused or Offline */}
      {!effectiveIsRunning && (
        <div className="bg-amber-500/15 dark:bg-amber-950/60 border border-amber-400/60 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <div className="min-w-0">
              <span className="text-xs font-black tracking-tight block truncate">
                ⚠️ Engine paused — BSE live ingestion is on standby
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-300/80 hidden sm:block">
                Poller is idle. Click resume to start receiving real-time corporate announcements.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleEngine}
            className="min-h-[44px] sm:min-h-[36px] px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-900 font-black text-xs rounded-lg shrink-0 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Zap size={12} className="fill-slate-900" />
            <span>Resume</span>
          </button>
        </div>
      )}

      {/* STREAMLINED FILING HEADER: Sticky below navbar - Title, Search, Filter + Single Scope Control */}
      <div className="sticky top-14 md:top-[89px] z-30 bg-white/95 dark:bg-[#1A1926]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col gap-2.5 sm:gap-3">
        {/* Row 1: Title + green live dot, Search Bar & Filter Bottom Sheet Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 justify-between">
          
          {/* Left: Brand Title & Clean Live Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display whitespace-nowrap tracking-tight">
              Live BSE Announcements
            </h1>
            {effectiveIsRunning && (
              <span 
                className="relative flex h-2.5 w-2.5 items-center justify-center shrink-0" 
                title="BSE Live Realtime Poller Active (30s market hours / 5m off-hours)"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <button
              type="button"
              onClick={handleShareFeedLink}
              title={feedLinkCopied ? 'Link copied!' : 'Copy live feed link (bsenexus.in/live)'}
              aria-label="Copy live feed link"
              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/50 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors cursor-pointer shrink-0"
            >
              {feedLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Center: Search Box (clean height with no crush) */}
          <div className="relative flex-1 max-w-lg min-h-[38px] sm:min-h-[36px] flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search symbol, company or text..."
              aria-label="Search symbol, company or text"
              className="w-full h-9 sm:h-9 pl-8 pr-7 bg-slate-50 dark:bg-[#15141E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900 dark:text-white"
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Right: Filter & View Switcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Filter & Preferences Trigger with Chevron */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setIsFilterSheetOpen(true)}
              aria-label="Open Filing Filters, Grouping, Sorting & Preferences"
              className={cn(
                "h-9 sm:h-9 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none border shrink-0",
                (filterType !== 'ALL' || isResultDayMode || !isSmartClustering || density !== 'compact' || sortOrder !== 'newest' || mutedTypes.length > 0 || mutedCompanies.length > 0)
                  ? "bg-slate-100 dark:bg-[#252233] text-slate-900 dark:text-white border-slate-300 dark:border-[#3E3854]"
                  : "bg-white dark:bg-[#1A1926] hover:bg-slate-50 dark:hover:bg-[#222030] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
              )}
              title="Open Filing Filters, Grouping, Sorting & Preferences"
            >
              <SlidersHorizontal size={13} className="text-slate-500" />
              <span>Filter</span>
              <ChevronDown size={13} className="text-slate-500" />
              {(filterType !== 'ALL' || isResultDayMode || !isSmartClustering || density !== 'compact' || sortOrder !== 'newest' || mutedTypes.length > 0 || mutedCompanies.length > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Row 2: Clean Category Tabs with Smooth Sliding Pill */}
        <div className="relative flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar pt-2.5 sm:pt-2 border-t border-slate-100 dark:border-[#2D283E]">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'RESULTS', label: 'Results' },
            { id: 'CONFERENCE CALL', label: 'Concalls' },
            { id: 'HIGH PRIORITY', label: 'Priority' },
            { id: 'AI_SYNTHESIZED', label: '✨ AI Ready' }
          ].map(chip => {
            const isChipActive = filterType === chip.id;
            return (
              <motion.button
                key={chip.id}
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={springBouncy}
                onClick={() => setFilterType(chip.id as any)}
                className={cn(
                  "relative min-h-[28px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer select-none z-10",
                  isChipActive
                    ? chip.id === 'AI_SYNTHESIZED'
                      ? "text-white font-bold"
                      : "text-white dark:text-slate-900 font-bold"
                    : chip.id === 'AI_SYNTHESIZED'
                    ? "text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {/* Smooth Animated Active Pill */}
                {isChipActive && (
                  <motion.div
                    layoutId="announcementsCategoryPill"
                    transition={springSmoothPill}
                    className={cn(
                      "absolute inset-0 rounded-lg -z-10 shadow-xs",
                      chip.id === 'AI_SYNTHESIZED'
                        ? "bg-purple-600 border border-purple-500 shadow-purple-500/20"
                        : "bg-slate-900 dark:bg-white border border-slate-900 dark:border-white"
                    )}
                  />
                )}
                <span>{chip.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 3. FILTER & MORE BOTTOM SHEET / MODAL */}
      <AnimatePresence>
        {isFilterSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overscroll-contain">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterSheetOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />

            {/* Sheet Content */}
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="filing-filter-sheet-title"
              className="relative w-full sm:max-w-lg bg-white dark:bg-[#1A1926] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overscroll-contain space-y-4 z-10 safe-area-bottom"
            >
              {/* Drag handle for mobile */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2D283E] pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                  <h3 id="filing-filter-sheet-title" className="text-sm font-bold text-slate-900 dark:text-white font-display">
                    Filters & Preferences
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  aria-label="Close filters and preferences"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Section 1: Categories */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Filing Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { id: 'ALL', label: 'All Filings' },
                    { id: 'AI_SYNTHESIZED', label: '✨ AI Ready' },
                    { id: 'RESULTS', label: 'Results' },
                    { id: 'CONFERENCE CALL', label: 'Concalls' },
                    { id: 'HIGH PRIORITY', label: 'Priority' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterType(tab.id as any)}
                      className={cn(
                        "min-h-[40px] px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center cursor-pointer",
                        filterType === tab.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Sorting & View Mode */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Sort Order
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSortOrder('newest')}
                      className={cn(
                        "min-h-[38px] px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                        sortOrder === 'newest'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      Newest
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortOrder('oldest')}
                      className={cn(
                        "min-h-[38px] px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                        sortOrder === 'oldest'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      Oldest
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    View Layout
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetViewMode('grid')}
                      className={cn(
                        "min-h-[38px] px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1",
                        viewMode === 'grid'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      <LayoutGrid size={12} />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetViewMode('list')}
                      className={cn(
                        "min-h-[38px] px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1",
                        viewMode === 'list'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      <List size={12} />
                      <span>List</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Grouping & Result Day Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                {/* Smart Grouping */}
                <button
                  type="button"
                  onClick={() => setIsSmartClustering(!isSmartClustering)}
                  className={cn(
                    "min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer",
                    isSmartClustering
                      ? "bg-slate-900 text-white dark:bg-[#252233] dark:text-slate-200 border-slate-700 dark:border-[#3E3854]"
                      : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Layers size={14} className={isSmartClustering ? "text-amber-400" : "text-slate-400"} />
                    <span>Smart Grouping</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/20">
                    {isSmartClustering ? "ON" : "OFF"}
                  </span>
                </button>

                {/* Result Day Mode */}
                <button
                  type="button"
                  onClick={() => setIsResultDayMode(!isResultDayMode)}
                  className={cn(
                    "min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer",
                    isResultDayMode
                      ? "bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/40"
                      : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Zap size={14} className={isResultDayMode ? "fill-slate-950" : "text-amber-500 fill-amber-500"} />
                    <span>Result Day Only</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/20">
                    {isResultDayMode ? "ACTIVE" : "OFF"}
                  </span>
                </button>
              </div>

              {/* Section 4: Live Telemetry & Pro Sync Status */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <RefreshCw size={13} className={effectiveIsRunning ? "text-emerald-500 animate-spin" : "text-slate-400"} />
                    <span>BSE Live Engine & Pro Sync</span>
                  </span>
                  <ActionButton
                    onClick={async () => {
                      setIsSyncingNow(true);
                      try {
                        await fetchData(true);
                      } finally {
                        setIsSyncingNow(false);
                      }
                    }}
                    isLoading={isSyncingNow}
                    loadingText="Syncing..."
                    variant="secondary"
                    size="sm"
                    className="text-xs font-bold"
                  >
                    Sync Now
                  </ActionButton>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#14131E] border border-slate-200/60 dark:border-[#2D283E]">
                    <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">BSE Stream</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Live ({effectiveBseHealth?.latency || 58}ms)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#14131E] border border-slate-200/60 dark:border-[#2D283E]">
                    <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Watchlist Scope</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {userWatchlistSymbols.size} tracked
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Muted Noise Filters */}
              {(mutedTypes.length > 0 || mutedCompanies.length > 0) && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <VolumeX size={14} className="text-slate-400" />
                    <span>{mutedTypes.length + mutedCompanies.length} Muted Filters</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMutedTypes([]);
                      setMutedCompanies([]);
                      saveMutedTypes([]);
                      saveMutedCompanies([]);
                    }}
                    className="min-h-[44px] px-3 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* Done Button */}
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-full min-h-[44px] py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Apply & Return to Feed
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Layout: Live Disclosures Feed & Selected Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        
        {/* Left 2 Columns: Streamlined Flat Feed List (Linear/Bloomberg pattern) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl overflow-hidden shadow-xs flex flex-col lg:h-[calc(100vh-140px)] lg:min-h-[500px] lg:max-h-[920px]">
          
          {/* Scrollable Feed List with Native Pull-To-Refresh */}
          <div 
            ref={feedScrollRef}
            className="flex-1 lg:overflow-y-auto lg:overscroll-y-contain relative"
          >
            {/* Pull to Refresh Animated Indicator */}
            <PullToRefreshIndicator 
              pullDistance={pullDistance}
              isPulling={isPulling}
              isRefreshing={isPullRefreshing}
              progress={pullProgress}
              label="BSE Filings"
            />

            {/* Creative Feature 1: "Since you last checked" Divider Header (if new items present) */}
            {newSinceLastCheckedCount > 0 && !isNewDividerDismissed && (
              <div className="p-2 bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800/80 px-3.5 flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-200 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500 fill-amber-500" />
                  <span><RollingNumber value={newSinceLastCheckedCount} /> new filing{newSinceLastCheckedCount > 1 ? 's' : ''} since your last session</span>
                </div>
                <button
                  type="button"
                  onClick={handleAcknowledgeNewDivider}
                  className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900/60 hover:bg-amber-300 text-amber-900 dark:text-amber-100 rounded text-[10px] font-black transition-all cursor-pointer"
                >
                  Mark as Seen ✓
                </button>
              </div>
            )}

            {isLoading && announcements.length === 0 ? (
              /* Semantic Zero-Layout-Shift Skeleton with Real Text & Structure */
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5" : "divide-y divide-slate-100 dark:divide-[#242033]"}>
                {[
                  { name: "RELIANCE INDUSTRIES LTD.", scrip: "500325", sub: "Financial Results For The Quarter And Year Ended March 31 - SEBI LODR Reg 33" },
                  { name: "TATA CONSULTANCY SERVICES LTD.", scrip: "532540", sub: "Outcome of Board Meeting - Audited Results & Final Dividend Declaration" },
                  { name: "LARSEN & TOUBRO LTD.", scrip: "500510", sub: "Heavy Civil Infrastructure Secures Major Order under Regulation 30" },
                  { name: "INFOSYS LTD.", scrip: "500209", sub: "Schedule of Earnings Conference Call for Institutional Investors" },
                  { name: "HDFC BANK LTD.", scrip: "500180", sub: "SEBI LODR Regulation 30 Corporate Intimation & Strategic Expansion" },
                  { name: "BHARTI AIRTEL LTD.", scrip: "532454", sub: "Board Meeting Intimation to Consider Financial Results & Dividend" }
                ].map((sk, idx) => (
                  <div 
                    key={`feed-skeleton-${idx}`}
                    className={cn(
                      "p-3.5 space-y-2.5",
                      viewMode === 'grid' 
                        ? "rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-white dark:bg-[#181624]" 
                        : "bg-white dark:bg-[#181624] px-4 py-3.5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{sk.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#201E2E]">BSE: {sk.scrip}</div>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{sk.sub}</div>
                  </div>
                ))}
              </div>
            ) : (
            <motion.div
              key="announcements-feed-container"
              variants={containerStaggerVariants}
              initial="hidden"
              animate="visible"
              className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5" : "divide-y divide-slate-100 dark:divide-[#242033]"}
            >
            {paginatedItems.map((cluster: AnnouncementCluster, cIdx: number) => {
              const item = cluster.primaryItem;
              if (!item || (!item.companyName && !item.subject)) return null;
              const isSelected = selectedItem?.id === item.id;
              const isResults = cluster.hasResults || item.category === 'RESULTS';
              const isConcall = cluster.hasConcall || item.category === 'CONFERENCE_CALL';
              const isHigh = cluster.hasHighPriority || item.category === 'HIGH_PRIORITY' || (item.priority === 'HIGH' && !isResults && !isConcall);
              const isFlashActive = lightningId === item.id;
              const isExpanded = Boolean(expandedClusters[cluster.id]);
              const cleanSub = cleanBseSubject(item.subject, item.companyName, item.scrip_cd);
              const detectedNoiseType = detectFilingType(item.subject);

              // ==========================================
              // GRID CARD VIEW (Multi-column desktop & responsive)
              // ==========================================
              if (viewMode === 'grid') {
                const companyInitials = (item.companyName || 'CA')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w: string) => w[0])
                  .join('')
                  .toUpperCase() || 'CA';

                return (
                  <motion.div
                    id={`filing-${item.id || item.newsId}`}
                    key={item.id || item.newsId || `cluster-${cIdx}`}
                    variants={itemFadeUpVariants}
                    transition={springSnappy}
                    onClick={() => handleSelectAnnouncement(item)}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between gap-3",
                      isSelected
                        ? "bg-slate-100/90 dark:bg-[#25213B] border-slate-400 dark:border-[#4E446B] ring-1 ring-slate-400 dark:ring-[#4E446B] shadow-xs"
                        : "bg-white dark:bg-[#181624] border-slate-200/90 dark:border-[#2D283E] hover:border-slate-300 dark:hover:border-[#3E3854] hover:shadow-xs",
                      isFlashActive && 'ring-1 ring-amber-400 dark:ring-amber-500'
                    )}
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Top Row: Monogram Avatar + Company & Time */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#221F30] border border-slate-200/80 dark:border-[#342E46] text-slate-700 dark:text-slate-300 font-extrabold text-[11px] flex items-center justify-center font-display shrink-0 select-none shadow-2xs">
                            {companyInitials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <motion.span 
                              layoutId={`company-title-${item.id}`}
                              transition={springStandard}
                              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate font-display tracking-tight block" 
                              title={item.companyName}
                            >
                              {item.companyName}
                            </motion.span>
                          </div>
                          {item.scrip_cd && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#221F30] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#342E46] shrink-0 whitespace-nowrap select-none">
                              {item.scrip_cd}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 font-medium whitespace-nowrap bg-slate-50 dark:bg-[#201E2E] px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-[#2D283E]">
                          <Clock size={10} className="text-slate-400" />
                          {formatFilingRelativeTime(item.bseTime || item.fetched_at)}
                        </span>
                      </div>

                      {/* Human Title & Priority Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100">
                          {cleanSub.humanTitle || 'Corporate announcement'}
                        </span>
                        {isHigh && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1 whitespace-nowrap select-none">
                            <Zap size={10} className="fill-rose-500 text-rose-500" />
                            <span>High impact</span>
                          </span>
                        )}
                        {isResults && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1 whitespace-nowrap select-none">
                            <TrendingUp size={10} className="text-emerald-500" />
                            <span>Results</span>
                          </span>
                        )}
                        {isConcall && !isResults && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 flex items-center gap-1 whitespace-nowrap select-none">
                            <Building2 size={10} className="text-sky-500" />
                            <span>Concall</span>
                          </span>
                        )}
                        {cluster.isCluster && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 flex items-center gap-1 whitespace-nowrap select-none">
                            <Layers size={10} className="text-amber-500" />
                            <span>{cluster.count} Batch</span>
                          </span>
                        )}
                        {item.aiSummary && !isHigh && !isResults && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1 whitespace-nowrap select-none">
                            <Sparkles size={10} className="text-purple-500 fill-purple-500" />
                            <span>AI Ready</span>
                          </span>
                        )}
                      </div>

                      {/* Headline */}
                      <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-normal line-clamp-2 leading-relaxed pt-0.5">
                        {cleanSub.headline}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-[#262238]">
                      {item.aiSummary ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                          <Sparkles size={11} className="text-purple-500 fill-purple-500" />
                          <span>AI Synthesis Ready</span>
                        </span>
                      ) : (
                        <span>Tap for AI digest & PDF</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <ShareActionMenu
                          title={`${item.companyName} (${item.scrip_cd ? `BSE: ${item.scrip_cd}` : 'BSE'})`}
                          headline={cleanSub.headline || item.subject}
                          companyName={item.companyName}
                          scripCode={item.scrip_cd}
                          newsId={item.id || item.newsId}
                          category={item.category}
                          pdfUrl={item.pdfLink || item.ATTACHMENTNAME || item.attachmentName}
                          size="xs"
                        />
                        <div className="p-1 rounded bg-slate-100 dark:bg-[#201E2E] border border-slate-200/50 dark:border-[#2D283E]">
                          <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform text-slate-500 dark:text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              if (cluster.isCluster) {
                const companyInitials = (item.companyName || 'CA')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w: string) => w[0])
                  .join('')
                  .toUpperCase() || 'CA';

                return (
                  <motion.div
                    id={`filing-${cluster.id || item.id || `cluster-${cIdx}`}`}
                    key={cluster.id || `cluster-${cIdx}`}
                    variants={itemFadeUpVariants}
                    transition={springSnappy}
                    onClick={() => handleSelectAnnouncement(item)}
                    className={cn(
                      "p-3.5 transition-all cursor-pointer relative group",
                      isSelected 
                        ? 'bg-slate-100/90 dark:bg-[#242036]' 
                        : 'hover:bg-slate-50/90 dark:hover:bg-[#1E1B2C]/70'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#221F30] border border-slate-200/80 dark:border-[#342E46] text-slate-700 dark:text-slate-300 font-extrabold text-[11px] flex items-center justify-center font-display shrink-0 select-none shadow-2xs mt-0.5">
                        {companyInitials}
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <motion.span 
                              layoutId={`company-title-${item.id}`}
                              transition={springStandard}
                              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate font-display tracking-tight"
                            >
                              {item.companyName}
                            </motion.span>
                            {item.scrip_cd && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-[#352F48]">
                                {item.scrip_cd}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 font-medium bg-slate-50 dark:bg-[#201E2E] px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-[#2D283E]">
                            <Clock size={10} className="text-slate-400" />
                            {formatFilingRelativeTime(item.bseTime || item.fetched_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100">
                            {cleanSub.humanTitle || 'Corporate announcement'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#38324E] flex items-center gap-1 whitespace-nowrap select-none">
                            <Layers size={10} className="text-slate-400" />
                            <span>{cluster.count} Filings ({cluster.timeSpanLabel})</span>
                          </span>
                          {isHigh && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1 whitespace-nowrap select-none">
                              <Zap size={10} className="fill-rose-500 text-rose-500" />
                              <span>High impact</span>
                            </span>
                          )}
                          {isResults && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1 whitespace-nowrap select-none">
                              <TrendingUp size={10} className="text-emerald-500" />
                              <span>Results</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-normal line-clamp-2 leading-relaxed">
                          {cleanSub.headline}
                        </p>
                      </div>

                      <div className="p-1 rounded bg-slate-100 dark:bg-[#201E2E] border border-slate-200/50 dark:border-[#2D283E] shrink-0 mt-0.5">
                        <ChevronRight size={12} className={cn("transition-transform", isSelected ? "text-slate-900 dark:text-white translate-x-0.5" : "text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5")} />
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // ==========================================
              // STANDARD CLEAN ONE-TAP FILING ROW
              // ==========================================
              const companyInitials = (item.companyName || 'CA')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((w: string) => w[0])
                .join('')
                .toUpperCase() || 'CA';

              return (
                <motion.div 
                  id={`filing-${item.id || item.newsId}`}
                  key={item.id || item.newsId}
                  variants={itemFadeUpVariants}
                  transition={springSnappy}
                  onClick={() => handleSelectAnnouncement(item)}
                  className={cn(
                    "transition-colors cursor-pointer relative group px-4 py-3.5",
                    isSelected 
                      ? 'bg-slate-100/90 dark:bg-[#242036]' 
                      : 'hover:bg-slate-50/90 dark:hover:bg-[#1E1B2C]/70',
                    isFlashActive && 'ring-1 ring-slate-400 dark:ring-[#4B4368]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#221F30] border border-slate-200/80 dark:border-[#342E46] text-slate-700 dark:text-slate-300 font-extrabold text-[11px] flex items-center justify-center font-display shrink-0 select-none shadow-2xs mt-0.5">
                      {companyInitials}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Top Row: Company & Time */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate font-display tracking-tight">
                            {item.companyName}
                          </span>
                          {item.scrip_cd && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#352F48]">
                              {item.scrip_cd}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 font-medium bg-slate-50 dark:bg-[#201E2E] px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-[#2D283E]">
                          <Clock size={10} className="text-slate-400" />
                          {formatFilingRelativeTime(item.bseTime || item.fetched_at)}
                        </span>
                      </div>

                      {/* Human Title & Category Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100">
                          {cleanSub.humanTitle || 'Corporate announcement'}
                        </span>
                        {isHigh && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1 whitespace-nowrap select-none">
                            <Zap size={10} className="fill-rose-500 text-rose-500" />
                            <span>High impact</span>
                          </span>
                        )}
                        {isResults && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1 whitespace-nowrap select-none">
                            <TrendingUp size={10} className="text-emerald-500" />
                            <span>Results</span>
                          </span>
                        )}
                        {isConcall && !isResults && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 flex items-center gap-1 whitespace-nowrap select-none">
                            <Building2 size={10} className="text-sky-500" />
                            <span>Concall</span>
                          </span>
                        )}
                        {item.aiSummary && !isHigh && !isResults && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1 shrink-0 whitespace-nowrap select-none">
                            <Sparkles size={10} className="text-purple-500 fill-purple-500" />
                            <span>AI Ready</span>
                          </span>
                        )}
                        {item.is_sent === 1 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 inline-block" title="Dispatched to Telegram" />
                        )}
                      </div>

                      {/* Announcement Subject */}
                      <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-normal line-clamp-2 leading-relaxed">
                        {cleanSub.headline}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <ShareActionMenu
                        title={`${item.companyName} (${item.scrip_cd ? `BSE: ${item.scrip_cd}` : 'BSE'})`}
                        headline={cleanSub.headline || item.subject}
                        companyName={item.companyName}
                        scripCode={item.scrip_cd}
                        newsId={item.id || item.newsId}
                        category={item.category}
                        pdfUrl={item.pdfLink || item.ATTACHMENTNAME || item.attachmentName}
                        size="xs"
                      />
                      <div className="p-1 rounded bg-slate-100 dark:bg-[#201E2E] border border-slate-200/50 dark:border-[#2D283E]">
                        <ChevronRight size={12} className={cn("transition-transform", isSelected ? "text-slate-900 dark:text-white translate-x-0.5" : "text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5")} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </motion.div>
            )}

            {/* Creative Feature 10: Rich Empty State with Actionable Guidance (Left-Aligned Anchor) */}
            {paginatedItems.length === 0 && (
              <div className="my-8 p-6 sm:p-8 max-w-lg mx-auto bg-white dark:bg-[#161422] border border-slate-200/90 dark:border-[#2C2740] rounded-2xl shadow-xs space-y-4 text-left">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#252233] flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-[#352F48]">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">No corporate disclosures match criteria</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {isResultDayMode 
                      ? "No earnings results in this batch. Toggle off Result Day mode or check back soon."
                      : "Try switching category filters or clearing the search query."}
                  </p>
                </div>
                {(isResultDayMode || mutedTypes.length > 0 || search) && (
                  <div className="pt-1">
                    <motion.button
                      type="button"
                      whileTap={buttonTap}
                      transition={springSnappy}
                      onClick={() => {
                        setIsResultDayMode(false);
                        setFilterType('ALL');
                        setSearch('');
                      }}
                      className="px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-2xs hover:opacity-90 transition-all cursor-pointer select-none"
                    >
                      Reset All Filters
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clean Responsive Stream Pagination Footer */}
          <div className="p-2.5 sm:p-3 bg-slate-50/80 dark:bg-[#15141E] border-t border-slate-200 dark:border-[#2D283E] flex items-center justify-between gap-2 text-xs">
            {/* Count Indicator */}
            <div className="text-slate-500 font-mono text-[11px]">
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">{paginatedItems.length}</span> of <span className="font-bold text-slate-800 dark:text-slate-200">{filtered.length}</span> filings
            </div>

            {/* Desktop-only selector & Navigation */}
            <div className="hidden sm:flex items-center gap-2">
              <CustomDropdown
                options={[
                  { value: 25, label: '25 / page' },
                  { value: 50, label: '50 / page' },
                  { value: 100, label: '100 / page' }
                ]}
                value={itemsPerPage}
                onChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}
                size="xs"
                placement="top"
                menuWidth="w-28"
                align="left"
              />

              <motion.button 
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white dark:bg-[#252233] border border-slate-200 dark:border-[#352F48] hover:bg-slate-100 dark:hover:bg-[#2F2B40] disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              >
                Prev
              </motion.button>
              
              <span className="text-slate-600 dark:text-slate-400 font-semibold font-mono text-center px-1">
                {currentPage}/{totalPages}
              </span>

              <motion.button 
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white dark:bg-[#252233] border border-slate-200 dark:border-[#352F48] hover:bg-slate-100 dark:hover:bg-[#2F2B40] disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              >
                Next
              </motion.button>
            </div>

            {/* Mobile Stream Step Controls */}
            <div className="flex sm:hidden items-center gap-1.5">
              <motion.button 
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 min-h-[38px] bg-white dark:bg-[#252233] border border-slate-200 dark:border-[#352F48] hover:bg-slate-100 dark:hover:bg-[#2F2B40] disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                Prev
              </motion.button>
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-bold px-1">
                {currentPage}/{totalPages}
              </span>
              <motion.button 
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 min-h-[38px] bg-white dark:bg-[#252233] border border-slate-200 dark:border-[#352F48] hover:bg-slate-100 dark:hover:bg-[#2F2B40] disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                Next
              </motion.button>
            </div>
          </div>
        </div>

        {/* Right Desktop Column: Persistent Detail Drawer */}
        <div id="disclosure-detail-drawer" className="hidden lg:flex lg:col-span-1 bg-white dark:bg-[#1A1926] border border-slate-200/80 dark:border-[#2D283E] rounded-xl overflow-hidden shadow-xs flex-col lg:h-[calc(100vh-210px)] lg:min-h-[520px] lg:max-h-[860px] relative scroll-mt-20">
          {selectedItem ? (
            renderDrawerBody(selectedItem, false)
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 text-slate-400">
              <Building2 className="w-10 h-10 stroke-1 text-slate-300" />
              <p className="text-xs font-medium">Select any announcement from the left feed to preview full details, PDF attachments, and AI summaries.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Slide-Up Bottom Sheet / Modal with Framer Motion */}
      <AnimatePresence>
        {isMobileDetailOpen && selectedItem && (
          <div className="fixed inset-0 z-50 lg:hidden flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs overscroll-contain"
              onClick={() => setIsMobileDetailOpen(false)}
            />

            {/* Modal / Bottom Sheet Content Container */}
            <motion.div 
              initial={{ y: '100%', opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={springMorph}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-disclosure-detail-title"
              className="relative w-full max-w-lg bg-white dark:bg-[#1A1926] rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-[#2D283E] overflow-hidden z-10 overscroll-contain"
            >
              {/* Native Mobile Drag Handle Bar */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

              {/* Modal Header with Close Button */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-[#2D283E] flex items-center justify-between bg-slate-50/70 dark:bg-[#15141E]/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span id="mobile-disclosure-detail-title" className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Disclosure Details
                  </span>
                </div>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => setIsMobileDetailOpen(false)}
                  aria-label="Close Disclosure Details Drawer"
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#252233] rounded-lg transition-colors cursor-pointer"
                  title="Close Drawer"
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Scrollable Body */}
              {renderDrawerBody(selectedItem, true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Non-intrusive Floating Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={springSnappy}
            className="fixed bottom-5 right-5 z-50 max-w-sm w-full sm:w-auto px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 backdrop-blur-md bg-white/95 dark:bg-[#1A1926]/95 text-slate-900 dark:text-white"
            style={{
              borderColor: toastMsg.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : toastMsg.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(147, 51, 234, 0.4)'
            }}
          >
            <span className="text-xs font-semibold leading-snug flex-1">
              {toastMsg.text}
            </span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Announcements;
