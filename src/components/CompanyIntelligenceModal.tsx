import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Building2, TrendingUp, TrendingDown, Calendar, Sparkles, 
  ExternalLink, Clock, Shield, BarChart3, FileText, Download, 
  RefreshCw, CheckCircle2, ChevronRight, Copy, Check, Filter, 
  Flame, Award, Layers, Bot, AlertTriangle, ArrowUpRight,
  Coins, Gift, Briefcase, Zap, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { springSnappy, springBouncy, springSmoothPill, buttonTap, itemFadeUpVariants } from '../utils/motionTokens';
import { ShareActionMenu } from './ui/motion/ShareActionMenu';
import { RollingNumber } from './ui/motion/RollingNumber';
import { customFetch } from '../api';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { formatFullDateTime, formatShortDateTime, formatTimeOnly, formatDateOnly } from '../utils/timeFormat';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';
import { useAiQuota, syncQuotaFromResponse } from '../utils/aiQuota';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ComponentSkeleton } from './ui/ComponentSkeleton';
import { CompanyHubSkeleton } from './ui/DesignedSkeletons';
import { HonestProgressBar } from './ui/HonestProgressBar';
import { TimeoutRetryState } from './ui/TimeoutRetryState';
import { ActionButton } from './ui/ActionButton';

import { QuarterlyResultsLedger } from './QuarterlyResultsLedger';
import { AiSummaryViewer } from './AiSummaryViewer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CompanyIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  scripCode?: string;
  symbol?: string;
  companyName?: string;
}

