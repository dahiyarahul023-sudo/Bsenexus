import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Newspaper, 
  Send, 
  Search, 
  ExternalLink, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Bookmark, 
  Building2, 
  CheckCircle, 
  AlertCircle, 
  Filter,
  Flame,
  Radio,
  Clock,
  Globe,
  Bell,
  ShieldCheck,
  Power,
  X,
  Check,
  LayoutGrid,
  List,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Share2,
  SlidersHorizontal
} from 'lucide-react';
import { StockNewsItem, Watchlist } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { springSnappy, containerStaggerVariants, itemFadeUpVariants, buttonTap } from '../utils/motionTokens';
import { useDeveloperMode } from '../utils/developerMode';
import { CustomDropdown, DropdownOption } from './ui/CustomDropdown';
import { NewsFeedSkeleton } from './ui/DesignedSkeletons';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from './ui/PullToRefreshIndicator';
import { ActionButton } from './ui/ActionButton';
import { HonestProgressBar } from './ui/HonestProgressBar';
import { ShareActionMenu } from './ui/motion/ShareActionMenu';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { customFetch } from '../api';
import { syncQuotaFromResponse } from '../utils/aiQuota';
import { useAuth } from '../context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Robust text sanitizer for RSS headlines and snippets
function sanitizeNewsText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/gi, '')
    .replace(/\]\]&gt;/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/''+/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface NewsPortalProps {
  watchlists?: Watchlist[];
  user?: any;
  onOpenWatchlists?: () => void;
  onOpenSettings?: () => void;
}

const PUBLISHER_SOURCES = [
  { slug: 'all', name: 'All Sources', shortName: 'All' },
  { slug: 'et', name: 'Economic Times', shortName: 'ET' },
  { slug: 'mint', name: 'LiveMint', shortName: 'Mint' },
  { slug: 'moneycontrol', name: 'Moneycontrol', shortName: 'MC' },
  { slug: 'bs', name: 'Business Standard', shortName: 'BS' }
];

const CATEGORY_TABS = [
  { id: 'all', label: 'All News', icon: Flame },
  { id: 'earnings', label: 'Results & Earnings', icon: TrendingUp },
  { id: 'corporate', label: 'Corporate Actions', icon: Building2 },
  { id: 'regulatory', label: 'SEBI & Regulatory', icon: ShieldCheck },
  { id: 'market', label: 'General Market', icon: Globe }
];

