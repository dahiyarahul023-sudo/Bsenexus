import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, RefreshCw, Search, Clock, Building2, Filter, 
  AlertCircle, CheckCircle2, Upload, FileText, Sparkles, 
  ExternalLink, Send, ArrowUpRight, Check, X, SlidersHorizontal,
  ChevronDown, ChevronUp, BarChart2, ListFilter, ArrowDownAZ,
  CalendarCheck, CalendarRange, Clock3, Zap, Flame, Bot, Copy,
  CalendarPlus, Download, AlertTriangle, Mail, Share2, Lock,
  CheckSquare, Square, Layers, SendHorizonal, Info, ChevronRight,
  History, BellRing, LayoutGrid, List, Bell
} from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { useIntelModal } from '../context/IntelModalContext';
import { useAiQuota, syncQuotaFromResponse } from '../utils/aiQuota';
import { useDeveloperMode } from '../utils/developerMode';
import { formatFullDateTime, formatShortDateTime, formatTimeOnly, formatDateOnly } from '../utils/timeFormat';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { checkIfDateIsTradingHoliday, generateGoogleCalendarUrl, downloadIcsCalendarFile, downloadMultiIcsCalendarFile } from '../utils/marketHolidays';
import { MarketHolidaysModal } from './ui/MarketHolidaysModal';
import { CustomDropdown, DropdownOption } from './ui/CustomDropdown';
import { ActionButton } from './ui/ActionButton';
import { HonestProgressBar } from './ui/HonestProgressBar';
import { QuarterlyResultsLedger } from './QuarterlyResultsLedger';
import { CommonQuestionsFAQ } from './ui/CommonQuestionsFAQ';
import { ShareActionMenu } from './ui/motion/ShareActionMenu';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { PullToRefreshIndicator } from './ui/PullToRefreshIndicator';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { springSnappy, springMorph, containerStaggerVariants, itemFadeUpVariants, buttonTap, cardHover } from '../utils/motionTokens';
import { getCacheItem, setCacheItem } from '../utils/cache';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseMeetingDateTile(dateStr?: string): { day: string; month: string } {
  if (!dateStr) return { day: '24', month: 'BSE' };
  const clean = dateStr.trim();
  
  // Format with space, hyphen, slash, or dot
  const parts = clean.split(/[\s\-_/.]+/);
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  if (parts.length >= 2) {
    // DD-MMM-YYYY or DD MMM YYYY (e.g., "14-Aug-2026", "14 Aug 2026", "14-08-2026")
    if (/^\d{1,2}$/.test(parts[0])) {
      const day = parts[0].padStart(2, '0');
      const m = parts[1];
      if (/^[a-zA-Z]+$/.test(m)) {
        return { day, month: m.substring(0, 3).toUpperCase() };
      }
      const monthIdx = parseInt(m, 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return { day, month: monthNames[monthIdx] };
      }
      return { day, month: m.substring(0, 3).toUpperCase() };
    }
    // YYYY-MM-DD (e.g. "2026-08-14")
    if (/^\d{4}$/.test(parts[0]) && parts[2] && /^\d{1,2}$/.test(parts[2])) {
      const day = parts[2].padStart(2, '0');
      const m = parts[1];
      const monthIdx = parseInt(m, 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return { day, month: monthNames[monthIdx] };
      }
      return { day, month: m.substring(0, 3).toUpperCase() };
    }
  }

  // Fallback using standard Date
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      return { day, month };
    }
  } catch {}

  const dayMatch = clean.match(/\b\d{1,2}\b/);
  const monthMatch = clean.match(/[a-zA-Z]{3,}/);
  return {
    day: dayMatch ? dayMatch[0].padStart(2, '0') : clean.slice(0, 2),
    month: monthMatch ? monthMatch[0].slice(0, 3).toUpperCase() : 'BSE'
  };
}

const TELEGRAM_SUCCESS_MESSAGES = [
  "🚀 Rocket Dispatched! Earnings calendar alert shot straight into your Telegram channel.",
  "⚡ Instant Delivery! Board meeting outcome beamed to your subscribers in realtime.",
  "📈 Market Alpha Delivered! Your Telegram channel received the latest financial result intelligence.",
  "✨ Bullseye! Full Gemini YoY breakdown and BSE PDF link published.",
  "💎 Precision Broadcast! Fast-track corporate disclosure delivered with zero latency."
];

const AI_THINKING_STEPS = [
  "Fetching official BSE board meeting outcome...",
  "Gemini neural model analyzing YoY Revenue & Net Profit numbers...",
  "Parsing Operating Margins & Segmental Performance...",
  "Synthesizing financial metrics summary..."
];

export interface ResultCalendarItem {
  id: string;
  symbol: string;
  scripCode: string;
  companyName: string;
  purpose: string;
  meetingDate: string;
  meetingTimestamp: number;
  daysLeft: number;
  status: 'TODAY' | 'UPCOMING' | 'RECENT' | 'PAST';
  updatedAt: string;
  isDeclared?: boolean;
  resultDeclarationTime?: string;
  declarationAnnouncementId?: string;
  declarationPdfLink?: string;
  declarationSubject?: string;
  aiSummary?: string;
}