export function CompanyIntelligenceModal({
  isOpen,
  onClose,
  scripCode = '',
  symbol = '',
  companyName = ''
}: CompanyIntelligenceModalProps) {
  const { user, profile, isAdmin, isPro, adminUnlocked, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const [activeTab, setActiveTab] = useState<'hub' | 'timeline' | 'results' | 'filings' | 'research'>('hub');
  const [timelineFilter, setTimelineFilter] = useState<string>('ALL');
  const [intelData, setIntelData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiOverview, setAiOverview] = useState<string>('');
  const [copiedAi, setCopiedAi] = useState<boolean>(false);
  const [selectedYears, setSelectedYears] = useState<number>(3);
  const [isFetchingHistory, setIsFetchingHistory] = useState<boolean>(false);
  const [historySuccessMsg, setHistorySuccessMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Non-intrusive Toast Notifications
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const isProOrAdmin = Boolean(isAdmin || (isPro && !user?.isAnonymous) || profile?.tier === 'admin');
  const aiQuota = useAiQuota(user, profile, isPro, isAdmin);

  // Lock body scroll when 360 intelligence modal is open
  useBodyScrollLock(isOpen);

  const effectiveSymbol = symbol || intelData?.symbol || '';
  const effectiveScrip = scripCode || intelData?.scripCode || '';
  const effectiveName = companyName || intelData?.companyName || effectiveSymbol || 'Company Intelligence';

  useEffect(() => {
    if (!isOpen || (!scripCode && !symbol)) return;
    loadIntelligence();
  }, [isOpen, scripCode, symbol]);

  const loadIntelligence = async () => {
    setLoading(true);
    setLoadError(null);
    setHistorySuccessMsg(null);

    // Signal 06: Fail out loud - give every load a deadline (12s timeout)
    const timeoutId = setTimeout(() => {
      setLoadError("We couldn't reach the BSE data feed within 12 seconds. Your session is safe.");
      setLoading(false);
    }, 12000);

    try {
      const identifier = effectiveScrip || effectiveSymbol;
      const res = await customFetch(`/api/company-intel/${identifier}?scripCode=${effectiveScrip}&symbol=${effectiveSymbol}`);
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setIntelData(data);
        if (data.aiSnapshot) {
          setAiOverview(data.aiSnapshot);
        }
      } else {
        setLoadError(`BSE service returned status ${res.status}. Please try again.`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Failed to load company intelligence", err);
      setLoadError("Connection error: Unable to load company intelligence from server.");
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleGenerateAiOverview = async () => {
    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      showToast('🔒 Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro AI analysis!', 'info');
      return;
    }

    if (!isProOrAdmin) {
      setIsProModalOpen(true);
      showToast('🔒 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) for unlimited Gemini AI 360° Analysis!', 'info');
      return;
    }

    if (!aiQuota.canGenerate) {
      showToast('🔒 Daily Pro AI limit reached (100 analyses/day). Resets at 00:00 IST.', 'info');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const identifier = effectiveScrip || effectiveSymbol;
      const res = await customFetch(`/api/company-intel/${identifier}/ai-overview?scripCode=${effectiveScrip}&symbol=${effectiveSymbol}`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        showToast(data?.error || '🔒 Google Sign-In Required: Sign in to enjoy 1 week of Free Pro AI features.', 'info');
        return;
      }

      if (res.status === 403 || data?.proRequired) {
        setIsProModalOpen(true);
        showToast(data?.error || '🔒 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) to continue using Gemini AI.', 'info');
        return;
      }

      if (res.status === 429) {
        syncQuotaFromResponse(data || { remainingQuota: 0 });
        const errMsg = data?.error || 'Daily AI summary quota reached.';
        if (!user && !profile) {
          setIsAuthModalOpen(true);
        } else {
          setIsProModalOpen(true);
        }
        showToast(`🔒 ${errMsg}`, 'error');
        return;
      }

      if (res.ok && data?.aiOverview) {
        syncQuotaFromResponse(data);
        showToast('✨ Gemini 360° corporate synthesis ready!', 'success');
        setAiOverview(data.aiOverview);
      } else {
        const errMsg = data?.error || 'Failed to generate AI overview';
        showToast(`⚠️ AI Overview Alert: ${errMsg}`, 'error');
      }
    } catch (err: any) {
      console.error("Failed to generate AI overview", err);
      showToast(`⚠️ AI processing error: ${err?.message || 'Connection error'}`, 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleFetchDeepHistory = async () => {
    if (!effectiveScrip && !effectiveSymbol) return;
    setIsFetchingHistory(true);
    setHistorySuccessMsg(null);
    try {
      const res = await customFetch(`/api/stocks/${effectiveScrip || effectiveSymbol}/fetch-deep-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: effectiveSymbol, years: selectedYears })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHistorySuccessMsg(`✅ Synced ${data.totalHistoryCount || data.newlySaved} historical BSE filings across ${selectedYears} years!`);
        showToast(`✅ Synced ${data.totalHistoryCount || data.newlySaved} historical filings!`, 'success');
        await loadIntelligence();
      } else {
        showToast(data.error || 'Failed to fetch historical filings', 'error');
      }
    } catch (e: any) {
      showToast('Error fetching history: ' + e.message, 'error');
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleCopyAi = () => {
    if (!aiOverview) return;
    navigator.clipboard.writeText(aiOverview);
    setCopiedAi(true);
    setTimeout(() => setCopiedAi(false), 2000);
  };

  if (!isOpen) return null;

  const quote = intelData?.quote;
  const price = quote?.price;
  const change = quote?.change || 0;
  const changePct = quote?.changePercent || 0;
  const isPositive = change >= 0;

  const low52 = quote?.fiftyTwoWeekLow;
  const high52 = quote?.fiftyTwoWeekHigh;
  let range52Pct = 50;
  if (low52 && high52 && high52 > low52 && price) {
    range52Pct = Math.min(100, Math.max(0, ((price - low52) / (high52 - low52)) * 100));
  }

  const timelineEvents = intelData?.materialTimeline || [];
  const filteredTimeline = timelineEvents.filter((ev: any) => {
    if (timelineFilter === 'ALL') return true;
    if (timelineFilter === 'DIVIDEND') return ev.eventType === 'DIVIDEND' || ev.eventType === 'BONUS' || ev.eventType === 'SPLIT' || ev.eventType === 'BUYBACK';
    if (timelineFilter === 'RESULTS') return ev.eventType === 'FINANCIAL_RESULT' || ev.eventType === 'BOARD_MEETING';
    if (timelineFilter === 'ORDER_WIN') return ev.eventType === 'ORDER_WIN';
    if (timelineFilter === 'GOVERNANCE') return ev.eventType === 'GOVERNANCE' || ev.eventType === 'FUND_RAISE';
    return true;
  });

  const quarterlyResults = intelData?.quarterlyResults || [];
  const upcoming = intelData?.upcomingEvent;
  const recentFilings = intelData?.recentFilings || [];
  const latestFiling = recentFilings[0] || (timelineEvents[0] ? {
    subject: timelineEvents[0].title,
    headline: timelineEvents[0].description,
    bseTime: timelineEvents[0].dateStr || timelineEvents[0].timestamp,
    pdfLink: timelineEvents[0].pdfLink,
    id: timelineEvents[0].id
  } : null);

  const hasAnyHistory = quarterlyResults.length > 0 || timelineEvents.length > 0 || recentFilings.length > 0;

  // Filing Facts — bite-sized, data-derived stats from official BSE filings only.
  // Every fact is computed from the company's loaded data; nothing is hardcoded.
  const filingFacts = useMemo(() => {
    const facts: { value: string; label: string; icon: any }[] = [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // 1. Filing pace — only when the loaded 25 filings fully cover the last 30 days,
    //    so the count is never an undercount from the per-stock cap.
    const oldestLoaded = recentFilings.length ? (recentFilings[recentFilings.length - 1]?.timestamp || 0) : 0;
    const fullCoverage = recentFilings.length < 25 || oldestLoaded <= thirtyDaysAgo;
    const paceCount = recentFilings.filter((f: any) => (f.timestamp || 0) >= thirtyDaysAgo).length;
    if (fullCoverage && paceCount > 0) {
      facts.push({ value: String(paceCount), label: 'filings in the last 30 days', icon: FileText });
    }

    // 2. Most frequent disclosure type (full timeline history, not capped).
    const typeLabels: Record<string, string> = {
      DIVIDEND: 'Dividends', BONUS: 'Bonuses', SPLIT: 'Stock splits', BUYBACK: 'Buybacks',
      ORDER_WIN: 'Order wins', FINANCIAL_RESULT: 'Result filings', BOARD_MEETING: 'Board meetings',
      GOVERNANCE: 'Governance updates', FUND_RAISE: 'Fund raises', GENERAL: 'Disclosures'
    };
    const typeCounts: Record<string, number> = {};
    timelineEvents.forEach((ev: any) => { if (ev.eventType) typeCounts[ev.eventType] = (typeCounts[ev.eventType] || 0) + 1; });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (topType && topType[1] >= 2) {
      facts.push({ value: typeLabels[topType[0]] || topType[0], label: `most frequent disclosure · ${topType[1]} tracked`, icon: Layers });
    }

    // 3. Shareholder rewards (dividends, bonuses, splits, buybacks).
    const rewards = timelineEvents.filter((ev: any) => ['DIVIDEND', 'BONUS', 'SPLIT', 'BUYBACK'].includes(ev.eventType)).length;
    if (rewards > 0) {
      facts.push({ value: String(rewards), label: 'dividends, bonuses & buybacks tracked', icon: Coins });
    }

    // 4. High-impact disclosures.
    const highImpact = timelineEvents.filter((ev: any) => ev.isHighImpact).length;
    if (highImpact > 0) {
      facts.push({ value: String(highImpact), label: 'high-impact disclosures', icon: Zap });
    }

    // 5. Results history depth.
    if (quarterlyResults.length >= 2) {
      facts.push({ value: String(quarterlyResults.length), label: 'quarters of results history', icon: BarChart3 });
    }

    return facts.slice(0, 5);
  }, [recentFilings, timelineEvents, quarterlyResults]);

  // Disclosure Trend — 12-week filing activity chart (reel-style "all time high"
  // concept, built from the company's official BSE filings — nothing external).
  const activityTrend = useMemo(() => {
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const buckets: number[] = new Array(12).fill(0);
    let inWindow = 0;
    recentFilings.forEach((f: any) => {
      const ts = f.timestamp || 0;
      if (!ts) return;
      const age = now - ts;
      if (age < 0 || age >= 12 * WEEK) return;
      const idx = 11 - Math.floor(age / WEEK);
      buckets[idx] += 1;
      inWindow += 1;
    });
    if (inWindow < 2) return null;
    const max = Math.max(...buckets);
    const latest = buckets[11];
    let callout: string | null = null;
    if (latest > 0 && latest > Math.max(...buckets.slice(0, 11))) {
      callout = 'Filing activity hit a 12-week high';
    } else if (buckets.slice(8).every(b => b === 0)) {
      callout = 'Quietest spell in 12 weeks';
    }
    return { buckets, max, callout };
  }, [recentFilings]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="company-intel-title"
    >
      <div 
        className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] max-h-[850px] min-h-[420px] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header - Fixed Top (shrink-0) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80 shrink-0 flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs shrink-0">
                <Building2 size={16} />
              </span>
              <h2 id="company-intel-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate flex-1 font-display" title={effectiveName}>
                {effectiveName}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {effectiveSymbol && (
                <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {effectiveSymbol}
                </span>
              )}
              {effectiveScrip && (
                <span className="font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  BSE: {effectiveScrip}
                </span>
              )}
              {price !== undefined && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="font-bold text-slate-900 dark:text-white inline-flex items-center">
                    <RollingNumber value={price.toFixed(2)} prefix="₹" />
                  </span>
                  <span className={cn(
                    "flex items-center gap-0.5 font-bold px-1.5 py-0.2 rounded text-[11px]",
                    isPositive ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60" : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60"
                  )}>
                    {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ShareActionMenu
              title={`${effectiveName} (${effectiveScrip ? `BSE: ${effectiveScrip}` : 'BSE'})`}
              headline={`Latest corporate intelligence, financials and disclosures for ${effectiveName}`}
              companyName={effectiveName}
              scripCode={effectiveScrip}
              url={`https://bsenexus.in/?scrip=${effectiveScrip}`}
              size="sm"
            />
            <motion.button
              whileTap={buttonTap}
              type="button"
              onClick={loadIntelligence}
              disabled={loading}
              aria-label="Refresh Company Intelligence"
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Refresh Intelligence"
            >
              <RefreshCw size={15} className={cn(loading && "animate-spin text-emerald-500")} />
            </motion.button>
            <motion.button
              whileTap={buttonTap}
              type="button"
              onClick={onClose}
              aria-label="Close Company Intelligence Modal"
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </motion.button>
          </div>
        </div>

        {/* Navigation Tabs - Fluid spring animated active indicator */}
        <div className="relative px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0 bg-white dark:bg-[#0F172A]">
          {[
            { id: 'hub' as const, label: 'Company Hub', icon: <Building2 size={14} /> },
            { id: 'timeline' as const, label: 'Material Actions', icon: <Zap size={14} className="text-amber-500" />, count: timelineEvents.length },
            { id: 'results' as const, label: 'Quarterly Results', icon: <BarChart3 size={14} className="text-emerald-500" />, count: quarterlyResults.length },
            { id: 'filings' as const, label: 'Filings', icon: <FileText size={14} />, count: recentFilings.length },
            { id: 'research' as const, label: 'Research Tools', icon: <Layers size={14} /> },
          ].map(tab => {
            const isTabActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                whileTap={{ scale: 0.95 }}
                transition={springBouncy}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 sm:py-3 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer z-10",
                  isTabActive
                    ? "text-emerald-600 dark:text-emerald-400 font-black"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full transition-colors",
                    isTabActive 
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}>
                    {tab.count}
                  </span>
                )}
                {/* Active animated bottom bar */}
                {isTabActive && (
                  <motion.div
                    layoutId="companyIntelActiveTabIndicator"
                    transition={springSmoothPill}
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Modal Body Container - Scrollable area (flex-1 min-h-0 overflow-y-auto) */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-4 overscroll-contain">
          {loadError ? (
            <div className="py-8">
              <TimeoutRetryState
                title="Couldn't load company intelligence"
                message={loadError}
                onRetry={loadIntelligence}
                onBack={onClose}
              />
            </div>
          ) : loading ? (
            <div className="space-y-4 min-h-[360px]">
              <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Loading financial metrics for {effectiveName}...</span>
                </span>
                <span className="text-[11px] text-slate-400">Rendering layout...</span>
              </div>
              <CompanyHubSkeleton />
            </div>
          ) : (
            <>
              {/* TAB 1: CALM COMPANY HUB */}
              {activeTab === 'hub' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {!hasAnyHistory ? (
                    /* Clean Empty State - Left-anchored */
                    <div className="p-6 sm:p-8 text-left space-y-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-lg">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Building2 size={20} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          No company history loaded yet
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Fetch official BSE announcements and financial results to initialize intelligence for {effectiveName}.
                        </p>
                      </div>

                      {isFetchingHistory && (
                        <div className="max-w-md pt-1 text-left">
                          <HonestProgressBar
                            color="emerald"
                            isRunning={true}
                            simulatedSteps={[
                              { label: `Connecting to BSE archival registry for ${selectedYears}Y data...`, durationMs: 1400 },
                              { label: 'Fetching corporate filings & board outcomes...', durationMs: 2500 },
                              { label: 'Indexing quarterly financial disclosures...', durationMs: 2500 },
                              { label: 'Synchronizing timeline & valuation records...', durationMs: 1200 }
                            ]}
                          />
                        </div>
                      )}

                      <div className="pt-1">
                        <ActionButton
                          onClick={handleFetchDeepHistory}
                          isLoading={isFetchingHistory}
                          loadingText="Loading history..."
                          variant="primary"
                          size="md"
                          icon={<Download size={14} />}
                        >
                          Load history
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Next Catalyst Section */}
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Clock size={15} className="text-slate-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              Next Catalyst
                            </span>
                            {upcoming ? (
                              <p className="font-bold text-slate-900 dark:text-white truncate">
                                {upcoming.purpose} &bull; <span className="text-emerald-600 dark:text-emerald-400 font-mono">{formatDateOnly(upcoming.meetingDate)}</span> {upcoming.countdownDays !== undefined && upcoming.countdownDays >= 0 ? `(${upcoming.countdownDays === 0 ? 'Today' : `in ${upcoming.countdownDays} days`})` : ''}
                              </p>
                            ) : (
                              <p className="text-slate-500 dark:text-slate-400 font-medium">
                                No upcoming event announced
                              </p>
                            )}
                          </div>
                        </div>

                        {upcoming && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                            Scheduled
                          </span>
                        )}
                      </div>

                      {/* Latest Material Update Card */}
                      {latestFiling && (
                        <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 rounded-xl space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Latest material update
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {formatShortDateTime(latestFiling.bseTime || latestFiling.timestamp || latestFiling.fetched_at)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                              {latestFiling.subject || latestFiling.humanTitle || 'Corporate disclosure'}
                            </h4>
                            {latestFiling.headline && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                                {latestFiling.headline}
                              </p>
                            )}
                          </div>

                          {latestFiling.pdfLink && (
                            <div>
                              <a
                                href={getSafePdfUrl(latestFiling.pdfLink, '', latestFiling.id, effectiveScrip)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                              >
                                <FileText size={13} />
                                <span>Open original PDF</span>
                                <ExternalLink size={11} className="opacity-80" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Filing Facts — bite-sized stats from official BSE filings */}
                      {filingFacts.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles size={13} className="text-amber-500" />
                              Filing Facts
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              from official BSE filings
                            </span>
                          </div>
                          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-0.5 -mx-0.5 px-0.5">
                            {filingFacts.map((fact, fIdx) => {
                              const FactIcon = fact.icon;
                              return (
                                <div
                                  key={fIdx}
                                  className="shrink-0 w-[148px] p-3 bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/70 dark:border-amber-800/40 rounded-xl space-y-1.5"
                                >
                                  <FactIcon size={15} className="text-amber-600 dark:text-amber-400" />
                                  <div className="text-[17px] font-black text-slate-900 dark:text-white leading-tight">
                                    {fact.value}
                                  </div>
                                  <div className="text-[10px] leading-snug text-slate-600 dark:text-slate-400 font-medium">
                                    {fact.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Disclosure Trend — 12-week filing activity */}
                      {activityTrend && (
                        <div className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <TrendingUp size={13} className="text-emerald-500" />
                              Disclosure Trend
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              last 12 weeks · official BSE filings
                            </span>
                          </div>
                          {activityTrend.callout && (
                            <div className="text-[15px] font-black text-slate-900 dark:text-white leading-snug">
                              {activityTrend.callout}
                            </div>
                          )}
                          <div>
                            <div className="flex items-end gap-1 h-16">
                              {activityTrend.buckets.map((count, bIdx) => (
                                <div key={bIdx} className="flex-1 flex flex-col justify-end h-full" title={`${count} filing${count === 1 ? '' : 's'}`}>
                                  <div
                                    className={cn(
                                      'w-full rounded-sm',
                                      bIdx === 11 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                    )}
                                    style={{ height: `${Math.max(5, (count / activityTrend.max) * 100)}%` }}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-1">
                              <span>12 wks ago</span>
                              <span>now</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Plain-English Takeaway & AI Summary */}
                      {aiOverview ? (
                        <div className="space-y-2">
                          <AiSummaryViewer
                            summaryText={aiOverview}
                            category="RESULTS"
                            companyName={effectiveName}
                            onRegenerate={handleGenerateAiOverview}
                            isGenerating={isGeneratingAi}
                          />
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap select-none">
                              <Sparkles size={13} className="text-amber-500 fill-amber-500" />
                              <span>Plain-English Takeaway</span>
                            </span>

                            <div className="flex items-center gap-2">
                              {!isGeneratingAi && (
                                <ActionButton
                                  onClick={handleGenerateAiOverview}
                                  isLoading={isGeneratingAi}
                                  loadingText="Synthesizing..."
                                  variant="secondary"
                                  size="sm"
                                  icon={<Bot size={13} className="text-amber-500" />}
                                  className="min-h-[36px]"
                                >
                                  Generate deeper analysis
                                </ActionButton>
                              )}
                            </div>
                          </div>

                          {isGeneratingAi ? (
                            <div className="py-2 min-h-[120px] space-y-3">
                              <HonestProgressBar
                                color="emerald"
                                isRunning={true}
                                simulatedSteps={[
                                  { label: 'Fetching corporate disclosures & ratios...', durationMs: 1200 },
                                  { label: 'Evaluating operating margins & profitability trends...', durationMs: 1800 },
                                  { label: 'Synthesizing concise investment takeaways...', durationMs: 1500 }
                                ]}
                              />
                              <div className="space-y-1.5 pt-1 animate-pulse">
                                <div className="h-3 w-4/5 bg-emerald-100 dark:bg-emerald-950/40 rounded" />
                                <div className="h-3 w-2/3 bg-emerald-100 dark:bg-emerald-950/40 rounded" />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                              No summary cached yet. Tap "Generate deeper analysis" to extract key financial takeaways.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Recent Financial Results Highlight */}
                      {quarterlyResults.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Recent Results ({quarterlyResults.length} quarters)
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('results')}
                              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>View complete ledger</span>
                              <ChevronRight size={12} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {quarterlyResults.slice(0, 2).map((qr: any, qIdx: number) => (
                              <div key={qIdx} className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {qr.quarter || `Quarter ended ${formatDateOnly(qr.date)}`}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-400">
                                    {formatDateOnly(qr.date)}
                                  </span>
                                </div>
                                {qr.revenue && (
                                  <div className="text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                    <span>Revenue:</span>
                                    <strong className="font-mono text-slate-900 dark:text-white">₹{qr.revenue} Cr</strong>
                                  </div>
                                )}
                                {qr.netProfit && (
                                  <div className="text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                    <span>Net Profit:</span>
                                    <strong className="font-mono text-slate-900 dark:text-white">₹{qr.netProfit} Cr</strong>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: MATERIAL CORPORATE ACTIONS TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 flex-wrap pb-1">
                    {[
                      { id: 'ALL', label: 'All Material Events', icon: Layers },
                      { id: 'DIVIDEND', label: 'Dividends & Splits', icon: Coins },
                      { id: 'RESULTS', label: 'Results & Meetings', icon: BarChart3 },
                      { id: 'ORDER_WIN', label: 'Orders & Contracts', icon: Award },
                      { id: 'GOVERNANCE', label: 'Governance', icon: Shield }
                    ].map(f => {
                      const Icon = f.icon;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setTimelineFilter(f.id)}
                          className={cn(
                            "px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs",
                            timelineFilter === f.id
                              ? "bg-slate-900 text-white dark:bg-emerald-600 dark:text-white border-slate-900 dark:border-emerald-600"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <Icon size={12} />
                          <span>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {filteredTimeline.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                      <p>No material corporate actions recorded under this filter for {effectiveName}.</p>
                      <button
                        type="button"
                        onClick={handleFetchDeepHistory}
                        className="px-3 py-1.5 bg-slate-900 dark:bg-emerald-600 text-white font-bold rounded-lg text-xs hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        Fetch BSE archive
                      </button>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-5 space-y-4">
                      {filteredTimeline.map((ev: any, idx: number) => {
                        const isDividend = ev.eventType === 'DIVIDEND';
                        const isBonus = ev.eventType === 'BONUS' || ev.eventType === 'SPLIT';
                        const isOrder = ev.eventType === 'ORDER_WIN';
                        const isResult = ev.eventType === 'FINANCIAL_RESULT';
                        const isMeeting = ev.eventType === 'BOARD_MEETING';

                        return (
                          <div key={idx} className="relative group">
                            <div className={cn(
                              "absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#0F172A] shadow-xs",
                              isDividend ? "bg-emerald-500" :
                              isBonus ? "bg-purple-500" :
                              isOrder ? "bg-blue-500" :
                              isResult ? "bg-emerald-600" :
                              isMeeting ? "bg-amber-500" : "bg-slate-400"
                            )} />

                            <div className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-xl space-y-2 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      {ev.title}
                                    </span>
                                    <span className={cn(
                                      "text-[9px] font-bold uppercase px-2 py-0.2 rounded-full",
                                      ev.badgeColor === 'emerald' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                                      ev.badgeColor === 'purple' ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                                      ev.badgeColor === 'blue' ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                                      ev.badgeColor === 'amber' ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                                      "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                                    )}>
                                      {ev.badgeLabel || ev.eventType}
                                    </span>
                                    {ev.extractedDetail && (
                                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                                        {ev.extractedDetail}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                    {ev.description}
                                  </p>

                                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3 pt-0.5">
                                    <span>📅 {formatShortDateTime(ev.timestamp || ev.dateStr)}</span>
                                  </div>
                                </div>

                                {ev.pdfLink && (
                                  <a
                                    href={getSafePdfUrl(ev.pdfLink, '', ev.id, effectiveScrip)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <ExternalLink size={12} />
                                    <span>PDF</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: QUARTERLY FINANCIAL RESULTS */}
              {activeTab === 'results' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <QuarterlyResultsLedger
                    results={quarterlyResults}
                    symbol={effectiveSymbol}
                    scripCode={effectiveScrip}
                    companyName={effectiveName}
                    isLoading={loading}
                    onRefresh={loadIntelligence}
                    onFetchDeepHistory={handleFetchDeepHistory}
                    isFetchingDeep={isFetchingHistory}
                    deepHistoryMsg={historySuccessMsg}
                  />
                </div>
              )}

              {/* TAB 4: ALL BSE FILINGS FEED */}
              {activeTab === 'filings' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Chronological BSE Filings Archive ({recentFilings.length} items)
                  </div>

                  {recentFilings.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No filings found in current memory cache.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {recentFilings.map((filing: any, fIdx: number) => (
                        <div 
                          key={fIdx}
                          className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {filing.subject}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              📅 {formatShortDateTime(filing.timestamp || filing.bseTime)}
                            </p>
                          </div>

                          {filing.pdfLink && (
                            <a
                              href={getSafePdfUrl(filing.pdfLink, '', filing.id, effectiveScrip)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                            >
                              <ExternalLink size={12} />
                              <span>PDF</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: RESEARCH TOOLS */}
              {activeTab === 'research' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Valuation & External Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        External Research Portals
                      </span>
                      <div className="flex items-center gap-3 pt-1">
                        {effectiveScrip && (
                          <a
                            href={`https://www.bseindia.com/stock-share-price/${effectiveSymbol || 'stock'}/${effectiveScrip}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 shadow-2xs"
                          >
                            <span>BSE Portal</span>
                            <ArrowUpRight size={12} />
                          </a>
                        )}
                        <a
                          href={`https://www.screener.in/company/${effectiveSymbol || effectiveScrip}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 shadow-2xs"
                        >
                          <span>Screener</span>
                          <ArrowUpRight size={12} />
                        </a>
                      </div>
                    </div>

                    {low52 && high52 ? (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                          <span>52-Week Range</span>
                          <span className="font-mono">₹{low52} - ₹{high52}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
                          <div 
                            className="h-full bg-linear-to-r from-emerald-500 to-blue-500 rounded-full" 
                            style={{ width: `${range52Pct}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Deep Sync Archive */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Download size={14} className="text-purple-600" />
                        <span>Pull Historical BSE Archive</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Retrieves 1 to 5 years of financial disclosures and earnings records from official BSE repository.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <select
                        value={selectedYears}
                        onChange={(e) => setSelectedYears(Number(e.target.value))}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 outline-hidden cursor-pointer"
                      >
                        <option value={1}>1 Year</option>
                        <option value={2}>2 Years</option>
                        <option value={3}>3 Years</option>
                        <option value={5}>5 Years</option>
                      </select>

                      <button
                        onClick={handleFetchDeepHistory}
                        disabled={isFetchingHistory}
                        className="px-3.5 py-1.5 bg-slate-900 dark:bg-emerald-600 hover:opacity-90 active:scale-95 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <Download size={13} className={cn(isFetchingHistory && "animate-bounce")} />
                        <span>{isFetchingHistory ? "Syncing..." : `Sync ${selectedYears}Y`}</span>
                      </button>
                    </div>
                  </div>

                  {historySuccessMsg && (
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span className="font-semibold">{historySuccessMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px]">Official BSE Corporate Repository</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Floating Toast Notification */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={springSnappy}
              className="absolute bottom-16 right-4 sm:right-6 z-50 max-w-sm px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2.5 backdrop-blur-md bg-white/95 dark:bg-[#1A1926]/95 text-slate-900 dark:text-white"
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
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