function getCategoryBadge(category?: string) {
  switch (category) {
    case 'RESULTS':
    case 'EARNINGS':
    case 'earnings':
      return { label: 'Earnings', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
    case 'CORPORATE_ACTION':
    case 'DEAL':
    case 'corporate':
      return { label: 'Corporate', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
    case 'REGULATORY':
    case 'SEBI':
    case 'regulatory':
      return { label: 'Regulatory', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
    default:
      return { label: 'Market', color: 'bg-slate-100 text-slate-700 dark:bg-[#201E2E] dark:text-slate-300 border-slate-200 dark:border-[#2D283E]' };
  }
}

function sourceBadgeColor(source: string) {
  if (source.includes('Economic Times')) return 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  if (source.includes('LiveMint')) return 'text-orange-700 bg-orange-50 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800';
  if (source.includes('Moneycontrol')) return 'text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  if (source.includes('Business Standard')) return 'text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  return 'text-slate-700 bg-slate-100 dark:bg-[#201E2E] dark:text-slate-300 border-slate-200 dark:border-[#2D283E]';
}

// ----------------------------------------------------
// Modern, Streamlined News Card Item
// Gesture-enabled: Swipe Right -> Telegram, Swipe Left -> Gemini AI
// ----------------------------------------------------
interface NewsCardProps {
  item: StockNewsItem;
  viewMode: 'grid' | 'list';
  isSending: boolean;
  isSentSuccess: boolean;
  isAiLoading: boolean;
  aiSummary?: string;
  isAiExpanded?: boolean;
  onSendTelegram: (item: StockNewsItem) => void;
  onToggleAi: (item: StockNewsItem) => void;
}

const NewsCardItem: React.FC<NewsCardProps> = React.memo(({
  item,
  viewMode,
  isSending,
  isSentSuccess,
  isAiLoading,
  aiSummary,
  isAiExpanded,
  onSendTelegram,
  onToggleAi
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handleCopySummary = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!aiSummary) return;
    navigator.clipboard.writeText(aiSummary).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    });
  };

  const catBadge = getCategoryBadge(item.category);
  const cleanTitle = sanitizeNewsText(item.title);
  const cleanSnippet = sanitizeNewsText(item.snippet);

  return (
    <motion.div 
      id={`news-${item.id}`}
      variants={itemFadeUpVariants}
      data-news-card="true"
      style={{ touchAction: 'pan-y', pointerEvents: 'auto' }}
      className={cn(
        "news-touch-scroll news-card-item touch-pan-y pointer-events-auto relative bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl transition-colors shadow-2xs group hover:border-slate-300 dark:hover:border-[#3D3754]",
        viewMode === 'grid' ? "p-3.5 flex flex-col justify-between" : "p-3 sm:p-3.5"
      )}
    >
      <div className="space-y-2.5">
          {/* Header Row: Source, Symbol, Category & Timestamp (Clean & Uncluttered) */}
          <div className="flex items-center justify-between gap-1.5 text-[10px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("px-1.5 py-0.5 rounded font-bold border text-[10px]", sourceBadgeColor(item.source))}>
                {item.source}
              </span>
              {item.symbol && (
                <span className="px-1.5 py-0.5 rounded font-mono font-black bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                  {item.symbol}
                </span>
              )}
              <span className={cn("px-1.5 py-0.5 rounded font-bold border", catBadge.color)}>
                {catBadge.label}
              </span>
            </div>

            {/* Time & Sentiment */}
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[10.5px] shrink-0">
              {item.sentiment === 'positive' && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 text-[10px]">
                  <TrendingUp size={10} /> Bullish
                </span>
              )}
              {item.sentiment === 'negative' && (
                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5 text-[10px]">
                  <TrendingDown size={10} /> Bearish
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={10} /> {item.timeAgo || 'Recent'}
              </span>
            </div>
          </div>

          {/* Headline (Crisp, Sanitized & Direct) */}
          <h3 className="text-xs sm:text-[13.5px] font-bold text-slate-900 dark:text-white leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <a 
              href={item.link} 
              target="_blank" 
              rel="noreferrer noopener"
              className="hover:underline flex items-start gap-1"
            >
              <span>{cleanTitle}</span>
            </a>
          </h3>

          {/* Snippet */}
          {cleanSnippet && (
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-normal">
              {cleanSnippet}
            </p>
          )}

          {/* Expandable Gemini AI Key Takeaways Box */}
          <AnimatePresence>
            {isAiExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={springSnappy}
                className="overflow-hidden pt-1"
              >
                <div className="p-3 bg-purple-50/70 dark:bg-[#221B33] border border-purple-200 dark:border-purple-800/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold">
                      <Sparkles size={13} className="text-purple-500" />
                      <span>Gemini AI Key Takeaways</span>
                    </div>
                    {aiSummary && (
                      <button
                        type="button"
                        onClick={handleCopySummary}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-[#1A1926] border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        {copiedSummary ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                        <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  {isAiLoading ? (
                    <div className="py-2 min-h-[110px] space-y-3">
                      <HonestProgressBar
                        color="purple"
                        isRunning={true}
                        simulatedSteps={[
                          { label: 'Scanning news headline & corporate disclosures...', durationMs: 1100 },
                          { label: 'Detecting financial catalyst & sector headwinds...', durationMs: 1600 },
                          { label: 'Synthesizing concise analyst takeaway...', durationMs: 1400 }
                        ]}
                      />
                      <div className="space-y-1.5 pt-1 animate-pulse">
                        <div className="h-3 w-4/5 bg-purple-100 dark:bg-purple-950/40 rounded" />
                        <div className="h-3 w-2/3 bg-purple-100 dark:bg-purple-950/40 rounded" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed font-normal whitespace-pre-line">
                      {sanitizeNewsText(aiSummary)}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Minimalist Action Bar */}
        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 dark:border-[#201E2E] text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            {isSentSuccess ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                <Check size={10} />
                <span>Dispatched</span>
              </span>
            ) : (
              <span className="text-[10.5px] text-slate-400 font-medium">
                {item.source}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick 1-Tap Telegram Dispatch */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={(e) => {
                e.stopPropagation();
                onSendTelegram(item);
              }}
              disabled={isSending || isSentSuccess}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer select-none min-h-[32px]",
                isSentSuccess
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                  : "bg-slate-100 hover:bg-sky-50 dark:bg-[#222030] dark:hover:bg-sky-950/40 text-slate-600 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-300 border border-slate-200 dark:border-[#2D283E]"
              )}
              title="Broadcast headline to Telegram"
            >
              {isSending ? (
                <RefreshCw size={11} className="animate-spin text-sky-500" />
              ) : isSentSuccess ? (
                <Check size={11} className="text-emerald-500" />
              ) : (
                <Send size={11} className="text-sky-500" />
              )}
              <span>{isSentSuccess ? 'Sent' : 'Telegram'}</span>
            </motion.button>

            {/* Quick 1-Tap AI Toggle Button */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => onToggleAi(item)}
              disabled={isAiLoading}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer select-none min-h-[32px]",
                isAiExpanded
                  ? "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700"
                  : "bg-slate-100 hover:bg-purple-50 dark:bg-[#222030] dark:hover:bg-purple-950/40 text-slate-600 hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-300 border border-slate-200 dark:border-[#2D283E]"
              )}
              title="Gemini AI Summary"
            >
              <Sparkles size={11} className={cn("text-purple-500", isAiLoading && "animate-spin")} />
              <span>{isAiExpanded ? 'Hide AI' : 'AI Takeaway'}</span>
            </motion.button>

            {/* 1-Tap Share Action Menu */}
            <ShareActionMenu
              title={item.title}
              headline={item.source ? `Source: ${item.source}` : undefined}
              url={item.link}
              size="xs"
            />

            {/* External Source Link */}
            <motion.a
              whileTap={buttonTap}
              transition={springSnappy}
              href={item.link}
              target="_blank"
              rel="noreferrer noopener"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#222030] dark:hover:bg-[#2D283E] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-slate-200 dark:border-[#2D283E] min-h-[32px] min-w-[32px] flex items-center justify-center select-none"
              title="Open full news article in new tab"
            >
              <ExternalLink size={12} />
            </motion.a>
          </div>
        </div>
      </motion.div>
  );
});

export const NewsPortal: React.FC<NewsPortalProps> = ({
  watchlists = [],
  user,
  onOpenWatchlists,
  onOpenSettings
}) => {
  const { user: authUser, profile, isPro, isAdmin, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const currentUser = user || authUser;
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'watchlist'>('general');
  const [generalNews, setGeneralNews] = useState<StockNewsItem[]>([]);
  const [watchlistNews, setWatchlistNews] = useState<StockNewsItem[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(30);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedStockFilter, setSelectedStockFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');

  // AI Summaries State
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [generatingAiId, setGeneratingAiId] = useState<string | null>(null);
  const [expandedAiIds, setExpandedAiIds] = useState<Record<string, boolean>>({});

  // Telegram News Category Preferences Modal State
  const [isTgPrefModalOpen, setIsTgPrefModalOpen] = useState(false);
  const [tgNewsEnabled, setTgNewsEnabled] = useState<boolean>(
    Boolean(user?.notificationPreferences?.telegramNewsAlerts === true)
  );
  const [tgSelectedCategories, setTgSelectedCategories] = useState<string[]>(
    user?.notificationPreferences?.telegramNewsCategories || ['all']
  );
  const [tgSelectedSources, setTgSelectedSources] = useState<string[]>(
    user?.notificationPreferences?.telegramNewsSources || ['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard']
  );
  const [isSavingTgPref, setIsSavingTgPref] = useState(false);
  const [tgSaveSuccess, setTgSaveSuccess] = useState(false);

  // Telegram sending state
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Lock background scroll when Filter Sheet or Telegram Preferences Modal is open
  useBodyScrollLock(Boolean(isFilterSheetOpen || isTgPrefModalOpen));

  // View Mode: 'grid' (desktop) vs 'list' (default on mobile)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('nexus_news_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
      return typeof window !== 'undefined' && window.innerWidth >= 768 ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('nexus_news_view_mode', mode);
    } catch {}
  };

  // Extract all symbols from active watchlists
  const activeTrackedSymbols = useMemo(() => {
    const syms = new Set<string>();
    watchlists.forEach(w => {
      if (w.is_active !== 0) {
        (w.items || []).forEach(it => {
          const s = typeof it === 'string' ? it.split(':')[0] : (it?.symbol || '');
          if (s) syms.add(s.toUpperCase().trim());
        });
      }
    });
    return Array.from(syms);
  }, [watchlists]);

  // Fetch preferences on mount
  useEffect(() => {
    if (!currentUser && !profile) return;
    customFetch('/api/news/telegram/preferences')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTgNewsEnabled(data.enabled);
          if (Array.isArray(data.categories)) setTgSelectedCategories(data.categories);
          if (Array.isArray(data.sources)) setTgSelectedSources(data.sources);
        }
      })
      .catch(() => {});
  }, [currentUser?.uid, profile?.uid]);

  // Fetch General Market News
  const fetchGeneralNewsData = useCallback(async (force = false, source = selectedSource) => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (force) queryParams.append('refresh', 'true');
      if (source && source !== 'all') queryParams.append('source', source);

      const res = await customFetch(`/api/news/general?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setGeneralNews(data.items);
      }
    } catch (err) {
      console.error('Failed to load general news:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSource]);

  // Fetch Watchlist News
  const fetchWatchlistNewsData = useCallback(async (source = selectedSource) => {
    if (!currentUser && !profile) {
      setWatchlistNews([]);
      setWatchlistSymbols([]);
      return;
    }
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (source && source !== 'all') queryParams.append('source', source);

      const res = await customFetch(`/api/news/watchlist?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setWatchlistNews(data.items || []);
        setWatchlistSymbols(data.symbols || []);
      }
    } catch (err) {
      console.error('Failed to load watchlist news:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSource, currentUser?.uid, profile?.uid]);

  // Initial fetch
  useEffect(() => {
    fetchGeneralNewsData(false, selectedSource);
    fetchWatchlistNewsData(selectedSource);
  }, [fetchGeneralNewsData, fetchWatchlistNewsData, selectedSource]);

  // Native Pull to Refresh Hook (Swipe down anywhere in the container to refresh!)
  const { 
    containerRef: feedScrollRef, 
    pullDistance, 
    isPulling, 
    isRefreshing: isPullRefreshing, 
    progress: pullProgress 
  } = usePullToRefresh<HTMLDivElement>({
    onRefresh: async () => {
      if (activeSubTab === 'general') {
        await fetchGeneralNewsData(true, selectedSource);
      } else {
        await fetchWatchlistNewsData(selectedSource);
      }
    }
  });

  // Shared 45s visibility-gated background polling
  useVisibilityInterval(() => {
    if (activeSubTab === 'general') {
      fetchGeneralNewsData(false, selectedSource);
    } else {
      fetchWatchlistNewsData(selectedSource);
    }
  }, 45000);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(30);
  }, [activeSubTab, categoryFilter, selectedSource, selectedStockFilter, sentimentFilter, searchQuery]);

  // Save Telegram Category Preferences
  const handleSaveTgPreferences = async () => {
    const isGuestUser = !authUser || authUser.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isPro && !isAdmin) {
      setIsProModalOpen(true);
      return;
    }

    setIsSavingTgPref(true);
    try {
      const res = await customFetch('/api/news/telegram/toggle-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: tgNewsEnabled,
          categories: tgSelectedCategories,
          sources: tgSelectedSources
        })
      });
      const data = await res.json();
      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        return;
      }
      if (res.status === 403 || data?.proRequired) {
        setIsProModalOpen(true);
        return;
      }
      if (data.success) {
        setTgSaveSuccess(true);
        setTimeout(() => {
          setTgSaveSuccess(false);
          setIsTgPrefModalOpen(false);
        }, 1200);
      }
    } catch (err) {
      console.error('Error saving telegram news preferences:', err);
    } finally {
      setIsSavingTgPref(false);
    }
  };

  const handleToggleTgCategory = (catId: string) => {
    if (catId === 'all') {
      setTgSelectedCategories(['all']);
      return;
    }

    let next = tgSelectedCategories.filter(c => c !== 'all');
    if (next.includes(catId)) {
      next = next.filter(c => c !== catId);
      if (next.length === 0) next = ['all'];
    } else {
      next.push(catId);
    }
    setTgSelectedCategories(next);
  };

  const handleToggleTgSource = (srcName: string) => {
    let next = [...tgSelectedSources];
    if (next.includes(srcName)) {
      next = next.filter(s => s !== srcName);
      if (next.length === 0) next = [srcName];
    } else {
      next.push(srcName);
    }
    setTgSelectedSources(next);
  };

  const handleSendToTelegram = useCallback(async (item: StockNewsItem) => {
    const isGuestUser = !authUser || authUser.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      setSendError('Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial to broadcast to Telegram!');
      setTimeout(() => setSendError(null), 5000);
      return;
    }

    if (!isPro && !isAdmin) {
      setIsProModalOpen(true);
      setSendError('1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) to broadcast to Telegram!');
      setTimeout(() => setSendError(null), 5000);
      return;
    }

    setSendingId(item.id);
    setSendError(null);
    try {
      const res = await customFetch('/api/news/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsItem: item })
      });
      const data = await res.json();
      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        setSendError(data?.error || 'Google Sign-In Required.');
        setTimeout(() => setSendError(null), 5000);
        return;
      }
      if (res.status === 403 || data?.proRequired) {
        setIsProModalOpen(true);
        setSendError(data?.error || 'Pro upgrade required.');
        setTimeout(() => setSendError(null), 5000);
        return;
      }
      if (data.success) {
        setSentSuccessId(item.id);
        setTimeout(() => setSentSuccessId(null), 3000);
      } else {
        setSendError(data.error || 'Failed to dispatch to Telegram');
        setTimeout(() => setSendError(null), 4000);
      }
    } catch (err: any) {
      setSendError(err.message || 'Network error');
      setTimeout(() => setSendError(null), 4000);
    } finally {
      setSendingId(null);
    }
  }, [authUser, isPro, isAdmin, setIsAuthModalOpen, setIsProModalOpen]);

  const handleToggleAiSummary = useCallback(async (item: StockNewsItem) => {
    // 1. Guests are strictly view-only
    const isGuestUser = !authUser || authUser.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      setSendError('Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro AI summaries!');
      setTimeout(() => setSendError(null), 5000);
      return;
    }

    // 2. Authenticated user without active Pro trial
    if (!isPro && !isAdmin) {
      setIsProModalOpen(true);
      setSendError('1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) for unlimited AI summaries!');
      setTimeout(() => setSendError(null), 5000);
      return;
    }

    if (aiSummaries[item.id]) {
      setExpandedAiIds(prev => ({ ...prev, [item.id]: !prev[item.id] }));
      return;
    }

    setGeneratingAiId(item.id);
    setExpandedAiIds(prev => ({ ...prev, [item.id]: true }));

    try {
      const res = await customFetch('/api/news/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          snippet: item.snippet,
          source: item.source,
          symbol: item.symbol,
          companyName: item.companyName,
          link: item.link
        })
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        setSendError(data?.error || 'Google Sign-In Required: Sign in to enjoy 1 week of Free Pro AI features.');
        setTimeout(() => setSendError(null), 5000);
        setExpandedAiIds(prev => ({ ...prev, [item.id]: false }));
        return;
      }

      if (res.status === 429) {
        syncQuotaFromResponse(data || { remainingQuota: 0 });
        setSendError(data?.error || 'Daily AI summary quota reached (100/day)');
        setTimeout(() => setSendError(null), 4000);
        setExpandedAiIds(prev => ({ ...prev, [item.id]: false }));
        return;
      }

      if (res.ok && data?.success && data?.aiSummary) {
        syncQuotaFromResponse(data);
        setAiSummaries(prev => ({ ...prev, [item.id]: data.aiSummary }));
      } else {
        setSendError(data?.error || 'Could not generate AI summary');
        setTimeout(() => setSendError(null), 4000);
        setExpandedAiIds(prev => ({ ...prev, [item.id]: false }));
      }
    } catch (err: any) {
      setSendError(err.message || 'Failed to generate AI summary');
      setTimeout(() => setSendError(null), 4000);
      setExpandedAiIds(prev => ({ ...prev, [item.id]: false }));
    } finally {
      setGeneratingAiId(null);
    }
  }, [aiSummaries, authUser, isPro, isAdmin, setIsAuthModalOpen, setIsProModalOpen]);

  // Active base dataset
  const currentDataset = activeSubTab === 'general' ? generalNews : watchlistNews;

  // Compute category counts for current dataset
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: currentDataset.length,
      earnings: 0,
      corporate: 0,
      regulatory: 0,
      market: 0
    };

    currentDataset.forEach(item => {
      const cat = (item.category || '').toUpperCase();
      if (cat === 'RESULTS' || cat === 'EARNINGS') counts.earnings++;
      else if (cat === 'CORPORATE_ACTION' || cat === 'DEAL' || cat === 'CORPORATE') counts.corporate++;
      else if (cat === 'REGULATORY' || cat === 'SEBI') counts.regulatory++;
      else counts.market++;
    });

    return counts;
  }, [currentDataset]);

  // Filter items
  const filteredNews = useMemo(() => {
    return currentDataset.filter(item => {
      // 1. Publisher Source Filter
      if (selectedSource !== 'all') {
        if (selectedSource === 'et' && !item.source.includes('Economic Times')) return false;
        if (selectedSource === 'mint' && !item.source.includes('LiveMint')) return false;
        if (selectedSource === 'moneycontrol' && !item.source.includes('Moneycontrol')) return false;
        if (selectedSource === 'bs' && !item.source.includes('Business Standard')) return false;
      }

      // 2. Category Filter
      if (categoryFilter !== 'all') {
        const cat = (item.category || '').toUpperCase();
        if (categoryFilter === 'earnings' && cat !== 'RESULTS' && cat !== 'EARNINGS') return false;
        if (categoryFilter === 'corporate' && cat !== 'CORPORATE_ACTION' && cat !== 'DEAL' && cat !== 'CORPORATE') return false;
        if (categoryFilter === 'regulatory' && cat !== 'REGULATORY' && cat !== 'SEBI') return false;
        if (categoryFilter === 'market' && (cat === 'RESULTS' || cat === 'EARNINGS' || cat === 'CORPORATE_ACTION' || cat === 'DEAL' || cat === 'CORPORATE' || cat === 'REGULATORY' || cat === 'SEBI')) return false;
      }

      // 3. Sentiment Filter
      if (sentimentFilter !== 'all') {
        if (sentimentFilter === 'positive' && item.sentiment !== 'positive') return false;
        if (sentimentFilter === 'negative' && item.sentiment !== 'negative') return false;
        if (sentimentFilter === 'neutral' && item.sentiment !== 'neutral' && item.sentiment !== undefined) return false;
      }

      // 4. Stock Ticker Filter (Watchlist mode)
      if (activeSubTab === 'watchlist' && selectedStockFilter !== 'all') {
        if (item.symbol !== selectedStockFilter) return false;
      }

      // 5. Search keyword
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSnippet = item.snippet?.toLowerCase().includes(q);
        const matchesSymbol = item.symbol?.toLowerCase().includes(q);
        const matchesCompany = item.companyName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSnippet && !matchesSymbol && !matchesCompany) return false;
      }

      return true;
    });
  }, [currentDataset, selectedSource, categoryFilter, sentimentFilter, selectedStockFilter, activeSubTab, searchQuery]);

  const displayedNews = useMemo(() => {
    return filteredNews.slice(0, visibleCount);
  }, [filteredNews, visibleCount]);

  // Dropdown options
  const sentimentOptions: DropdownOption[] = [
    { value: 'all', label: 'All Sentiments' },
    { value: 'positive', label: 'Bullish Catalysts', icon: TrendingUp },
    { value: 'negative', label: 'Bearish Catalysts', icon: TrendingDown },
    { value: 'neutral', label: 'Neutral Tone', icon: Minus }
  ];

  const stockTickerOptions: DropdownOption[] = [
    { value: 'all', label: 'All Watchlist Stocks', count: activeTrackedSymbols.length },
    ...activeTrackedSymbols.map(sym => ({
      value: sym,
      label: sym,
      count: watchlistNews.filter(n => n.symbol === sym).length || undefined
    }))
  ];

  const activeNavScope = useMemo(() => {
    if (activeSubTab === 'watchlist') return 'watchlist';
    if (categoryFilter === 'earnings') return 'earnings';
    if (categoryFilter === 'corporate') return 'corporate';
    if (categoryFilter === 'regulatory') return 'regulatory';
    return 'all';
  }, [activeSubTab, categoryFilter]);

  const handleSelectNavScope = (scopeId: string) => {
    if (scopeId === 'watchlist') {
      setActiveSubTab('watchlist');
      setCategoryFilter('all');
    } else {
      setActiveSubTab('general');
      setSelectedStockFilter('all');
      setCategoryFilter(scopeId);
    }
  };

  return (
    <div ref={feedScrollRef} className="space-y-2.5 overscroll-y-contain relative">
      {/* Pull to Refresh Animated Indicator (Like Watchlist & Filings) */}
      <PullToRefreshIndicator 
        pullDistance={pullDistance}
        isPulling={isPulling}
        isRefreshing={isPullRefreshing || (isLoading && filteredNews.length > 0)}
        progress={pullProgress}
        label="Market News"
      />

      {/* 1. STREAMLINED UNIFIED TOOLBAR: Sticky below navbar - Page Title, Search & Filter Trigger */}
      <div className="sticky top-14 md:top-[89px] z-30 bg-white/95 dark:bg-[#1A1926]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col gap-2">
        {/* Row 1: Title, Search Bar & Filter Bottom Sheet Trigger */}
        <div className="flex items-center gap-2 justify-between">
          
          {/* Left: Brand Title & Single Count */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Newspaper className="w-4 h-4 text-blue-500 shrink-0" />
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display whitespace-nowrap">
              Market News
            </h1>
            <span className="text-xs text-slate-500 font-mono">
              ({filteredNews.length})
            </span>
          </div>

          {/* Center: Search Box (44px min height for mobile precision) */}
          <div className="relative flex-1 max-w-lg min-h-[44px] sm:min-h-[36px] flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeSubTab === 'general' ? "Search news headlines..." : "Filter by stock symbol..."}
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

          {/* Right: Filter & View Switcher */}
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

            {/* Filter Trigger with Chevron */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setIsFilterSheetOpen(true)}
              className={cn(
                "min-h-[44px] sm:min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none border",
                (selectedSource !== 'all' || sentimentFilter !== 'all' || selectedStockFilter !== 'all')
                  ? "bg-slate-100 dark:bg-[#252233] text-slate-900 dark:text-white border-slate-300 dark:border-[#3E3854]"
                  : "bg-white dark:bg-[#1A1926] hover:bg-slate-50 dark:hover:bg-[#222030] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
              )}
              title="Open News Filters, Sources & Telegram Dispatches"
            >
              <span>Filter</span>
              <ChevronDown size={13} className="text-slate-500" />
              {(selectedSource !== 'all' || sentimentFilter !== 'all' || selectedStockFilter !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white" />
              )}
            </motion.button>

            {/* Quick Refresh Button */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => {
                if (activeSubTab === 'general') {
                  fetchGeneralNewsData(true, selectedSource);
                } else {
                  fetchWatchlistNewsData(selectedSource);
                }
              }}
              disabled={isLoading}
              className="min-h-[44px] sm:min-h-[36px] min-w-[44px] sm:min-w-[36px] px-2.5 rounded-lg bg-white dark:bg-[#1A1926] hover:bg-slate-50 dark:hover:bg-[#222030] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2D283E] flex items-center justify-center cursor-pointer select-none transition-all"
              title="Refresh News Feed"
            >
              <RefreshCw size={13} className={cn(isLoading && "animate-spin text-emerald-500")} />
            </motion.button>
          </div>
        </div>

        {/* Row 2: Plain Text Tabs with Single Active Underline */}
        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100 dark:border-[#2D283E]/60 text-xs">
          {[
            { id: 'all', label: 'All News' },
            { id: 'watchlist', label: 'My Watchlist' },
            { id: 'earnings', label: 'Results & Earnings' },
            { id: 'corporate', label: 'Corporate Actions' },
            { id: 'regulatory', label: 'SEBI & Regulatory' }
          ].map(tab => {
            const isTabActive = activeNavScope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectNavScope(tab.id)}
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
                    layoutId="activeNewsTabUnderline"
                    transition={springSnappy}
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white rounded-full"
                  />
                )}
              </button>
            );
          })}

          {/* Quick Clear Filter Button if sub-filters are active */}
          {(selectedSource !== 'all' || sentimentFilter !== 'all' || selectedStockFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedSource('all');
                setSentimentFilter('all');
                setSelectedStockFilter('all');
              }}
              className="py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer shrink-0 ml-auto"
            >
              <span>Reset Sub-filters</span>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 2. FILTER & PREFERENCES BOTTOM SHEET / MODAL */}
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
                  <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                    News Filters & Sources
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

              {/* Section 1: Categories */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  News Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORY_TABS.map((cat) => {
                    const isSelected = categoryFilter === cat.id;
                    const count = categoryCounts[cat.id] || 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryFilter(cat.id)}
                        className={cn(
                          "min-h-[44px] px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer",
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs"
                            : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                        )}
                      >
                        <span className="truncate">{cat.label}</span>
                        <span className="text-[10px] font-mono opacity-80 shrink-0 ml-1">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Publisher Sources */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Publisher Source
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PUBLISHER_SOURCES.map((src) => {
                    const isSelected = selectedSource === src.slug;
                    return (
                      <button
                        key={src.slug}
                        type="button"
                        onClick={() => setSelectedSource(src.slug)}
                        className={cn(
                          "min-h-[44px] px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center text-center cursor-pointer",
                          isSelected
                            ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                            : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                        )}
                      >
                        <span className="truncate">{src.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Sentiment Filter */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Market Sentiment Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {sentimentOptions.map((s) => {
                    const isSelected = sentimentFilter === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSentimentFilter(s.value)}
                        className={cn(
                          "min-h-[44px] px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer",
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs"
                            : "bg-slate-50 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                        )}
                      >
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 4: Watchlist Stock Filter */}
              {activeSubTab === 'watchlist' && activeTrackedSymbols.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Filter by Stock Symbol
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 dark:bg-[#14131E] rounded-xl border border-slate-200 dark:border-[#2D283E]">
                    <button
                      type="button"
                      onClick={() => setSelectedStockFilter('all')}
                      className={cn(
                        "min-h-[36px] px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                        selectedStockFilter === 'all'
                          ? "bg-amber-500 text-slate-950 border-amber-600"
                          : "bg-white dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      All ({activeTrackedSymbols.length})
                    </button>
                    {activeTrackedSymbols.map(sym => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => setSelectedStockFilter(sym)}
                        className={cn(
                          "min-h-[36px] px-2.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer",
                          selectedStockFilter === sym
                            ? "bg-amber-500 text-slate-950 border-amber-600"
                            : "bg-white dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                        )}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 5: 24/7 Telegram News Dispatches Shortcut */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterSheetOpen(false);
                    setIsTgPrefModalOpen(true);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-blue-500" />
                    <span>24/7 Telegram Alert Preferences</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-200/60 dark:bg-blue-900/60">
                    {tgNewsEnabled ? "ENABLED" : "OFF"}
                  </span>
                </button>
              </div>

              {/* Apply Button */}
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-full min-h-[44px] py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Apply & View Stories
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. FLUID SCROLLABLE FEED LIST */}
      <div 
        style={{ touchAction: 'pan-y', pointerEvents: 'auto' }}
        className="news-feed-container touch-pan-y pointer-events-auto bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl shadow-xs min-h-[500px] relative"
      >
        {/* Global Feedback Banner */}
        {sendError && (
          <div className="m-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium rounded-lg flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{sendError}</span>
          </div>
        )}

        {/* Designed Skeleton for Initial Loading State */}
        {isLoading && filteredNews.length === 0 && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono px-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Streaming verified financial feeds (ET, LiveMint, Moneycontrol)...</span>
              </span>
              <span className="text-[11px] text-slate-400">Loading layout...</span>
            </div>
            <NewsFeedSkeleton count={5} />
          </div>
        )}

        {/* Empty State - Left aligned with single anchor and strong proximity */}
        {!isLoading && filteredNews.length === 0 && (
          <div className="my-8 p-6 sm:p-8 max-w-lg mx-auto bg-white dark:bg-[#161422] border border-slate-200/90 dark:border-[#2C2740] rounded-2xl shadow-xs space-y-4 text-left">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#201E2E] flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Filter size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                No News Found Matching Current Filters
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {activeSubTab === 'watchlist' && activeTrackedSymbols.length === 0
                  ? "You don't have any active stocks in your watchlist yet."
                  : "Try clearing search keywords, switching publisher source, or changing category."}
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setSelectedSource('all');
                  setSelectedStockFilter('all');
                  setSentimentFilter('all');
                }}
                className="px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer select-none hover:opacity-90 active:scale-95"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        {/* News Feed Grid or List Mode with items-start and Smooth Stagger Transitions */}
        {displayedNews.length > 0 && (
          <motion.div 
            key="newsportal-feed-container"
            variants={containerStaggerVariants}
            initial="hidden"
            animate="visible"
            style={{ touchAction: 'pan-y', pointerEvents: 'auto' }}
            className={cn(
              "news-cards-grid touch-pan-y pointer-events-auto",
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 p-3 sm:p-3.5 items-start" 
                : "divide-y divide-slate-100 dark:divide-[#2D283E]"
            )}
          >
            {displayedNews.map((item) => (
              <NewsCardItem
                key={item.id}
                item={item}
                viewMode={viewMode}
                isSending={sendingId === item.id}
                isSentSuccess={sentSuccessId === item.id}
                isAiLoading={generatingAiId === item.id}
                aiSummary={aiSummaries[item.id]}
                isAiExpanded={expandedAiIds[item.id]}
                onSendTelegram={handleSendToTelegram}
                onToggleAi={handleToggleAiSummary}
              />
            ))}
          </motion.div>
        )}

        {/* Load More Button if news items exceed visible limit */}
        {filteredNews.length > visibleCount && (
          <div className="p-4 text-center border-t border-slate-100 dark:border-[#201E2E]">
            <button
              type="button"
              onClick={() => setVisibleCount(prev => prev + 30)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#201E2E] dark:hover:bg-[#282538] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs select-none active:scale-95"
            >
              Load More News ({filteredNews.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>

      {/* 4. TELEGRAM NEWS CATEGORY & SOURCE PREFERENCES MODAL */}
      <AnimatePresence>
        {isTgPrefModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
            >
              {/* Native Mobile Drag Handle Bar */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-2 mb-2 shrink-0 sm:hidden" />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2D283E] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Bell size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Telegram News Alert Preferences
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure automated 24/7 delivery of verified market catalysts to Telegram
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTgPrefModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Master 24/7 Switch */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14131E] border border-slate-200/80 dark:border-[#2D283E] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    24/7 Automated Watchlist Dispatches
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Dispatches breaking news for active watchlist stocks straight to Telegram
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTgNewsEnabled(!tgNewsEnabled)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 select-none",
                    tgNewsEnabled
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}
                >
                  <Power size={12} />
                  <span>{tgNewsEnabled ? 'Active' : 'Paused'}</span>
                </button>
              </div>

              {/* Category Selection Options */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Select News Categories for Telegram:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* All Categories Option */}
                  <button
                    type="button"
                    onClick={() => handleToggleTgCategory('all')}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all sm:col-span-2 select-none",
                      tgSelectedCategories.includes('all')
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-bold"
                        : "bg-white dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div>
                      <span className="block font-bold">⚡ All News Categories</span>
                      <span className="text-[10px] text-slate-500 font-normal">Receive all verified corporate, earnings, and regulatory alerts</span>
                    </div>
                    {tgSelectedCategories.includes('all') && <Check size={14} className="text-blue-600" />}
                  </button>

                  {/* Results & Earnings */}
                  <button
                    type="button"
                    onClick={() => handleToggleTgCategory('earnings')}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all select-none",
                      tgSelectedCategories.includes('earnings') && !tgSelectedCategories.includes('all')
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold"
                        : "bg-white dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div>
                      <span className="block font-bold">📈 Results &amp; Earnings</span>
                      <span className="text-[10px] text-slate-500 font-normal">Quarterly profits, revenue surprises</span>
                    </div>
                    {tgSelectedCategories.includes('earnings') && !tgSelectedCategories.includes('all') && <Check size={14} className="text-emerald-600" />}
                  </button>

                  {/* Corporate Actions */}
                  <button
                    type="button"
                    onClick={() => handleToggleTgCategory('corporate')}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all select-none",
                      tgSelectedCategories.includes('corporate') && !tgSelectedCategories.includes('all')
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-bold"
                        : "bg-white dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div>
                      <span className="block font-bold">🏢 Corporate Deals</span>
                      <span className="text-[10px] text-slate-500 font-normal">M&amp;A, order wins, dividends</span>
                    </div>
                    {tgSelectedCategories.includes('corporate') && !tgSelectedCategories.includes('all') && <Check size={14} className="text-blue-600" />}
                  </button>

                  {/* Regulatory */}
                  <button
                    type="button"
                    onClick={() => handleToggleTgCategory('regulatory')}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all select-none",
                      tgSelectedCategories.includes('regulatory') && !tgSelectedCategories.includes('all')
                        ? "bg-rose-50 dark:bg-rose-950/50 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-200 font-bold"
                        : "bg-white dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div>
                      <span className="block font-bold">⚖️ SEBI &amp; Regulatory</span>
                      <span className="text-[10px] text-slate-500 font-normal">Penalties, inquiries, approvals</span>
                    </div>
                    {tgSelectedCategories.includes('regulatory') && !tgSelectedCategories.includes('all') && <Check size={14} className="text-rose-600" />}
                  </button>

                  {/* Market */}
                  <button
                    type="button"
                    onClick={() => handleToggleTgCategory('market')}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all select-none",
                      tgSelectedCategories.includes('market') && !tgSelectedCategories.includes('all')
                        ? "bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold"
                        : "bg-white dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div>
                      <span className="block font-bold">🌐 General Macro</span>
                      <span className="text-[10px] text-slate-500 font-normal">Macroeconomics, RBI rates</span>
                    </div>
                    {tgSelectedCategories.includes('market') && !tgSelectedCategories.includes('all') && <Check size={14} className="text-amber-600" />}
                  </button>
                </div>
              </div>

              {/* Publisher Sources Selection */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Select News Publishers:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard'].map((src) => {
                    const isChecked = tgSelectedSources.includes(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => handleToggleTgSource(src)}
                        className={cn(
                          "p-2 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all select-none",
                          isChecked
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                            : "bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-600 dark:text-slate-400"
                        )}
                      >
                        <span>{src}</span>
                        {isChecked && <Check size={12} className="text-emerald-400 dark:text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer Save Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
                <button
                  type="button"
                  onClick={() => setIsTgPrefModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#201E2E] cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  onClick={handleSaveTgPreferences}
                  isLoading={isSavingTgPref}
                  loadingText="Saving..."
                  variant="primary"
                  size="md"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  icon={tgSaveSuccess ? <Check size={12} className="text-emerald-300" /> : undefined}
                >
                  {tgSaveSuccess ? 'Saved!' : 'Save Preferences'}
                </ActionButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