export function ResultsCalendar() {
  const { user, profile, isAdmin, isPro, adminUnlocked, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const isSuperAdmin = Boolean(isAdmin || adminUnlocked || profile?.tier === 'admin' || user?.isAdmin);
  const { isDeveloperMode } = useDeveloperMode();
  // SWR: Initialize calendar items immediately from client cache for 0ms transition
  const [items, setItems] = useState<ResultCalendarItem[]>(() => {
    return getCacheItem<ResultCalendarItem[]>('results_calendar_items', 5 * 60 * 1000) || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCacheItem<ResultCalendarItem[]>('results_calendar_items', 5 * 60 * 1000);
    return !cached || cached.length === 0;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'today' | 'upcoming' | 'declared' | 'ai' | 'all'>('upcoming');
  const [declarationFilter, setDeclarationFilter] = useState<'all' | 'declared' | 'pending' | 'urgent_3d' | 'week_7d' | 'month_30d' | 'has_ai'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_asc' | 'date_desc' | 'status' | 'alpha'>('date_asc');
  
  // View Mode: 'grid' (default on PC/tablet) vs 'list' (default on mobile)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('nexus_calendar_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
      return typeof window !== 'undefined' && window.innerWidth >= 768 ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('nexus_calendar_view_mode', mode);
    } catch {}
  };
  
  // Multi-Selection State for adding to calendar & broadcasting to Telegram
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkBroadcasting, setIsBulkBroadcasting] = useState<boolean>(false);
  const [bulkBroadcastMsg, setBulkBroadcastMsg] = useState<string | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  const [summaryStats, setSummaryStats] = useState({ 
    upcomingCount: 0, 
    upcomingFutureCount: 0,
    todayCount: 0, 
    todayDeclaredCount: 0, 
    todayPendingCount: 0, 
    recentCount: 0,
    aiSummaryCount: 0
  });

  // Modal inspection state & animations
  const [selectedModalItem, setSelectedModalItem] = useState<ResultCalendarItem | null>(null);
  const [modalTab, setModalTab] = useState<'results' | 'meetings'>('results');
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiStepIndex, setAiStepIndex] = useState(0);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [isPlaneFlying, setIsPlaneFlying] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [lightningId, setLightningId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedCalendarId, setCopiedCalendarId] = useState<string | null>(null);
  const [showMarketHolidaysModal, setShowMarketHolidaysModal] = useState<boolean>(false);

  // Lock body scroll whenever modal or filter sheet is opened to prevent background movement / scroll chaining
  useBodyScrollLock(Boolean(selectedModalItem || showMarketHolidaysModal || isFilterSheetOpen));

  // Deep History (1-5 Years) & Pre-Result Window (10-20 Days) Priority Boost State
  const [selectedYears, setSelectedYears] = useState<number>(3);
  const [isFetchingDeepHistory, setIsFetchingDeepHistory] = useState<boolean>(false);
  const [deepHistoryMsg, setDeepHistoryMsg] = useState<string | null>(null);

  const [runupWindowDays, setRunupWindowDays] = useState<number>(10);
  const [isBoostingRunup, setIsBoostingRunup] = useState<boolean>(false);
  const [boostRunupMsg, setBoostRunupMsg] = useState<string | null>(null);
  const [expandedRunupDate, setExpandedRunupDate] = useState<string | null>(null);
  const [runupAnnouncements, setRunupAnnouncements] = useState<any[]>([]);
  const [loadingRunupAnnouncements, setLoadingRunupAnnouncements] = useState<boolean>(false);

  // Watchlist Deep Sync (1-5 Years) State
  const [isSyncingWatchlistHistory, setIsSyncingWatchlistHistory] = useState<boolean>(false);
  const [watchlistDeepSyncYears, setWatchlistDeepSyncYears] = useState<number>(3);
  const [watchlistSyncFeedback, setWatchlistSyncFeedback] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const isProOrAdmin = Boolean(isAdmin || (isPro && !user?.isAnonymous) || profile?.tier === 'admin');
  const aiQuota = useAiQuota(user, profile, isPro, isAdmin);
  const isTelegramConnected = Boolean(profile?.telegramChatId || user?.telegramChatId);

  // Deep History Fetcher for Single Stock (1-5 Years)
  const handleFetchDeepHistory = async (scripCode: string, symbol: string, years: number) => {
    if (!scripCode) return;
    setIsFetchingDeepHistory(true);
    setDeepHistoryMsg(null);

    try {
      const res = await customFetch(`/api/stocks/${encodeURIComponent(scripCode)}/fetch-deep-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, years })
      });
      const data = await res.json();
      if (data && data.success) {
        setDeepHistoryMsg(`✅ Fetched +${data.newlySaved || 0} historical filings (${years} Yr BSE Sync). Total ${data.totalHistoryCount || 0} results/meetings indexed.`);
        // Reload stock history
        const histRes = await customFetch(`/api/stock-results-history?symbol=${encodeURIComponent(symbol)}&scripCode=${encodeURIComponent(scripCode)}`);
        const histData = await histRes.json();
        if (histData && Array.isArray(histData.history)) {
          setStockHistory(histData.history);
        }
        // Refresh general calendar
        fetchCalendar(false);
      } else {
        setDeepHistoryMsg(`⚠️ Sync notice: ${data?.error || 'Unable to fetch historical filings from BSE'}`);
      }
    } catch (err: any) {
      setDeepHistoryMsg(`❌ Error fetching deep history: ${err.message}`);
    } finally {
      setIsFetchingDeepHistory(false);
      setTimeout(() => setDeepHistoryMsg(null), 7000);
    }
  };

  // Boost Priority for 10/20-day Pre-Result Window
  const handleBoostRunupPriority = async (scripCode: string, symbol: string, resultDateStr: string, customDays?: number) => {
    if (!scripCode || !resultDateStr) return;
    const daysToUse = customDays || runupWindowDays || 10;
    setIsBoostingRunup(true);
    setBoostRunupMsg(null);

    try {
      const res = await customFetch(`/api/stocks/${encodeURIComponent(scripCode)}/boost-runup-priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, resultDate: resultDateStr, windowDays: daysToUse })
      });
      const data = await res.json();
      if (data && data.success) {
        setBoostRunupMsg(`🔥 Set ${data.boostedCount || 0} announcements from ${daysToUse} days before ${resultDateStr} to HIGH Priority!`);
        // Refresh runup list if expanded
        if (expandedRunupDate === resultDateStr) {
          setRunupAnnouncements(data.announcements || []);
        }
        // Reload stock history
        const histRes = await customFetch(`/api/stock-results-history?symbol=${encodeURIComponent(symbol)}&scripCode=${encodeURIComponent(scripCode)}`);
        const histData = await histRes.json();
        if (histData && Array.isArray(histData.history)) {
          setStockHistory(histData.history);
        }
        // Refresh main calendar
        fetchCalendar(false);
      } else {
        setBoostRunupMsg(`⚠️ ${data?.error || 'Could not boost pre-result priority'}`);
      }
    } catch (err: any) {
      setBoostRunupMsg(`❌ Boost error: ${err.message}`);
    } finally {
      setIsBoostingRunup(false);
      setTimeout(() => setBoostRunupMsg(null), 6000);
    }
  };

  // Toggle & Load Pre-Result 10/20-Day Runup Announcements
  const toggleRunupAnnouncements = async (scripCode: string, symbol: string, resultDateStr: string, customDays?: number) => {
    const daysToUse = customDays || runupWindowDays || 10;
    if (expandedRunupDate === resultDateStr) {
      setExpandedRunupDate(null);
      setRunupAnnouncements([]);
      return;
    }

    setExpandedRunupDate(resultDateStr);
    setLoadingRunupAnnouncements(true);
    try {
      const res = await customFetch(`/api/stocks/${encodeURIComponent(scripCode)}/runup-announcements?symbol=${encodeURIComponent(symbol)}&resultDate=${encodeURIComponent(resultDateStr)}&windowDays=${daysToUse}`);
      const data = await res.json();
      if (data && Array.isArray(data.announcements)) {
        setRunupAnnouncements(data.announcements);
      } else {
        setRunupAnnouncements([]);
      }
    } catch {
      setRunupAnnouncements([]);
    } finally {
      setLoadingRunupAnnouncements(false);
    }
  };

  // Deep Sync 1-5 Years for entire Watchlist
  const handleDeepSyncWatchlist = async (years: number) => {
    setIsSyncingWatchlistHistory(true);
    setWatchlistSyncFeedback(null);
    try {
      const res = await customFetch('/api/watchlist/fetch-deep-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ years })
      });
      const data = await res.json();
      if (data && data.success) {
        setWatchlistSyncFeedback(`✅ Successfully synced ${years}-Year history across ${data.symbolsCount || 0} watchlist stocks (+${data.newlySaved || 0} historical filings)!`);
        fetchCalendar(true);
      } else {
        setWatchlistSyncFeedback(`⚠️ Notice: ${data?.error || 'Sync completed with warnings'}`);
      }
    } catch (err: any) {
      setWatchlistSyncFeedback(`❌ Sync failed: ${err.message}`);
    } finally {
      setIsSyncingWatchlistHistory(false);
      setTimeout(() => setWatchlistSyncFeedback(null), 8000);
    }
  };

  // Fetch previous results history whenever a company is opened
  useEffect(() => {
    if (selectedModalItem) {
      setLoadingHistory(true);
      customFetch(`/api/stock-results-history?symbol=${encodeURIComponent(selectedModalItem.symbol)}&scripCode=${encodeURIComponent(selectedModalItem.scripCode || '')}&companyName=${encodeURIComponent(selectedModalItem.companyName || '')}`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.history)) {
            setStockHistory(data.history);
          } else {
            setStockHistory([]);
          }
        })
        .catch(() => setStockHistory([]))
        .finally(() => setLoadingHistory(false));
    } else {
      setStockHistory([]);
    }
  }, [selectedModalItem]);

  // Cycle through AI thinking steps
  useEffect(() => {
    if (!isGeneratingAi) return;
    const interval = setInterval(() => {
      setAiStepIndex(prev => (prev + 1) % AI_THINKING_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [isGeneratingAi]);

  // Reset subfilter & page when switching main status tabs so reasoning remains clean
  const handleTabChange = (newTab: 'today' | 'upcoming' | 'declared' | 'ai' | 'all') => {
    setStatusFilter(newTab);
    setDeclarationFilter('all');
    setCurrentPage(1);
  };

  const handleSelectItem = (item: ResultCalendarItem) => {
    setSelectedModalItem(item);
    setLightningId(item.id);
    setCopiedSummary(false);
    setTimeout(() => setLightningId(null), 850);
  };

  const handleCopySummary = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const { openIntelModal } = useIntelModal();

  const handleOpenIntel = (scripCode?: string, symbol?: string, companyName?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    openIntelModal({ scripCode, symbol: symbol || companyName, companyName: companyName || symbol });
  };

  const fetchCalendar = async (force: boolean = false, mode: 'quick' | 'full' = 'quick') => {
    if (force) {
      setRefreshing(true);
    } else if (items.length === 0) {
      setLoading(true);
    }

    try {
      const endpoint = force ? '/api/results-calendar/refresh' : '/api/results-calendar';
      const method = force ? 'POST' : 'GET';
      const url = `${endpoint}?filter=all${selectedWatchlistId ? `&watchlistId=${selectedWatchlistId}` : ''}${force && mode === 'full' ? '&mode=full' : ''}`;

      const res = await customFetch(url, { method });
      if (res.ok) {
        const data = await res.json();
        const fetchedItems = data.items || [];
        setItems(fetchedItems);
        setCacheItem('results_calendar_items', fetchedItems);
        setLastUpdated(data.lastUpdated || Date.now());
        
        const todayCount = data.todayCount ?? 0;
        const upcomingFutureCount = data.upcomingFutureCount ?? (data.upcomingCount ? Math.max(0, data.upcomingCount - todayCount) : 0);
        const recentCount = data.recentCount ?? 0;
        const aiSummaryCount = data.aiSummaryCount ?? fetchedItems.filter((i: any) => Boolean(i.aiSummary)).length;

        setSummaryStats({
          upcomingCount: data.upcomingCount ?? (todayCount + upcomingFutureCount),
          upcomingFutureCount,
          todayCount,
          todayDeclaredCount: data.todayDeclaredCount ?? 0,
          todayPendingCount: data.todayPendingCount ?? 0,
          recentCount,
          aiSummaryCount
        });

        if (data.background) {
          setWatchlistSyncFeedback("⚡ Full library deep scan running seamlessly in the background. Calendar is live and accessible!");
          setTimeout(() => setWatchlistSyncFeedback(null), 6000);
        }

        // Automatically default to Results Archive (declared) if both Today and Upcoming are empty
        if (todayCount === 0 && upcomingFutureCount === 0) {
          setStatusFilter('declared');
        } else if (statusFilter === 'today' && todayCount === 0) {
          if (upcomingFutureCount > 0) {
            setStatusFilter('upcoming');
          } else {
            setStatusFilter('declared');
          }
        } else if (statusFilter === 'upcoming' && upcomingFutureCount === 0) {
          if (todayCount > 0) {
            setStatusFilter('today');
          } else {
            setStatusFilter('declared');
          }
        }
      }
    } catch (err) {
      console.error('Error loading results calendar:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWatchlists = async () => {
    if (!user && !profile) {
      setWatchlists([]);
      return;
    }
    try {
      const res = await customFetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data || []);
      }
    } catch (err) {
      console.error('Error loading watchlists:', err);
    }
  };

  useEffect(() => {
    document.title = 'BSE Results Calendar — Upcoming Quarterly Results & Earnings Dates | BSE Nexus';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Track upcoming BSE quarterly results, board meeting dates, earnings releases, and financial result disclosures for Indian listed companies live on BSE Nexus.');
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://bsenexus.in/results-calendar');
    fetchWatchlists();
  }, []);

  useEffect(() => {
    // Fetch on initial mount or when selected watchlist changes
    fetchCalendar(false);
  }, [selectedWatchlistId]);

  // Native Pull to Refresh Hook for Earnings Calendar
  const { 
    containerRef: calendarContainerRef, 
    pullDistance: calPullDist, 
    isPulling: isCalPulling, 
    isRefreshing: isCalRefreshing, 
    progress: calPullProg 
  } = usePullToRefresh<HTMLDivElement>({
    onRefresh: async () => {
      await fetchCalendar(true, 'quick');
    }
  });

  const handleGenerateSummary = async (announcementId?: string) => {
    if (!announcementId) return;

    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      alert('🔒 Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro AI summaries!');
      return;
    }

    if (!isProOrAdmin) {
      setIsProModalOpen(true);
      alert('🔒 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) for unlimited Gemini AI summaries!');
      return;
    }

    if (!aiQuota.canGenerate) {
      alert('🔒 Daily Pro AI limit reached (100 summaries/day). Resets at 00:00 IST.');
      return;
    }

    setIsGeneratingAi(true);
    setAiStepIndex(0);
    try {
      const res = await customFetch(`/api/announcements/${announcementId}/generate-summary`, { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        alert(data?.error || '🔒 Google Sign-In Required: Sign in to enjoy 1 week of Free Pro AI features.');
        return;
      }

      if (res.status === 429) {
        syncQuotaFromResponse(data || { remainingQuota: 0 });
        const errMsg = data?.error || 'Daily AI summary quota reached.';
        alert(`🔒 ${errMsg}`);
        return;
      }

      if (res.ok && data && data.aiSummary) {
        syncQuotaFromResponse(data);
        setSelectedModalItem(prev => prev ? { ...prev, aiSummary: data.aiSummary } : prev);
        setItems(prev => prev.map(i => i.declarationAnnouncementId === announcementId ? { ...i, aiSummary: data.aiSummary } : i));
      } else {
        const errMsg = data?.error || 'Failed to generate AI summary';
        alert(`⚠️ AI Summary Alert: ${errMsg}`);
      }
    } catch (e: any) {
      console.error('Failed to generate summary:', e);
      alert(`⚠️ AI processing error: ${e?.message || 'Connection error'}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const getCalendarLink = (item: ResultCalendarItem) => {
    return generateGoogleCalendarUrl({
      title: `BSE: ${item.symbol} Board Meeting (${item.purpose})`,
      description: `Company: ${item.companyName}\nSymbol: ${item.symbol} (BSE: ${item.scripCode})\nMeeting Purpose: ${item.purpose}\nScheduled Date: ${item.meetingDate}\n\nTrack real-time outcomes on BSE Nexus.`,
      dateStr: item.meetingDate
    });
  };

  const handleManualSendTelegram = async (item: ResultCalendarItem) => {
    if (!item) return;

    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      alert('🔒 Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial to broadcast to Telegram!');
      return;
    }

    if (!isProOrAdmin) {
      setIsProModalOpen(true);
      alert('🔒 Direct Telegram Broadcasting is a Pro & Admin feature.\n\nYour 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) to dispatch alerts to Telegram!');
      return;
    }

    setIsSendingTelegram(true);
    setIsPlaneFlying(true);
    setTelegramStatus(null);

    const randomMsg = TELEGRAM_SUCCESS_MESSAGES[Math.floor(Math.random() * TELEGRAM_SUCCESS_MESSAGES.length)];
    const calendarLink = getCalendarLink(item);

    try {
      const res = await customFetch('/api/send-to-telegram-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsId: item.declarationAnnouncementId || item.id,
          companyName: item.companyName,
          subject: item.declarationSubject || `Financial Results & Board Meeting: ${item.purpose}`,
          details: `Board Meeting for ${item.companyName} (${item.symbol}). Purpose: ${item.purpose}. Scheduled Date: ${item.meetingDate}`,
          category: 'RESULTS',
          pdfLink: item.declarationPdfLink || '',
          scripCode: item.scripCode,
          calendarUrl: calendarLink
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramStatus(randomMsg);
      } else {
        alert(data.error || 'Failed to dispatch to Telegram');
      }
    } catch (err: any) {
      alert('Failed to dispatch: ' + err.message);
    } finally {
      setIsSendingTelegram(false);
      setTimeout(() => setIsPlaneFlying(false), 1200);
    }
  };

  const handleShareEmail = (item: ResultCalendarItem) => {
    const calendarLink = getCalendarLink(item);
    const holidayCheck = checkIfDateIsTradingHoliday(item.meetingDate);
    const subject = encodeURIComponent(`BSE Board Meeting Reminder: ${item.companyName} (${item.symbol}) - ${item.meetingDate}`);
    const body = encodeURIComponent(
      `Hello,\n\nHere are the details for the scheduled BSE Board Meeting:\n\n` +
      `Company: ${item.companyName}\n` +
      `Symbol: ${item.symbol} (BSE Scrip Code: ${item.scripCode})\n` +
      `Purpose: ${item.purpose}\n` +
      `Scheduled Date: ${item.meetingDate}\n` +
      (holidayCheck.isClosed ? `Notice: Date falls on ${holidayCheck.holidayName || holidayCheck.weekendName} (Exchange closed)\n` : '') +
      `\n📅 Add to Google Calendar (1-Click):\n${calendarLink}\n\n` +
      `Track real-time outcomes on BSE Nexus.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleCopyCalendarLink = (item: ResultCalendarItem) => {
    const calendarLink = getCalendarLink(item);
    navigator.clipboard.writeText(calendarLink);
    setCopiedCalendarId(item.id);
    setTimeout(() => setCopiedCalendarId(null), 2000);
  };

  // Selection handlers
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (paginatedItems.length === 0) return;
    const allVisibleSelected = paginatedItems.every(i => selectedIds.has(i.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        paginatedItems.forEach(i => next.delete(i.id));
      } else {
        paginatedItems.forEach(i => next.add(i.id));
      }
      return next;
    });
  };

  const handleSelectAllUpcoming = () => {
    const upcoming = items.filter(i => i.daysLeft >= 0 || i.status === 'TODAY' || i.status === 'UPCOMING');
    setSelectedIds(new Set(upcoming.map(i => i.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk Export .ICS (Compatible with Apple Calendar, iOS, macOS, Windows Outlook & Google Calendar)
  const handleBulkExportIcs = () => {
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    const events = selectedItems.map(item => ({
      title: `BSE: ${item.symbol} Board Meeting (${item.purpose})`,
      description: `Company: ${item.companyName}\nSymbol: ${item.symbol} (BSE: ${item.scripCode})\nAgenda: ${item.purpose}\nScheduled Date: ${item.meetingDate}\n\nTrack real-time outcomes on BSE Nexus.`,
      dateStr: item.meetingDate,
      location: 'BSE India / Corporate Headquarters'
    }));

    downloadMultiIcsCalendarFile(events, `BSE_Selected_Meetings_${new Date().toISOString().split('T')[0]}.ics`);
  };

  // Bulk Broadcast Selected items to Telegram
  const handleBulkSendSelectedTelegram = async () => {
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      alert('🔒 Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial to broadcast to Telegram!');
      return;
    }

    if (!isProOrAdmin) {
      setIsProModalOpen(true);
      alert('🔒 Telegram Broadcasting is a Pro feature.\n\nYour 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) to broadcast to Telegram!');
      return;
    }

    setIsBulkBroadcasting(true);
    setBulkBroadcastMsg(`Broadcasting ${selectedItems.length} selected board meeting(s) to Telegram...`);

    let sent = 0;
    for (const item of selectedItems) {
      try {
        const calLink = getCalendarLink(item);
        const res = await customFetch('/api/send-to-telegram-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newsId: item.declarationAnnouncementId || item.id,
            companyName: item.companyName,
            subject: item.declarationSubject || `Board Meeting Scheduled: ${item.purpose}`,
            details: `Board Meeting for ${item.companyName} (${item.symbol}). Purpose: ${item.purpose}. Scheduled Date: ${item.meetingDate}`,
            category: 'RESULTS',
            pdfLink: item.declarationPdfLink || '',
            scripCode: item.scripCode,
            calendarUrl: calLink
          })
        });
        if (res.ok) sent++;
      } catch (e) {
        console.error('Error sending item in bulk:', e);
      }
    }

    setIsBulkBroadcasting(false);
    setBulkBroadcastMsg(`✅ Successfully sent ${sent}/${selectedItems.length} selected meeting(s) to Telegram!`);
    setTimeout(() => setBulkBroadcastMsg(null), 4000);
  };

  // Broadcast All Upcoming Board Meetings to Telegram
  const handleBroadcastAllUpcoming = async (forceAll: boolean = false) => {
    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      alert('🔒 Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial to broadcast to Telegram!');
      return;
    }

    if (!isProOrAdmin) {
      setIsProModalOpen(true);
      alert('🔒 Telegram Broadcasting is a Pro feature.\n\nYour 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) to broadcast to Telegram!');
      return;
    }

    setIsBulkBroadcasting(true);
    setBulkBroadcastMsg('Broadcasting upcoming board meetings schedule to Telegram...');

    try {
      const res = await customFetch('/api/results-calendar/telegram-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceAll })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBulkBroadcastMsg(`✅ ${data.message || `Broadcast ${data.count} meetings to Telegram.`}`);
      } else {
        alert(data.error || 'Failed to broadcast upcoming meetings to Telegram');
        setBulkBroadcastMsg(null);
      }
    } catch (err: any) {
      alert('Error broadcasting to Telegram: ' + err.message);
      setBulkBroadcastMsg(null);
    } finally {
      setIsBulkBroadcasting(false);
      setTimeout(() => setBulkBroadcastMsg(null), 4500);
    }
  };

  // Filter and sort items with useMemo
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];
    const isSearching = Boolean(searchQuery.trim());

    // Build active watchlist symbols & scrips
    const activeWatchlistSymbols = new Set<string>();
    const activeWatchlistScrips = new Set<string>();

    const targetLists = selectedWatchlistId 
      ? watchlists.filter(w => String(w.id) === String(selectedWatchlistId))
      : watchlists.filter(w => w.is_active !== 0);

    targetLists.forEach(w => {
      (w.items || []).forEach((it: any) => {
        const sym = typeof it === 'string' ? it.split(':')[0] : (it?.symbol || '');
        if (sym) activeWatchlistSymbols.add(sym.toUpperCase().trim());
        const scrip = typeof it === 'object' && it.scripCode ? String(it.scripCode).trim() : '';
        if (scrip) activeWatchlistScrips.add(scrip);
      });
    });

    // If NOT searching, filter by active watchlist stocks
    if (!isSearching) {
      if (watchlists.length > 0 && activeWatchlistSymbols.size === 0 && selectedWatchlistId) {
        return [];
      }

      if (activeWatchlistSymbols.size > 0) {
        result = result.filter(item => {
          const sym = (item.symbol || '').toUpperCase().trim();
          const scrip = item.scripCode ? String(item.scripCode).trim() : '';
          return activeWatchlistSymbols.has(sym) || (scrip && activeWatchlistScrips.has(scrip));
        });
      }
    }

    // 1. Status Filter
    if (statusFilter === 'today') {
      result = result.filter(i => i.status === 'TODAY' || i.daysLeft === 0);
    } else if (statusFilter === 'upcoming') {
      result = result.filter(i => i.status === 'UPCOMING' || i.daysLeft > 0);
    } else if (statusFilter === 'declared') {
      // Declared or Recent past 30 days
      result = result.filter(i => i.isDeclared || i.status === 'RECENT' || (i.daysLeft < 0 && i.daysLeft >= -30));
    } else if (statusFilter === 'ai') {
      result = result.filter(i => Boolean(i.aiSummary));
    }

    // 2. Contextual Sub-Filter
    if (declarationFilter === 'declared') {
      result = result.filter(i => i.isDeclared === true);
    } else if (declarationFilter === 'pending') {
      result = result.filter(i => !i.isDeclared);
    } else if (declarationFilter === 'urgent_3d') {
      result = result.filter(i => i.daysLeft >= 1 && i.daysLeft <= 3);
    } else if (declarationFilter === 'week_7d') {
      result = result.filter(i => i.daysLeft >= 1 && i.daysLeft <= 7);
    } else if (declarationFilter === 'month_30d') {
      result = result.filter(i => i.daysLeft >= 1 && i.daysLeft <= 30);
    } else if (declarationFilter === 'has_ai') {
      result = result.filter(i => Boolean(i.aiSummary));
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        (item.symbol || '').toLowerCase().includes(q) ||
        (item.companyName || '').toLowerCase().includes(q) ||
        (item.scripCode || '').includes(q) ||
        (item.purpose || '').toLowerCase().includes(q) ||
        (item.declarationSubject || '').toLowerCase().includes(q)
      );
    }

    // 4. Sorting
    if (sortBy === 'date_asc') {
      if (statusFilter === 'all') {
        const upcoming = result.filter(i => i.daysLeft >= 0).sort((a, b) => a.meetingTimestamp - b.meetingTimestamp);
        const past = result.filter(i => i.daysLeft < 0).sort((a, b) => b.meetingTimestamp - a.meetingTimestamp);
        result = [...upcoming, ...past];
      } else {
        result.sort((a, b) => a.meetingTimestamp - b.meetingTimestamp);
      }
    } else if (sortBy === 'date_desc') {
      result.sort((a, b) => b.meetingTimestamp - a.meetingTimestamp);
    } else if (sortBy === 'status') {
      result.sort((a, b) => {
        if (a.isDeclared && !b.isDeclared) return -1;
        if (!a.isDeclared && b.isDeclared) return 1;
        return a.daysLeft - b.daysLeft;
      });
    } else if (sortBy === 'alpha') {
      result.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
    }

    return result;
  }, [items, statusFilter, declarationFilter, searchQuery, sortBy]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, declarationFilter, searchQuery, selectedWatchlistId, sortBy]);

  // Dynamic live horizon counts for upcoming tab
  const upcomingItems = useMemo(() => items.filter(i => i.status === 'UPCOMING' || i.daysLeft > 0), [items]);
  const next3dCount = useMemo(() => upcomingItems.filter(i => i.daysLeft >= 1 && i.daysLeft <= 3).length, [upcomingItems]);
  const next7dCount = useMemo(() => upcomingItems.filter(i => i.daysLeft >= 1 && i.daysLeft <= 7).length, [upcomingItems]);
  const next30dCount = useMemo(() => upcomingItems.filter(i => i.daysLeft >= 1 && i.daysLeft <= 30).length, [upcomingItems]);

  // Dynamic counts for recent & all sub-filters
  const recentItems = useMemo(() => items.filter(i => i.status === 'RECENT' || (i.daysLeft < 0 && i.daysLeft >= -30)), [items]);
  const recentAiCount = useMemo(() => recentItems.filter(i => Boolean(i.aiSummary)).length, [recentItems]);
  const recentDeclaredCount = useMemo(() => recentItems.filter(i => i.isDeclared === true).length, [recentItems]);

  const allAiCount = useMemo(() => items.filter(i => Boolean(i.aiSummary)).length, [items]);
  const allDeclaredCount = useMemo(() => items.filter(i => i.isDeclared === true).length, [items]);
  const allPendingCount = useMemo(() => items.filter(i => !i.isDeclared && i.daysLeft >= 0).length, [items]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedItems, currentPage, itemsPerPage]);

  const formatLastUpdated = (ts: number) => {
    if (!ts) return 'Never';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  // Total unique symbols across watchlists
  const RESULTS_CALENDAR_TABS = ['today', 'upcoming', 'declared', 'ai', 'all'] as const;

  const handleSwipeLeft = () => {
    const currentIdx = RESULTS_CALENDAR_TABS.indexOf(statusFilter as any);
    if (currentIdx < RESULTS_CALENDAR_TABS.length - 1) {
      handleTabChange(RESULTS_CALENDAR_TABS[currentIdx + 1]);
    }
  };

  const handleSwipeRight = () => {
    const currentIdx = RESULTS_CALENDAR_TABS.indexOf(statusFilter as any);
    if (currentIdx > 0) {
      handleTabChange(RESULTS_CALENDAR_TABS[currentIdx - 1]);
    }
  };

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 45
  });

  const uniqueWatchlistStocksCount = useMemo(() => {
    const syms = new Set<string>();
    watchlists.forEach(w => {
      (w.items || []).forEach((it: any) => {
        const sym = typeof it === 'string' ? it.split(':')[0] : (it?.symbol || '');
        if (sym) syms.add(sym.toUpperCase());
      });
    });
    return syms.size;
  }, [watchlists]);

  // Watchlist dropdown options for CustomDropdown
  const watchlistOptions: DropdownOption[] = [
    { 
      value: '', 
      label: 'All Active Watchlists', 
      count: uniqueWatchlistStocksCount || undefined, 
      icon: ListFilter 
    },
    ...watchlists.map(w => ({
      value: w.id,
      label: w.name,
      count: w.items?.length || 0,
      icon: Building2
    }))
  ];

  // Sort dropdown options for CustomDropdown
  const sortOptions: DropdownOption[] = [
    { value: 'date_asc', label: 'Meeting Date (Earliest First)', icon: Clock3 },
    { value: 'date_desc', label: 'Meeting Date (Latest First)', icon: CalendarRange },
    { value: 'status', label: 'Declared Results First', icon: Sparkles },
    { value: 'alpha', label: 'Company Name (A-Z)', icon: ArrowDownAZ },
  ];

  // Split history into Financial Results (1 canonical Result per Quarter) vs Board Meetings
  const financialResultsHistory = useMemo(() => {
    const rawResults = stockHistory.filter(h => h.isOutcome && !h.periodOrMeeting?.toLowerCase().startsWith('board meeting:'));
    const map = new Map<string, any>();
    
    rawResults.forEach(item => {
      const key = (item.quarterKey || item.periodOrMeeting || item.declarationDate || item.meetingDate || item.id).trim();
      if (!map.has(key)) {
        map.set(key, item);
      } else {
        const existing = map.get(key);
        // Prefer outcome with pdfLink or more recent timestamp
        if ((!existing.pdfLink && item.pdfLink) || ((item.submissionTimestamp || 0) > (existing.submissionTimestamp || 0) && item.pdfLink)) {
          map.set(key, item);
        }
      }
    });

    if (selectedModalItem && selectedModalItem.isDeclared) {
      const modalQuarterKey = selectedModalItem.quarterKey || `current-${selectedModalItem.meetingDate}`;
      const hasDuplicate = Array.from(map.values()).some(x => 
        (x.quarterKey && selectedModalItem.quarterKey && x.quarterKey === selectedModalItem.quarterKey) ||
        x.meetingDate === selectedModalItem.meetingDate || 
        x.declarationDate === selectedModalItem.meetingDate
      );
      if (!hasDuplicate) {
        map.set(modalQuarterKey, {
          id: selectedModalItem.id,
          quarterKey: selectedModalItem.quarterKey,
          periodOrMeeting: selectedModalItem.purpose || `Financial Results (${selectedModalItem.meetingDate})`,
          meetingDate: selectedModalItem.meetingDate,
          boardMeetingDate: selectedModalItem.meetingDate,
          declarationDate: selectedModalItem.resultDeclarationTime ? formatDateOnly(selectedModalItem.resultDeclarationTime) : selectedModalItem.meetingDate,
          declarationTime: selectedModalItem.resultDeclarationTime ? formatTimeOnly(selectedModalItem.resultDeclarationTime) : '',
          declaredAtFormatted: selectedModalItem.resultDeclarationTime || `${selectedModalItem.meetingDate} IST`,
          exactDateTimeStr: selectedModalItem.resultDeclarationTime ? formatFullDateTime(selectedModalItem.resultDeclarationTime) : selectedModalItem.meetingDate,
          submissionTimestamp: selectedModalItem.meetingTimestamp || Date.now(),
          subject: selectedModalItem.declarationSubject || selectedModalItem.purpose,
          details: selectedModalItem.purpose,
          pdfLink: selectedModalItem.declarationPdfLink,
          aiSummary: selectedModalItem.aiSummary,
          isOutcome: true,
          status: "Declared",
          priority: 'HIGH',
          followUpFilings: [],
          followUpCount: 0
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.submissionTimestamp || 0) - (a.submissionTimestamp || 0));
  }, [stockHistory, selectedModalItem]);

  const boardMeetingsHistory = useMemo(() => {
    return stockHistory.filter(h => !h.isOutcome || h.periodOrMeeting?.toLowerCase().includes('board meeting') || h.status?.includes('Upcoming') || h.status?.includes('Meeting'));
  }, [stockHistory]);

  return (
    <div ref={calendarContainerRef} className="space-y-2 overscroll-y-contain relative">
      {/* Pull to Refresh Animated Indicator for Earnings & Results Calendar */}
      <PullToRefreshIndicator 
        pullDistance={calPullDist}
        isPulling={isCalPulling}
        isRefreshing={isCalRefreshing}
        progress={calPullProg}
        label="Results Calendar"
      />

      {/* Compact Streamlined Unified Toolbar: Sticky below navbar - Title, Search, Filter & Single Tab Row */}
      <div className="sticky top-14 md:top-[89px] z-30 bg-white/95 dark:bg-[#1A1926]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col gap-2">
        {/* Row 1: Title, Search Box & Filter Bottom Sheet Trigger */}
        <div className="flex items-center gap-2 justify-between">
          
          {/* Left: Scope Title, Count & Timestamp */}
          <div className="flex items-center gap-1.5 shrink-0">
            <CalendarDays className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display whitespace-nowrap">
              BSE Results Calendar
            </h1>
            <span className="text-xs text-slate-500 font-mono">
              ({filteredAndSortedItems.length})
            </span>
            {lastUpdated > 0 && (
              <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">
                • Updated {formatTimeOnly(lastUpdated)}
              </span>
            )}
          </div>

          {/* Center: Search Box (44px min height on mobile) */}
          <div className="relative flex-1 max-w-lg min-h-[44px] sm:min-h-[36px] flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search symbol, company, scrip..."
              className="w-full h-10 sm:h-9 pl-8 pr-7 bg-slate-50 dark:bg-[#15141E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Right: Filter & View Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Desktop View Switcher */}
            <div className="hidden md:flex items-center gap-0.5 bg-slate-100 dark:bg-[#201E2E] p-0.5 rounded-lg border border-slate-200 dark:border-[#2D283E]">
              <button
                type="button"
                onClick={() => handleSetViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-md text-xs transition-all flex items-center gap-1 cursor-pointer select-none",
                  viewMode === 'grid'
                    ? "bg-white dark:bg-[#2E2A42] text-slate-900 dark:text-white font-bold shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
                title="Grid View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('list')}
                className={cn(
                  "p-1.5 rounded-md text-xs transition-all flex items-center gap-1 cursor-pointer select-none",
                  viewMode === 'list'
                    ? "bg-white dark:bg-[#2E2A42] text-slate-900 dark:text-white font-bold shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
                title="List View"
              >
                <List size={13} />
              </button>
            </div>

            {/* Filter & Actions Trigger with Chevron */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setIsFilterSheetOpen(true)}
              className={cn(
                "min-h-[44px] sm:min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none border",
                (selectedWatchlistId || sortBy !== 'date_asc' || declarationFilter !== 'all')
                  ? "bg-slate-100 dark:bg-[#252233] text-slate-900 dark:text-white border-slate-300 dark:border-[#3E3854]"
                  : "bg-white dark:bg-[#1A1926] hover:bg-slate-50 dark:hover:bg-[#222030] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
              )}
              title="Filter by Watchlist, Sort & Date Horizon"
            >
              <span>Filter</span>
              <ChevronDown size={13} className="text-slate-500" />
              {(selectedWatchlistId || sortBy !== 'date_asc' || declarationFilter !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Row 2: Plain Text Tabs with Single Active Underline */}
        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100 dark:border-[#2D283E]/60 text-xs">
          {[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'today', label: 'Today' },
            { id: 'declared', label: 'Results Archive' },
          ].map(tab => {
            const isTabActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id as any)}
                className={cn(
                  "relative py-1.5 font-medium transition-colors cursor-pointer whitespace-nowrap select-none",
                  isTabActive
                    ? "text-slate-900 dark:text-white font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <span>{tab.label}</span>
                {isTabActive && (
                  <motion.div
                    layoutId="activeCalendarTabUnderline"
                    transition={springSnappy}
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white rounded-full"
                  />
                )}
              </button>
            );
          })}

          {/* Sub-Filter Reset Button if Active */}
          {(selectedWatchlistId || sortBy !== 'date_asc' || declarationFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedWatchlistId('');
                setSortBy('date_asc');
                setDeclarationFilter('all');
              }}
              className="py-1 px-2 text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer shrink-0 ml-auto"
            >
              <span>Reset Filters</span>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Filter & Operations Bottom Sheet */}
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
              className="relative w-full sm:max-w-lg bg-white dark:bg-[#1A1926] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overscroll-contain space-y-4 z-10 safe-area-bottom"
            >
              {/* Drag handle for mobile */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2D283E] pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                    Earnings Filters
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Section 1: Developer/Operator Only Operations (Admin Only) */}
              {isSuperAdmin && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E]">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Operator Controls</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">TERMINAL</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <ActionButton
                      onClick={() => fetchCalendar(true, 'quick')}
                      isLoading={refreshing}
                      loadingText="Syncing..."
                      variant="primary"
                      size="md"
                      className="min-h-[44px] justify-center"
                    >
                      Quick Sync
                    </ActionButton>

                    <button
                      type="button"
                      onClick={() => fetchCalendar(true, 'full')}
                      disabled={refreshing || loading}
                      className="min-h-[44px] px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#201E2E] dark:hover:bg-[#2D283E] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#2D283E] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.97]"
                    >
                      <Zap size={13} className="text-amber-500" />
                      <span>Full Audit</span>
                    </button>

                    <ActionButton
                      onClick={() => handleBroadcastAllUpcoming(false)}
                      isLoading={isBulkBroadcasting}
                      loadingText="Broadcasting..."
                      disabled={summaryStats.upcomingFutureCount === 0}
                      variant="secondary"
                      size="md"
                      className="min-h-[44px] justify-center col-span-2 sm:col-span-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                      icon={<SendHorizonal size={13} />}
                    >
                      Broadcast
                    </ActionButton>
                  </div>

                  {/* Deep Sync 1-5 Years */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <CustomDropdown
                          options={[
                            { value: 1, label: '1Y History' },
                            { value: 2, label: '2Y History' },
                            { value: 3, label: '3Y History' },
                            { value: 5, label: '5Y History' }
                          ]}
                          value={watchlistDeepSyncYears}
                          onChange={(val) => setWatchlistDeepSyncYears(Number(val))}
                          size="sm"
                        />
                      </div>
                      <ActionButton
                        onClick={() => handleDeepSyncWatchlist(watchlistDeepSyncYears)}
                        isLoading={isSyncingWatchlistHistory}
                        loadingText="Syncing..."
                        variant="secondary"
                        size="md"
                        className="min-h-[44px] bg-slate-800 hover:bg-slate-700 dark:bg-[#2E2942] text-white"
                        icon={<History size={13} />}
                      >
                        Deep Sync
                      </ActionButton>
                    </div>

                    {isSyncingWatchlistHistory && (
                      <div className="animate-in fade-in duration-200">
                        <HonestProgressBar
                          color="indigo"
                          isRunning={true}
                          simulatedSteps={[
                            { label: `Connecting to BSE archives for ${watchlistDeepSyncYears}Y meeting history...`, durationMs: 1400 },
                            { label: 'Syncing board meeting notices & agenda notes...', durationMs: 2200 },
                            { label: 'Reconstructing historical quarterly calendar...', durationMs: 2000 },
                            { label: 'Updating watchlist timeline cache...', durationMs: 1000 }
                          ]}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 2: Watchlist Filter */}
              {watchlists.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Filter by Watchlist
                  </label>
                  <CustomDropdown
                    options={watchlistOptions}
                    value={selectedWatchlistId}
                    onChange={setSelectedWatchlistId}
                    placeholder="All Active Watchlists"
                    prefixIcon={ListFilter}
                    size="sm"
                  />
                </div>
              )}

              {/* Section 3: Sort By */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sort Order
                </label>
                <CustomDropdown
                  options={sortOptions}
                  value={sortBy}
                  onChange={(val) => setSortBy(val as any)}
                  placeholder="Sort By..."
                  prefixIcon={SlidersHorizontal}
                  size="sm"
                />
              </div>

              {/* Section 4: Context Sub-Filters */}
              {statusFilter === 'today' && summaryStats.todayCount > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Today Sub-Filters
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeclarationFilter('all')}
                      className={cn(
                        "min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        declarationFilter === 'all'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      All ({summaryStats.todayCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclarationFilter('declared')}
                      className={cn(
                        "min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        declarationFilter === 'declared'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      Declared ({summaryStats.todayDeclaredCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclarationFilter('pending')}
                      className={cn(
                        "min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        declarationFilter === 'pending'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      Pending ({summaryStats.todayPendingCount})
                    </button>
                  </div>
                </div>
              )}

              {statusFilter === 'upcoming' && summaryStats.upcomingFutureCount > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Upcoming Sub-Filters
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeclarationFilter('all')}
                      className={cn(
                        "min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        declarationFilter === 'all'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      All ({summaryStats.upcomingFutureCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclarationFilter('urgent_3d')}
                      className={cn(
                        "min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        declarationFilter === 'urgent_3d'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      1-3D ({next3dCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclarationFilter('week_7d')}
                      className={cn(
                        "min-h-[44px] px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        declarationFilter === 'week_7d'
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      7D ({next7dCount})
                    </button>
                  </div>
                </div>
              )}

              {/* Section 5: Market Holidays Shortcut */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterSheetOpen(false);
                    setShowMarketHolidaysModal(true);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#201E2E] dark:hover:bg-[#2D283E] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2D283E] transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CalendarRange size={14} className="text-amber-500" />
                    <span>BSE/NSE Market Trading Holidays</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">View Schedule</span>
                </button>
              </div>

              {/* Apply Button */}
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-full min-h-[44px] py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Apply & View Calendar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Option A Collapse Info Helper Banner when Today & Upcoming have 0 meetings */}
      {summaryStats.todayCount === 0 && summaryStats.upcomingFutureCount === 0 && (summaryStats.recentCount > 0 || allDeclaredCount > 0) && (
        <div className="px-3 py-2 bg-slate-50 dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-slate-400 dark:text-slate-400 shrink-0" />
            <span>No board meetings today or upcoming &middot; <strong className="text-slate-900 dark:text-white">{summaryStats.recentCount || allDeclaredCount}</strong> results declared in last 30 days</span>
          </div>
          {statusFilter !== 'declared' && (
            <button
              type="button"
              onClick={() => handleTabChange('declared')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span>View Declared Results</span>
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* Watchlist Sync Notice Banner */}
      <AnimatePresence>
        {watchlistSyncFeedback && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSnappy}
            className="overflow-hidden"
          >
            <div className="p-2.5 bg-slate-100 dark:bg-[#222030] border border-slate-200 dark:border-[#332D46] rounded-xl text-xs text-slate-900 dark:text-slate-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span className="font-semibold">{watchlistSyncFeedback}</span>
              </div>
              <button onClick={() => setWatchlistSyncFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Broadcast Notice Banner */}
      <AnimatePresence>
        {bulkBroadcastMsg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSnappy}
            className="overflow-hidden"
          >
            <div className="p-2.5 bg-slate-100 dark:bg-[#222030] border border-slate-200 dark:border-[#332D46] rounded-xl text-xs text-slate-900 dark:text-slate-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
                <span className="font-semibold">{bulkBroadcastMsg}</span>
              </div>
              <button onClick={() => setBulkBroadcastMsg(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection Toolbar Banner */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={springSnappy}
            className="p-3.5 bg-slate-900 dark:bg-[#252233] border border-slate-700/80 dark:border-[#3E3854] text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckSquare size={16} className="text-slate-300 dark:text-slate-200 shrink-0" />
              <span>{selectedIds.size} Stock(s) Selected</span>
              <span className="text-slate-500 font-normal">|</span>
              <button
                type="button"
                onClick={handleSelectAllUpcoming}
                className="text-slate-300 hover:text-white underline font-semibold cursor-pointer"
              >
                Select All Upcoming ({upcomingItems.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBulkExportIcs}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Download consolidated .ICS calendar file for all selected stocks"
              >
                <CalendarPlus size={13} />
                <span>Add Selected ({selectedIds.size}) to Calendar</span>
              </button>

              <ActionButton
                type="button"
                onClick={handleBulkSendSelectedTelegram}
                isLoading={isBulkBroadcasting}
                loadingText="Broadcasting..."
                variant="secondary"
                size="sm"
                icon={<Send size={13} className="text-sky-400" />}
                className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                title="Broadcast selected board meetings to Telegram channel"
              >
                Broadcast to Telegram ({selectedIds.size})
              </ActionButton>

              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Results Table / List */}
      <div 
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchMove={swipeHandlers.onTouchMove}
        onTouchEnd={swipeHandlers.onTouchEnd}
        className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-[#2D283E]/70"
      >
        {/* Table Control Header Row */}
        {!loading && filteredAndSortedItems.length > 0 && (
          <div className="px-3 py-1.5 bg-slate-50/80 dark:bg-[#15141F] border-b border-slate-100 dark:border-[#2D283E] flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {paginatedItems.every(i => selectedIds.has(i.id)) ? (
                  <CheckSquare size={13} className="text-slate-800 dark:text-slate-200" />
                ) : (
                  <Square size={13} className="text-slate-400" />
                )}
                <span>Select Page ({paginatedItems.length})</span>
              </button>

              <span className="text-slate-300 dark:text-slate-700">|</span>

              <button
                type="button"
                onClick={handleSelectAllUpcoming}
                className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer font-medium"
              >
                Select Upcoming ({upcomingItems.length})
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-400">
              {paginatedItems.length} of {filteredAndSortedItems.length}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-3 sm:p-4 animate-pulse">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono px-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Fetching BSE Result Calendar for your watchlist stocks...</span>
              </span>
              <span className="text-[11px] text-slate-400">Loading schedule...</span>
            </div>
            {[1, 2, 3, 4].map((sk) => (
              <div
                key={`cal-skeleton-${sk}`}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-white dark:bg-[#181624] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-3 w-20 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-24 bg-slate-200/70 dark:bg-slate-800/70 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="my-8 p-6 sm:p-8 max-w-lg mx-auto bg-white dark:bg-[#161422] border border-slate-200/90 dark:border-[#2C2740] rounded-2xl shadow-xs space-y-4 text-left">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#201D30] flex items-center justify-center text-slate-400 border border-slate-200/80 dark:border-[#352F48]">
              <CalendarDays size={20} className="text-slate-400" />
            </div>
            <div className="space-y-1">
              <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {searchQuery.trim()
                  ? `No board meetings matching "${searchQuery.trim()}"`
                  : uniqueWatchlistStocksCount === 0 
                  ? "Your Watchlist is Empty" 
                  : statusFilter === 'today' 
                  ? "No Board Meetings Scheduled for Today" 
                  : "No Matching Results in this View"}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {searchQuery.trim()
                  ? `No board meetings matching "${searchQuery.trim()}". Try a different company name or symbol.`
                  : uniqueWatchlistStocksCount === 0
                  ? "You have removed all stocks from your watchlist. Add companies to your watchlist or restore defaults to track their upcoming and past board meetings and quarterly financial results."
                  : searchQuery 
                  ? `No board meetings matching "${searchQuery}".`
                  : statusFilter === 'today'
                  ? upcomingItems.length > 0
                    ? `No meetings today. The next upcoming result is ${upcomingItems[0]?.companyName} on ${upcomingItems[0]?.meetingDate} (${upcomingItems[0]?.daysLeft} days away).`
                    : "No corporate meetings or financial results scheduled for today."
                  : statusFilter === 'upcoming'
                  ? "No upcoming board meetings scheduled in the immediate pipeline."
                  : "No financial result dates found for the active filter."}
              </p>
            </div>

            {/* Next upcoming highlight card if today is empty */}
            {statusFilter === 'today' && upcomingItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#201D30] border border-slate-200 dark:border-[#352F48] text-left text-xs space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Next Scheduled Board Meeting</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{upcomingItems[0]?.daysLeft}d left</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{upcomingItems[0]?.companyName}</span>
                  <span className="font-mono text-slate-500 text-[11px]">{upcomingItems[0]?.meetingDate}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('upcoming');
                    setDeclarationFilter('all');
                    setSearchQuery('');
                  }}
                  className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer text-center hover:opacity-90 active:scale-95"
                >
                  View All {upcomingItems.length} Upcoming Meetings →
                </button>
              </div>
            )}

            {/* If today has no meetings and no upcoming items, offer clean button to view past declarations */}
            {statusFilter === 'today' && upcomingItems.length === 0 && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('declared');
                    setDeclarationFilter('all');
                    setSearchQuery('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-200 dark:border-[#3E3854]"
                >
                  <span>View Past Declarations</span>
                </button>
              </div>
            )}

            {/* Quick Action Recovery Buttons */}
            {items.length > 0 && statusFilter !== 'today' && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {summaryStats.aiSummaryCount > 0 && declarationFilter !== 'has_ai' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setDeclarationFilter('has_ai');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                  >
                    <Sparkles size={13} className="text-amber-600 dark:text-amber-400" />
                    <span>View {summaryStats.aiSummaryCount} Results with AI Insights</span>
                  </button>
                )}

                {summaryStats.recentCount > 0 && statusFilter !== 'recent' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('recent');
                      setDeclarationFilter('all');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] dark:hover:bg-[#2D2840] border border-slate-200 dark:border-[#3E3854] text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <Clock size={13} />
                    <span>View {summaryStats.recentCount} Recent Declared</span>
                  </button>
                )}

                {statusFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setDeclarationFilter('all');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#2E2942] dark:hover:bg-[#383350] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border border-slate-700/50 dark:border-[#423A5B]"
                  >
                    <span>Show All Records ({items.length})</span>
                  </button>
                )}

                {(searchQuery || declarationFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDeclarationFilter('all');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <motion.div 
            key={`${currentPage}-${statusFilter}-${declarationFilter}-${selectedWatchlistId}-${viewMode}`}
            variants={containerStaggerVariants}
            initial="hidden"
            animate="visible"
            className={cn(
              viewMode === 'grid'
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3 items-start"
                : "divide-y divide-slate-100 dark:divide-[#2D283E]/70"
            )}
          >
            {paginatedItems.map((item, idx) => {
              const isToday = item.status === 'TODAY' || item.daysLeft === 0;
              const isUpcoming = item.daysLeft > 0;
              const isRecent = item.daysLeft < 0;
              const isDeclared = item.isDeclared === true;
              const isFlashing = lightningId === item.id;
              const isSelected = selectedIds.has(item.id);

              return (
                <motion.div
                  id={`calendar-item-${item.id || item.scripCode || idx}`}
                  key={`${item.id || 'cal'}-${idx}`}
                  variants={itemFadeUpVariants}
                  whileHover={{ backgroundColor: viewMode === 'grid' ? undefined : 'rgba(248, 250, 252, 0.6)' }}
                  transition={springSnappy}
                  onClick={() => handleSelectItem(item)}
                  className={cn(
                    viewMode === 'grid'
                      ? "p-3 rounded-xl border border-slate-200/90 dark:border-[#2D283E] shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3 cursor-pointer relative group bg-white dark:bg-[#1A1926]"
                      : "p-2.5 sm:p-3 transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer relative group",
                    activeActionMenuId === item.id ? "z-30" : "z-0",
                    isFlashing && "ring-1 ring-slate-400 dark:ring-[#5C537C] scale-[1.005]",
                    isSelected
                      ? "bg-slate-100/70 dark:bg-[#252233] border-l-4 border-l-slate-900 dark:border-l-slate-300"
                      : isDeclared
                      ? "bg-white dark:bg-[#1A1926] hover:bg-slate-50/80 dark:hover:bg-[#201E2E] border-l-4 border-l-emerald-500 dark:border-l-emerald-400"
                      : isToday && !isDeclared
                      ? "bg-amber-50/20 dark:bg-amber-950/20 hover:bg-amber-50/40 dark:hover:bg-amber-950/30 border-l-4 border-l-amber-500 dark:border-l-amber-400"
                      : isUpcoming
                      ? "bg-white dark:bg-[#1A1926] hover:bg-slate-50/80 dark:hover:bg-[#201E2E] border-l-4 border-l-sky-500/70 dark:border-l-sky-400/70"
                      : "bg-white dark:bg-[#1A1926] hover:bg-slate-50/80 dark:hover:bg-[#201E2E] border-l-4 border-l-slate-300 dark:border-l-slate-700"
                  )}
                >
                {/* Visual zap indicator on click */}
                {isFlashing && (
                  <div className="absolute top-1.5 right-1.5 text-slate-700 dark:text-slate-200 flex items-center gap-1 font-mono text-[9px] font-bold bg-slate-200 dark:bg-[#2D283E] px-1.5 py-0.2 rounded-full border border-slate-300 dark:border-[#3E3854] z-10">
                    <Zap size={10} className="fill-slate-500 animate-pulse" />
                    <span>INSPECTING</span>
                  </div>
                )}

                {/* Left Stock info with Select Checkbox & Calendar Tile */}
                <div className={cn("flex gap-2.5 min-w-0", viewMode === 'grid' ? "flex-col items-stretch" : "items-start flex-1")}>
                  {/* Top row in Grid view OR Header strip in List view */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Select Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(item.id, e)}
                        className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
                        title={isSelected ? "Deselect stock" : "Select stock for calendar/Telegram"}
                      >
                        {isSelected ? (
                          <CheckSquare size={15} className="text-slate-800 dark:text-slate-200" />
                        ) : (
                          <Square size={15} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                        )}
                      </button>

                      {/* Clean Calendar Date Desk-Tile */}
                      {(() => {
                        const tileDate = parseMeetingDateTile(item.meetingDate);
                        return (
                          <div className={cn(
                            "w-8 h-9 rounded-md flex flex-col overflow-hidden shrink-0 border transition-all duration-200 shadow-2xs group-hover:scale-105",
                            isSelected
                              ? "bg-white dark:bg-[#252233] border-slate-400 dark:border-[#4A4364] ring-1 ring-slate-300 dark:ring-[#4A4364]"
                              : isToday
                              ? "bg-white dark:bg-[#201E2E] border-slate-300 dark:border-[#38324E]"
                              : "bg-white dark:bg-[#1E1C2B] border-slate-200 dark:border-[#2D283E]"
                          )}>
                            <div className={cn(
                              "h-3.5 w-full flex items-center justify-center px-0.5 transition-colors font-mono text-[7.5px] font-bold uppercase tracking-wider text-white",
                              isSelected ? "bg-slate-800 dark:bg-[#38324E]" : isToday ? "bg-slate-700 dark:bg-[#342E48]" : "bg-slate-600 dark:bg-[#2D283E]"
                            )}>
                              <span className="truncate">{tileDate.month}</span>
                            </div>
                            <div className={cn(
                              "flex-1 flex items-center justify-center font-bold text-xs leading-none transition-colors",
                              isSelected ? "text-slate-900 dark:text-slate-100" : isToday ? "text-slate-900 dark:text-slate-100" : "text-slate-800 dark:text-slate-200"
                            )}>
                              {tileDate.day}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* Pulsing Live Dot for today's scheduled or active meetings */}
                        {isToday && (
                          <span className="relative flex h-2 w-2 shrink-0" title="Board meeting scheduled today">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                        )}

                        <span 
                          onClick={(e) => handleOpenIntel(item.scripCode, item.symbol, item.companyName, e)}
                          className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors cursor-pointer truncate"
                          title="Open 360° Stock Intelligence"
                        >
                          {item.symbol}
                        </span>

                        {/* 360° Company Intel Icon with informative tooltip */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenIntel(item.scripCode, item.symbol, item.companyName, e)}
                          className="p-1 rounded text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-[#252233] transition-colors cursor-pointer shrink-0"
                          title="360° Company Intelligence: Historical results, financial ratios & peer metrics"
                          aria-label="360° Company Intelligence"
                        >
                          <Building2 size={12} />
                        </button>

                        <span className="text-[9.5px] font-mono px-1.5 py-0.2 bg-slate-100 dark:bg-[#222030] text-slate-600 dark:text-slate-400 rounded border border-slate-200/70 dark:border-[#2D283E]">
                          {item.scripCode}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge in Grid View top corner */}
                    {viewMode === 'grid' && (
                      <div className="shrink-0">
                        {isDeclared && item.resultDeclarationTime ? (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center gap-1">
                            <CheckCircle2 size={9} className="text-emerald-500" />
                            <span>Declared</span>
                          </span>
                        ) : isToday ? (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 flex items-center gap-1">
                            <Clock size={9} className="text-amber-500" />
                            <span>Today</span>
                          </span>
                        ) : isUpcoming ? (
                          <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80">
                            {item.daysLeft === 1 ? 'Tomorrow' : `In ${item.daysLeft}d`}
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-[#201E2E] dark:text-slate-400 border border-slate-200/70 dark:border-[#2D283E]">
                            Past
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {item.companyName}
                    </div>

                    <div className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1 flex-wrap">
                      <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#222030] px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-[#2D283E] line-clamp-1 max-w-[300px]">
                        {item.purpose}
                      </span>
                    </div>

                    {isDeclared && item.aiSummary && (
                      <div className="p-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200/80 dark:border-[#2D283E] rounded text-[11px] text-slate-700 dark:text-slate-300 mt-1 flex items-start gap-1">
                        <Sparkles size={11} className="text-amber-500 shrink-0 mt-0.5" />
                        <span className={cn(viewMode === 'grid' ? "line-clamp-2" : "line-clamp-1")}>{item.aiSummary}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Date & Action Controls */}
                <div className={cn(
                  "flex items-center justify-between gap-1.5 shrink-0 border-t border-slate-100 dark:border-[#2D283E] pt-2",
                  viewMode === 'grid' ? "w-full" : "md:flex-col md:items-end md:justify-center md:border-t-0 md:pt-0"
                )}>
                  <div className={cn("space-y-0.2", viewMode === 'grid' ? "text-left" : "text-left md:text-right")}>
                    <div className={cn("text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1", viewMode !== 'grid' && "md:justify-end")}>
                      <Clock size={11} className="text-slate-400" />
                      <span>{item.meetingDate}</span>
                    </div>
                    
                    {viewMode !== 'grid' && (
                      <>
                        {isDeclared && item.resultDeclarationTime ? (
                          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 md:justify-end">
                            <CheckCircle2 size={10} className="text-emerald-500" />
                            <span>Declared {formatShortDateTime(item.resultDeclarationTime)}</span>
                          </div>
                        ) : isToday ? (
                          <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 md:justify-end">
                            <Clock size={10} className="text-amber-500" />
                            <span>Outcome Pending</span>
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-0.5 md:justify-end">
                            {isUpcoming ? (item.daysLeft === 1 ? 'Tomorrow' : `In ${item.daysLeft}d`) : 'Past'}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {isDeclared ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveActionMenuId(activeActionMenuId === item.id ? null : item.id);
                        }}
                        className="px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[11px] font-semibold border border-emerald-200/80 dark:border-emerald-800/80 transition-all flex items-center gap-1 cursor-pointer shadow-2xs select-none min-h-[36px] active:scale-95"
                        title="Share declared result update"
                      >
                        <Share2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="whitespace-nowrap">Share update</span>
                        <ChevronDown size={10} className={cn("text-emerald-500 transition-transform duration-150", activeActionMenuId === item.id && "rotate-180")} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveActionMenuId(activeActionMenuId === item.id ? null : item.id);
                        }}
                        className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#222030] hover:bg-slate-200 dark:hover:bg-[#2A263D] text-slate-700 dark:text-slate-200 text-[11px] font-semibold border border-slate-200 dark:border-[#2D283E] transition-all flex items-center gap-1 cursor-pointer shadow-2xs select-none min-h-[36px] active:scale-95"
                        title="Set meeting reminder or sync to calendar"
                      >
                        <Bell size={11} className="text-slate-500" />
                        <span className="whitespace-nowrap">Set reminder</span>
                        <ChevronDown size={10} className={cn("text-slate-400 transition-transform duration-150", activeActionMenuId === item.id && "rotate-180")} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectItem(item);
                      }}
                      className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#222030] hover:bg-slate-200 dark:hover:bg-[#2A263D] text-slate-800 dark:text-slate-200 text-[11px] font-semibold border border-slate-200 dark:border-[#2D283E] transition-all flex items-center gap-1 cursor-pointer shadow-2xs select-none min-h-[36px] active:scale-95"
                      title="View full filing details & AI analysis"
                    >
                      <span>Details</span>
                      <ArrowUpRight size={11} className="text-slate-500" />
                    </button>

                    {/* Contextual Action Dropdown Popover */}
                    {activeActionMenuId === item.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionMenuId(null);
                          }}
                        />
                        <div 
                          className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] rounded-xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                        {actionFeedback && (
                          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            <span>{actionFeedback}</span>
                          </div>
                        )}

                        {!isDeclared ? (
                          <>
                            <a
                              href={getCalendarLink(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors"
                              onClick={() => setActiveActionMenuId(null)}
                            >
                              <CalendarPlus size={13} className="text-blue-500" />
                              <span>Google Calendar (1-Click)</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                downloadIcsCalendarFile({
                                  title: `BSE: ${item.symbol} Board Meeting (${item.purpose})`,
                                  description: `Company: ${item.companyName}\nSymbol: ${item.symbol} (BSE: ${item.scripCode})\nAgenda: ${item.purpose}\n\nLive tracking via BSE Nexus.`,
                                  dateStr: item.meetingDate,
                                  filename: `${item.symbol}_BSE_Meeting_${item.meetingDate.replace(/[^a-zA-Z0-9]/g, '_')}.ics`
                                });
                                setActionFeedback('.ICS downloaded');
                                setTimeout(() => { setActionFeedback(null); setActiveActionMenuId(null); }, 1500);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer text-left"
                            >
                              <Download size={13} className="text-amber-500" />
                              <span>Apple / Outlook (.ICS)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleManualSendTelegram(item);
                                setActionFeedback('Sent to Telegram');
                                setTimeout(() => { setActionFeedback(null); setActiveActionMenuId(null); }, 1500);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer text-left"
                            >
                              <Send size={13} className="text-blue-500" />
                              <span>Telegram Alert</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const calUrl = getCalendarLink(item);
                                navigator.clipboard.writeText(calUrl);
                                setActionFeedback('Calendar link copied');
                                setTimeout(() => { setActionFeedback(null); setActiveActionMenuId(null); }, 1500);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer text-left"
                            >
                              <Copy size={13} className="text-slate-400" />
                              <span>Copy Calendar Link</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                handleManualSendTelegram(item);
                                setActionFeedback('Broadcasted to Telegram');
                                setTimeout(() => { setActionFeedback(null); setActiveActionMenuId(null); }, 1500);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer text-left"
                            >
                              <Send size={13} className="text-blue-500" />
                              <span>Broadcast to Telegram</span>
                            </button>

                            {item.declaredDetails?.pdfUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.declaredDetails!.pdfUrl);
                                  setActionFeedback('PDF link copied');
                                  setTimeout(() => { setActionFeedback(null); setActiveActionMenuId(null); }, 1500);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer text-left"
                              >
                                <Copy size={13} className="text-slate-400" />
                                <span>Copy Outcome PDF Link</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const summaryText = `BSE Nexus Update: ${item.companyName} (${item.symbol}) declared ${item.purpose}.\nDate: ${item.meetingDate}\nLive tracking on BSE Nexus.`;
                                navigator.clipboard.writeText(summaryText);
                                setActionFeedback('Update text copied');
                                setTimeout(() => { setActionFeedback(null); setActiveActionMenuId(null); }, 1500);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer text-left"
                            >
                              <FileText size={13} className="text-emerald-500" />
                              <span>Copy Result Update</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

        {/* Results Calendar Pagination Controls */}
        {!loading && filteredAndSortedItems.length > 0 && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] shrink-0">
            <div className="flex items-center gap-1.5 text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Per page:</span>
              <div className="inline-flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded p-0.5 shadow-2xs">
                {[25, 50, 100].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setItemsPerPage(size);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer text-center",
                      itemsPerPage === size
                        ? "bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <span className="text-slate-400 hidden sm:inline font-mono text-[10px]">
                ({filteredAndSortedItems.length} total)
              </span>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs"
              >
                Prev
              </button>
              
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-1">
                Page {currentPage} of {totalPages}
              </span>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Common questions FAQ Section */}
      <div className="pt-4 pb-4">
        <CommonQuestionsFAQ id="results-calendar-faq" compact />
      </div>

      {/* DETAIL MODAL FOR CALENDAR & EARNINGS ITEM */}
      <AnimatePresence>
        {selectedModalItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overscroll-contain"
            onClick={() => setSelectedModalItem(null)}
          >
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={springMorph}
              className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-4xl w-full max-h-[88vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Native Mobile Drag Handle Bar */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 mb-0 shrink-0 sm:hidden" />

              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                      {selectedModalItem.companyName} ({selectedModalItem.symbol})
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-bold shrink-0">
                      BSE: {selectedModalItem.scripCode}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleOpenIntel(selectedModalItem.scripCode, selectedModalItem.symbol, selectedModalItem.companyName, e)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-2xs"
                      title="Open Full 360° Stock Overview, Financials & Timeline"
                    >
                      <Building2 size={13} />
                      <span>Stock 360°</span>
                    </button>
                    <ShareActionMenu
                      title={`${selectedModalItem.companyName} (${selectedModalItem.symbol || selectedModalItem.scripCode || 'BSE'})`}
                      headline={`Board Meeting scheduled on ${selectedModalItem.meetingDate}. Purpose: ${selectedModalItem.purpose || 'Financial Results'}`}
                      companyName={selectedModalItem.companyName}
                      scripCode={selectedModalItem.scripCode}
                      symbol={selectedModalItem.symbol}
                      pdfUrl={selectedModalItem.declarationPdfLink}
                      url={`https://bsenexus.in/results-calendar?scrip=${selectedModalItem.scripCode || ''}`}
                      size="xs"
                    />
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    Scheduled Board Meeting: <strong className="text-slate-800 dark:text-slate-200">{selectedModalItem.meetingDate}</strong>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Segmented Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setModalTab('results')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                    modalTab === 'results'
                      ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <BarChart2 size={15} />
                  <span>Financial Results</span>
                  {selectedModalItem.isDeclared && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('meetings')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                    modalTab === 'meetings'
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <CalendarDays size={15} />
                  <span>Upcoming Board Meetings</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full">
                    {boardMeetingsHistory.length || 1}
                  </span>
                </button>
              </div>

              {/* Modal Tab Content */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 overscroll-contain">
              {/* TAB 1: FINANCIAL RESULTS & OUTCOMES */}
              {modalTab === 'results' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Results Status Banner */}
                  <div className={cn(
                    "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                    selectedModalItem.isDeclared
                      ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full mt-1 shrink-0",
                        selectedModalItem.isDeclared ? "bg-emerald-500" : "bg-amber-500 animate-ping"
                      )} />
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          {selectedModalItem.isDeclared
                            ? "Financial Result Declared & Verified on BSE"
                            : "Result Declaration Awaiting Submission"}
                        </div>
                        {selectedModalItem.isDeclared && selectedModalItem.resultDeclarationTime ? (
                          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-mono font-bold flex items-center gap-1">
                            <Clock size={13} className="text-emerald-600" />
                            <span>Submitted to BSE on: {formatFullDateTime(selectedModalItem.resultDeclarationTime)}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">
                            Board meeting scheduled on {selectedModalItem.meetingDate}. Company filing will appear live here as soon as published on BSE.
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedModalItem.declarationPdfLink && (
                      <a
                        href={getSafePdfUrl(selectedModalItem.declarationPdfLink, undefined, selectedModalItem.declarationAnnouncementId, selectedModalItem.scripCode)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>View BSE Outcome PDF</span>
                      </a>
                    )}
                  </div>

                  {/* Pre-Result Window Priority Booster Card (10 or 20 Days Horizon) */}
                  <div className="p-4 bg-linear-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-300/60 dark:border-amber-700/60 rounded-xl space-y-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500 text-white shadow-2xs shrink-0 mt-0.5">
                          <Flame size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span>Pre-Result Window Priority &amp; Run-Up Disclosures</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              Priority Window
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            Filter and prioritize precursor announcements (board meeting intimation, window closure) in the <strong>{runupWindowDays} days prior</strong> to result date ({selectedModalItem.meetingDate}).
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* 10 vs 20 Days Horizon Toggle */}
                        <div className="inline-flex rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              setRunupWindowDays(10);
                              if (expandedRunupDate) {
                                toggleRunupAnnouncements(selectedModalItem.scripCode, selectedModalItem.symbol, selectedModalItem.meetingDate, 10);
                              }
                            }}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                              runupWindowDays === 10
                                ? "bg-amber-500 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                            )}
                          >
                            10 Days Prior
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRunupWindowDays(20);
                              if (expandedRunupDate) {
                                toggleRunupAnnouncements(selectedModalItem.scripCode, selectedModalItem.symbol, selectedModalItem.meetingDate, 20);
                              }
                            }}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                              runupWindowDays === 20
                                ? "bg-amber-500 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                            )}
                          >
                            20 Days Prior
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleRunupAnnouncements(selectedModalItem.scripCode, selectedModalItem.symbol, selectedModalItem.meetingDate, runupWindowDays)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                        >
                          <Search size={13} className="text-amber-500" />
                          <span>{expandedRunupDate === selectedModalItem.meetingDate ? `Hide ${runupWindowDays}D Filings` : `View ${runupWindowDays}D Filings`}</span>
                        </button>

                        <ActionButton
                          onClick={() => handleBoostRunupPriority(selectedModalItem.scripCode, selectedModalItem.symbol, selectedModalItem.meetingDate, runupWindowDays)}
                          isLoading={isBoostingRunup}
                          loadingText="Boosting..."
                          variant="primary"
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          icon={<Zap size={13} />}
                        >
                          Set {runupWindowDays}D to HIGH
                        </ActionButton>
                      </div>
                    </div>

                    {/* Pre-Result Boost Alert Notice */}
                    {boostRunupMsg && (
                      <div className="p-2.5 bg-amber-100/90 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
                        <span className="font-bold">{boostRunupMsg}</span>
                      </div>
                    )}

                    {/* Expanded Run-up Filings Drawer */}
                    {expandedRunupDate === selectedModalItem.meetingDate && (
                      <div className="p-3 bg-white/90 dark:bg-slate-900/90 border border-amber-200/80 dark:border-amber-800/80 rounded-xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="flex items-center gap-1.5">
                            <Clock3 size={13} className="text-amber-500" />
                            <span>Pre-Result Filings ({runupWindowDays} Days before {selectedModalItem.meetingDate})</span>
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-full font-bold">
                            {runupAnnouncements.length} Disclosures Found
                          </span>
                        </div>

                        {loadingRunupAnnouncements ? (
                          <div className="space-y-2 py-1 animate-pulse">
                            {[1, 2].map((sk) => (
                              <div key={sk} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-1.5">
                                <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                                <div className="h-2.5 w-1/3 bg-slate-200/70 dark:bg-slate-700/70 rounded" />
                              </div>
                            ))}
                          </div>
                        ) : runupAnnouncements.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {runupAnnouncements.map((ann: any, aIdx: number) => (
                              <div key={aIdx} className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                                    {ann.subject || ann.NEWSSUB || ann.details || 'Corporate Disclosure'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                                    <span>📅 {ann.date || ann.NEWS_DT}</span>
                                    <span>⏰ {ann.time || formatTimeOnly(ann.NEWS_DT)} IST</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded">
                                      {ann.priority || 'HIGH'}
                                    </span>
                                  </div>
                                </div>
                                {ann.pdfLink && (
                                  <a
                                    href={getSafePdfUrl(ann.pdfLink, ann.attachmentName || ann.ATTACHMENTNAME, ann.id, selectedModalItem.scripCode)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded shrink-0 flex items-center gap-1 cursor-pointer"
                                  >
                                    <ExternalLink size={10} />
                                    <span>PDF</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-2 text-center text-xs text-slate-400">
                            No separate corporate filings recorded in this {runupWindowDays}-day pre-result window yet. Use <strong>Fetch 1-5 Yr History</strong> below to pull past filings directly from BSE.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 1-5 Years Historical BSE Filings Fetcher Card */}
                  <div className="p-4 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-2xs shrink-0 mt-0.5">
                          <History size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>BSE 1–5 Year Historical Results & Filings Sync</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              Deep History
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Fetch 1 to 5 years of historical quarterly financial results, board meetings & time-stamped outcomes for <strong>{selectedModalItem.symbol}</strong>.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <CustomDropdown
                          options={[
                            { value: 1, label: '1 Year (1 yr)' },
                            { value: 2, label: '2 Years (2 yrs)' },
                            { value: 3, label: '3 Years (3 yrs)' },
                            { value: 5, label: '5 Years (5 yrs)' }
                          ]}
                          value={selectedYears}
                          onChange={(val) => setSelectedYears(Number(val))}
                          size="sm"
                          menuWidth="w-36"
                          align="right"
                        />

                        <button
                          type="button"
                          onClick={() => handleFetchDeepHistory(selectedModalItem.scripCode, selectedModalItem.symbol, selectedYears)}
                          disabled={isFetchingDeepHistory}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                        >
                          <Download size={13} className={cn(isFetchingDeepHistory && "animate-bounce")} />
                          <span>{isFetchingDeepHistory ? "Fetching History..." : `Fetch ${selectedYears} Yr History`}</span>
                        </button>
                      </div>
                    </div>

                    {/* Deep History Feedback Message */}
                    {deepHistoryMsg && (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span className="font-semibold">{deepHistoryMsg}</span>
                      </div>
                    )}
                  </div>

                  {/* Gemini AI Financial Metrics Breakdown */}
                  <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800 dark:text-emerald-300">
                          <Sparkles size={15} className="text-emerald-500" />
                          <span>Gemini AI YoY Financial Extraction</span>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold",
                          isProOrAdmin
                            ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80"
                            : aiQuota.remaining > 0
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                        )}>
                          {isProOrAdmin 
                            ? "Pro Unlimited" 
                            : `${aiQuota.remaining}/${aiQuota.dailyLimit} free today`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedModalItem.aiSummary && (
                          <button
                            onClick={() => handleCopySummary(selectedModalItem.aiSummary!)}
                            className="px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/50 hover:bg-emerald-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copy Summary"
                          >
                            {copiedSummary ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            <span>{copiedSummary ? "Copied!" : "Copy"}</span>
                          </button>
                        )}

                        {selectedModalItem.declarationAnnouncementId && !selectedModalItem.aiSummary && (
                          <ActionButton
                            onClick={() => handleGenerateSummary(selectedModalItem.declarationAnnouncementId)}
                            isLoading={isGeneratingAi}
                            loadingText="Extracting..."
                            variant="primary"
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            icon={<Sparkles size={12} />}
                          >
                            Generate AI Summary
                          </ActionButton>
                        )}
                      </div>
                    </div>

                    {isGeneratingAi ? (
                      <div className="py-2 min-h-[140px] space-y-3">
                        <HonestProgressBar
                          color="emerald"
                          isRunning={true}
                          simulatedSteps={[
                            { label: 'Connecting to BSE corporate filing PDF...', durationMs: 1400 },
                            { label: 'Extracting Revenue, EBITDA & Net Profit...', durationMs: 2200 },
                            { label: 'Calculating YoY & QoQ variance...', durationMs: 1800 },
                            { label: 'Formulating executive analysis takeaway...', durationMs: 1200 }
                          ]}
                        />
                        <div className="space-y-2 pt-2 animate-pulse">
                          <div className="h-3 w-3/4 bg-emerald-100 dark:bg-emerald-950/40 rounded" />
                          <div className="h-3 w-5/6 bg-emerald-100 dark:bg-emerald-950/40 rounded" />
                          <div className="h-3 w-2/3 bg-emerald-100 dark:bg-emerald-950/40 rounded" />
                        </div>
                      </div>
                    ) : selectedModalItem.aiSummary ? (
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                        {selectedModalItem.aiSummary}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        {selectedModalItem.isDeclared
                          ? "Result has been declared on BSE. Click 'Generate AI Summary' to parse YoY/QoQ metrics."
                          : "Awaiting BSE board meeting outcome filing before AI metrics extraction."}
                      </p>
                    )}
                  </div>

                  {/* Quarterly Financial Results (Quarterly Results Ledger) */}
                  <div className="space-y-3">
                    <QuarterlyResultsLedger
                      results={financialResultsHistory}
                      symbol={selectedModalItem.symbol}
                      scripCode={selectedModalItem.scripCode}
                      companyName={selectedModalItem.companyName}
                      isLoading={loadingHistory}
                      onFetchDeepHistory={(years) => handleFetchDeepHistory(selectedModalItem.scripCode, selectedModalItem.symbol, years)}
                      isFetchingDeep={isFetchingDeepHistory}
                      deepHistoryMsg={deepHistoryMsg}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: BOARD MEETINGS & AGENDA */}
              {modalTab === 'meetings' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Meeting Scheduled Card */}
                  {(() => {
                    const holidayCheck = checkIfDateIsTradingHoliday(selectedModalItem.meetingDate);
                    const isPast = !selectedModalItem.isDeclared && selectedModalItem.daysLeft < 0;
                    const isToday = selectedModalItem.status === 'TODAY' || selectedModalItem.daysLeft === 0;

                    return (
                      <div className="space-y-3">
                        <div className={cn(
                          "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                          isToday
                            ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                            : isPast
                            ? "bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                            : "bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-3 h-3 rounded-full",
                              isToday ? "bg-amber-500 animate-ping" : isPast ? "bg-slate-400" : "bg-blue-500"
                            )} />
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                {isToday
                                  ? "Board Meeting Scheduled Today"
                                  : isPast
                                  ? "Past Board Meeting (Archived)"
                                  : "Scheduled Upcoming Board Meeting"}
                              </div>
                              <div className="text-xs text-slate-500">
                                Meeting Date: <strong className="text-slate-800 dark:text-slate-200">{selectedModalItem.meetingDate}</strong>
                              </div>
                            </div>
                          </div>

                          {/* Quick Calendar & Reminder Link */}
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <a
                              href={generateGoogleCalendarUrl({
                                title: `BSE: ${selectedModalItem.symbol} Board Meeting (${selectedModalItem.purpose})`,
                                description: `Company: ${selectedModalItem.companyName}\nSymbol: ${selectedModalItem.symbol} (BSE: ${selectedModalItem.scripCode})\nMeeting Purpose: ${selectedModalItem.purpose}\nScheduled Date: ${selectedModalItem.meetingDate}\n\nTrack real-time outcomes on BSE Nexus.`,
                                dateStr: selectedModalItem.meetingDate
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs transition-all"
                              title="Add reminder to Google Calendar (Opens on Android/Windows/iOS)"
                            >
                              <CalendarPlus size={14} />
                              <span>Google Calendar</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => downloadIcsCalendarFile({
                                title: `BSE: ${selectedModalItem.symbol} Board Meeting (${selectedModalItem.purpose})`,
                                description: `Company: ${selectedModalItem.companyName}\nSymbol: ${selectedModalItem.symbol} (BSE: ${selectedModalItem.scripCode})\nAgenda: ${selectedModalItem.purpose}\n\nLive tracking via BSE Nexus.`,
                                dateStr: selectedModalItem.meetingDate,
                                filename: `${selectedModalItem.symbol}_BSE_Meeting_${selectedModalItem.meetingDate.replace(/[^a-zA-Z0-9]/g, '_')}.ics`
                              })}
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                              title="Download .ICS Calendar File (Imports natively to Apple Calendar on iPhone/Mac and Outlook on Windows)"
                            >
                              <Download size={14} />
                              <span>.ICS (Apple / Outlook)</span>
                            </button>
                          </div>
                        </div>

                        {/* Calendar Device Tip */}
                        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                          <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Device Compatibility: </span>
                            <span>
                              <strong>Google Calendar link</strong> opens directly on all devices (Android, Windows, iOS). 
                              <strong> .ICS file</strong> automatically imports the reminder into <strong>Apple Calendar on iPhone/Mac</strong> and <strong>Outlook on Windows</strong>.
                            </span>
                          </div>
                        </div>

                        {/* Market Holiday / Weekend Warning Banner */}
                        {holidayCheck.isClosed && (
                          <div className="p-3 bg-amber-500/10 border border-amber-400/40 dark:border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Market Holiday / Weekend Notice: </span>
                              <span>
                                {selectedModalItem.meetingDate} falls on <strong>{holidayCheck.holidayName || holidayCheck.weekendName}</strong>. 
                                Regular exchange trading session is closed, but board meetings and company filings can still occur.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Purpose / Agenda */}
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Agenda / Meeting Purpose</div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      {selectedModalItem.purpose}
                    </div>
                  </div>

                  {/* Board Meetings History Timeline */}
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                        <CalendarDays size={15} className="text-blue-500" />
                        <span>Board Meetings &amp; Intimations History</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {boardMeetingsHistory.length} Meetings
                      </span>
                    </div>

                    {loadingHistory ? (
                      <div className="space-y-2 py-1 animate-pulse">
                        {[1, 2].map((sk) => (
                          <div key={sk} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-1.5 border border-slate-100 dark:border-slate-800">
                            <div className="h-3.5 w-3/5 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-2.5 w-1/4 bg-slate-200/70 dark:bg-slate-700/70 rounded" />
                          </div>
                        ))}
                      </div>
                    ) : boardMeetingsHistory.length > 0 ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {boardMeetingsHistory.map((hist, idx) => (
                          <div 
                            key={idx}
                            className="p-2.5 bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {hist.details || hist.periodOrMeeting}
                                </span>
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                  {hist.status}
                                </span>
                              </div>
                              
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 flex-wrap">
                                <span>🗓️ Meeting Date: <strong className="text-slate-700 dark:text-slate-300">{hist.meetingDate || hist.declarationDate}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={generateGoogleCalendarUrl({
                                  title: `BSE: ${selectedModalItem.symbol} Board Meeting (${hist.details || hist.periodOrMeeting})`,
                                  description: `Company: ${selectedModalItem.companyName}\nSymbol: ${selectedModalItem.symbol} (BSE: ${selectedModalItem.scripCode})\nAgenda: ${hist.details || hist.periodOrMeeting}\n\nLive tracking via BSE Nexus.`,
                                  dateStr: hist.meetingDate || hist.declarationDate || selectedModalItem.meetingDate
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-md transition-colors flex items-center gap-1"
                                title="Add to Google Calendar"
                              >
                                <CalendarPlus size={11} />
                                <span>Add Cal</span>
                              </a>

                              {hist.pdfLink && (
                                <a
                                  href={getSafePdfUrl(hist.pdfLink, hist.attachmentName, hist.announcementId, selectedModalItem.scripCode)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <ExternalLink size={11} />
                                  <span>PDF</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-500 bg-white/60 dark:bg-slate-800/40 rounded-lg space-y-1">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">No previous meeting intimation notices indexed.</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          💡 All historical quarterly declarations and outcome PDFs are organized in the <strong>Financial Results</strong> tab.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Telegram Notice */}
              {telegramStatus && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                  <CheckCircle2 size={15} className="text-blue-500 shrink-0" />
                  <span className="font-semibold">{telegramStatus}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3 flex-wrap">
              {selectedModalItem.declarationPdfLink ? (
                <a
                  href={selectedModalItem.declarationPdfLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>Download BSE PDF</span>
                </a>
              ) : <div />}

              <div className="flex flex-wrap items-center gap-2">
                {/* 1-Tap Share Menu */}
                <ShareActionMenu
                  title={`${selectedModalItem.companyName} (${selectedModalItem.symbol || selectedModalItem.scripCode || 'BSE'})`}
                  headline={`Board Meeting date: ${selectedModalItem.meetingDate}. Purpose: ${selectedModalItem.purpose || 'Financial Results'}`}
                  companyName={selectedModalItem.companyName}
                  scripCode={selectedModalItem.scripCode}
                  symbol={selectedModalItem.symbol}
                  pdfUrl={selectedModalItem.declarationPdfLink}
                  url={`https://bsenexus.in/results-calendar?scrip=${selectedModalItem.scripCode || ''}`}
                  size="sm"
                />

                {/* 1-Click Share via Email (Mailto) */}
                <motion.button
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => handleShareEmail(selectedModalItem)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer touch-manipulation min-h-[38px]"
                  title="Send 1-Click Calendar Invite via Email"
                >
                  <Mail size={14} className="text-amber-500" />
                  <span>Share via Email</span>
                </motion.button>

                {/* Copy 1-Click Calendar URL */}
                <motion.button
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => handleCopyCalendarLink(selectedModalItem)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer touch-manipulation min-h-[38px]"
                  title="Copy direct Google Calendar add link"
                >
                  {copiedCalendarId === selectedModalItem.id ? (
                    <>
                      <Check size={14} className="text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Calendar Link</span>
                    </>
                  )}
                </motion.button>

                {/* Dispatch to Telegram with Calendar Link */}
                <ActionButton
                  type="button"
                  onClick={() => handleManualSendTelegram(selectedModalItem)}
                  isLoading={isSendingTelegram}
                  loadingText="Broadcasting..."
                  variant="primary"
                  size="sm"
                  icon={
                    <span className={cn("flex items-center transition-transform", isPlaneFlying && "animate-plane-fly")}>
                      <Send size={14} className="text-white" />
                    </span>
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  title="Broadcast to Telegram with 1-Click Calendar Link"
                >
                  Dispatch to Telegram
                </ActionButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Market Holidays Schedule Modal */}
      <MarketHolidaysModal
        isOpen={showMarketHolidaysModal}
        onClose={() => setShowMarketHolidaysModal(false)}
      />
    </div>
  );
}
