import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Check, 
  CheckCircle2,
  CalendarDays, 
  FileText, 
  Newspaper, 
  Bookmark, 
  ChevronRight, 
  Search, 
  X, 
  ExternalLink,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { useIntelModal } from '../context/IntelModalContext';
import { formatFilingRelativeTime, formatCleanTime, formatDateOnly } from '../utils/timeFormat';
import { cleanBseSubject } from '../utils/cleanBseSubject';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { parseMeetingDateTile } from './ResultsCalendar';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { springSnappy, containerStaggerVariants, itemFadeUpVariants, buttonTap } from '../utils/motionTokens';
import { ActionButton } from './ui/ActionButton';
import { CommonQuestionsFAQ } from './ui/CommonQuestionsFAQ';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STARTER_STOCKS = [
  { symbol: 'TATAMOTORS', scripCode: '500570', name: 'Tata Motors Ltd' },
  { symbol: 'RELIANCE', scripCode: '500325', name: 'Reliance Industries' },
  { symbol: 'INFY', scripCode: '500209', name: 'Infosys Ltd' },
  { symbol: 'HDFCBANK', scripCode: '500180', name: 'HDFC Bank Ltd' },
  { symbol: 'TCS', scripCode: '532540', name: 'Tata Consultancy Services' },
  { symbol: 'ITC', scripCode: '500875', name: 'ITC Ltd' },
  { symbol: 'LT', scripCode: '500510', name: 'Larsen & Toubro' },
  { symbol: 'BHARTIARTL', scripCode: '532454', name: 'Bharti Airtel' },
];

interface HomeForYouProps {
  onNavigate: (tabId: string) => void;
}

export function HomeForYou({ onNavigate }: HomeForYouProps) {
  const { user, profile, setIsAuthModalOpen } = useAuth();
  const { openIntelModal } = useIntelModal();

  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<Set<string>>(new Set());
  const [upcomingResults, setUpcomingResults] = useState<any[]>([]);
  const [allAnnouncements, setAllAnnouncements] = useState<any[]>([]);
  const [topNews, setTopNews] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [addingStock, setAddingStock] = useState<string | null>(null);

  // Detail sheets
  const [selectedFiling, setSelectedFiling] = useState<any | null>(null);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  // Prevent background scroll chaining when any modal or sheet is open
  useBodyScrollLock(Boolean(isAddModalOpen || selectedFiling || selectedResult));

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      const [wlRes, calRes, filRes, newsRes] = await Promise.all([
        (user || profile) ? customFetch('/api/watchlists').catch(() => null) : Promise.resolve(null),
        customFetch('/api/results-calendar?filter=upcoming&limit=8').catch(() => null),
        customFetch('/api/announcements?limit=50').catch(() => null),
        customFetch('/api/news?limit=6').catch(() => null),
      ]);

      const syms = new Set<string>();
      if (wlRes && wlRes.ok) {
        const wlData = await wlRes.json();
        const list = Array.isArray(wlData) ? wlData : [];
        setWatchlists(list);
        list.forEach((w: any) => {
          (w.items || []).forEach((it: any) => {
            const s = typeof it === 'string' ? it.trim().toUpperCase() : it?.symbol?.trim()?.toUpperCase();
            if (s) syms.add(s);
          });
        });
      }
      setWatchlistSymbols(syms);

      if (calRes && calRes.ok) {
        const calData = await calRes.json();
        const items = calData.items || [];
        // Keep meetings scheduled in the next 7 days
        const weekUpcoming = items.filter((i: any) => {
          if (i.daysLeft !== undefined) return i.daysLeft >= 0 && i.daysLeft <= 7;
          return !i.isDeclared;
        });
        setUpcomingResults(weekUpcoming.slice(0, 4));
      }

      if (filRes && filRes.ok) {
        const filData = await filRes.json();
        if (Array.isArray(filData)) {
          setAllAnnouncements(filData);
        }
      }

      if (newsRes && newsRes.ok) {
        const newsData = await newsRes.json();
        const items = Array.isArray(newsData) ? newsData : (newsData?.items || []);
        setTopNews(items.slice(0, 3));
      }
    } catch (e) {
      console.warn("Error loading Home For You data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, [user?.uid, profile?.uid]);

  const handleAddStock = async (symbol: string, scripCode?: string, name?: string) => {
    if (!user && !profile) {
      setIsAuthModalOpen(true);
      return;
    }

    const upperSym = symbol.trim().toUpperCase();
    if (!upperSym) return;

    setAddingStock(upperSym);
    try {
      let targetList = watchlists.find(w => w.is_active === 1) || watchlists[0];
      if (!targetList) {
        const createRes = await customFetch('/api/watchlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Watchlist' })
        });
        if (createRes.ok) {
          targetList = await createRes.json();
          setWatchlists([targetList]);
        }
      }

      if (targetList) {
        const addRes = await customFetch(`/api/watchlists/${targetList.id}/symbols`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: upperSym, scripCode: scripCode || '', priority: 'HIGH' })
        });
        if (addRes.ok) {
          setWatchlistSymbols(prev => new Set([...prev, upperSym]));
        }
      }
    } catch (e) {
      console.warn("Could not add stock to watchlist:", e);
    } finally {
      setAddingStock(null);
    }
  };

  const hasWatchlist = watchlistSymbols.size > 0;

  // 1. Filtered Watchlist Filings
  const watchlistFilings = useMemo(() => {
    if (!hasWatchlist) return [];
    return allAnnouncements.filter(a => {
      const sym = (a.companyName || '').toUpperCase();
      const scrip = String(a.scrip_cd || '').toUpperCase();
      for (const s of watchlistSymbols) {
        if (sym.includes(s) || scrip === s) return true;
      }
      return false;
    }).slice(0, 4);
  }, [allAnnouncements, watchlistSymbols, hasWatchlist]);

  // Starter stocks filtered by search query in modal
  const filteredStarterStocks = useMemo(() => {
    if (!modalSearch.trim()) return STARTER_STOCKS;
    const q = modalSearch.trim().toLowerCase();
    return STARTER_STOCKS.filter(s => 
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.scripCode.includes(q)
    );
  }, [modalSearch]);

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-6">
      
      {/* 1. Top Header: Calm Page Title & ONLY Primary Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-[#262335]">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-display">
            For You
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal">
            Personalized watchlist filings and upcoming catalysts
          </p>
        </div>

        {/* The ONLY Primary Button on For You home */}
        <motion.button
          type="button"
          whileTap={buttonTap}
          transition={springSnappy}
          onClick={() => setIsAddModalOpen(true)}
          className="min-h-[44px] sm:min-h-[38px] px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 select-none"
        >
          <Plus size={15} />
          <span>Add companies to your watchlist</span>
        </motion.button>
      </div>

      {/* 2. Focused Sections or Calm Summary */}
      <div className="space-y-6">

        {/* Watchlist Section */}
        {!hasWatchlist ? (
          /* Empty Watchlist State with Actionable Starter Recommendations */
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
              New watchlist filings
            </h2>
            <div className="p-5 rounded-2xl bg-white dark:bg-[#181624] border border-slate-200 dark:border-[#262335] text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#201E2E] flex items-center justify-center mx-auto text-slate-400">
                <Bookmark size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No watchlist filings yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Add companies to your watchlist to see their real-time BSE regulatory filings, financial results, and board outcomes here.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs font-bold text-slate-900 dark:text-white underline underline-offset-4 hover:opacity-80 cursor-pointer"
                >
                  Choose companies to track &rarr;
                </button>
              </div>
            </div>
          </section>
        ) : watchlistFilings.length > 0 ? (
          /* Populated & Active Watchlist */
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                New watchlist filings
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('watchlists')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>View all</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {watchlistFilings.map((filing, idx) => {
                const cleanSubj = cleanBseSubject(filing.subject || filing.details || '');
                const relTime = formatFilingRelativeTime(filing.bseTimestamp || filing.fetched_at || Date.now());

                return (
                  <div
                    key={filing.id || idx}
                    onClick={() => setSelectedFiling(filing)}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#181624] border border-slate-200 dark:border-[#262335] hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {filing.companyName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono shrink-0">
                          {relTime}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {cleanSubj.headline}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-[#262335]">
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        BSE: {filing.scrip_cd}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                        <span>Details</span>
                        <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          /* Populated but Quiet Watchlist: Single calm summary */
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#181624] border border-slate-200/90 dark:border-[#262335] space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} className="shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                Nothing urgent from your watchlist today
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
              We are monitoring BSE regulatory disclosures in real time for your {watchlistSymbols.size} tracked {watchlistSymbols.size === 1 ? 'company' : 'companies'}. No unexpected announcements or board notifications have been filed today.
            </p>
          </div>
        )}

        {/* SECTION 2: Results this week / Upcoming earnings date */}
        {upcomingResults.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                Results this week
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('results-calendar')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>Earnings calendar</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {upcomingResults.map((item, idx) => {
                const tile = parseMeetingDateTile(item.meetingDate);
                const isToday = item.daysLeft === 0;
                const daysLabel = isToday ? 'Today' : item.daysLeft === 1 ? 'Tomorrow' : `In ${item.daysLeft} days`;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => setSelectedResult(item)}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#181624] border border-slate-200 dark:border-[#262335] hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Date block */}
                      <div className={cn(
                        "w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 border",
                        isToday
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
                          : "bg-slate-100 dark:bg-[#201E2E] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-[#2D283E]"
                      )}>
                        <span className="text-xs font-black leading-none">{tile.day}</span>
                        <span className="text-[9px] font-bold uppercase opacity-80 mt-0.5">{tile.month}</span>
                      </div>

                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.companyName}
                          </span>
                          {item.symbol && (
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {item.symbol}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.purpose || 'Financial Results'}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {daysLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 3: Market news & useful market stories */}
        {topNews.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                Market stories
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('news')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>All stories</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="space-y-2.5">
              {topNews.map((news, idx) => (
                <div
                  key={news.id || idx}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#181624] border border-slate-200 dark:border-[#262335] hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                      {news.title}
                    </h3>
                    {news.snippet && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {news.snippet}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                    <span>{news.source || 'News'}</span>
                    {news.link && (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-0.5"
                      >
                        <span>Read</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Common questions FAQ Section */}
        <section className="pt-2">
          <CommonQuestionsFAQ id="home-for-you-faq" compact />
        </section>

      </div>

      {/* Add Companies Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={springSnappy}
              className="relative w-full max-w-md bg-white dark:bg-[#181624] rounded-2xl border border-slate-200 dark:border-[#262335] shadow-2xl p-5 space-y-4 z-10 overscroll-contain"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#262335] pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    Add company to watchlist
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track earnings dates, filings, and news
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder="Search symbol (e.g. RELIANCE, INFY)..."
                  className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900 dark:text-white"
                />
              </div>

              {/* Quick Starter Picks */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Popular Indian Companies
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {filteredStarterStocks.map(stk => {
                    const isTracked = watchlistSymbols.has(stk.symbol.toUpperCase());
                    const isBusy = addingStock === stk.symbol;

                    return (
                      <div
                        key={stk.symbol}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#201E2E] border border-slate-200/80 dark:border-[#2D283E] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {stk.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {stk.symbol} &bull; BSE {stk.scripCode}
                          </div>
                        </div>

                        <ActionButton
                          onClick={() => handleAddStock(stk.symbol, stk.scripCode, stk.name)}
                          isLoading={isBusy}
                          loadingText="Adding..."
                          disabled={isTracked}
                          variant={isTracked ? "secondary" : "primary"}
                          size="sm"
                          className={cn(
                            "min-h-[36px] shrink-0 text-xs font-bold",
                            isTracked && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                          )}
                          icon={isTracked ? <Check size={13} className="text-emerald-600" /> : <Plus size={13} />}
                        >
                          {isTracked ? 'Added' : 'Add'}
                        </ActionButton>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom footer button to full watchlist */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#262335] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    onNavigate('watchlists');
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer flex items-center gap-1"
                >
                  <span>Manage full watchlist</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[36px] px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filing Detail Bottom Sheet */}
      <AnimatePresence>
        {selectedFiling && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFiling(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={springSnappy}
              className="relative w-full sm:max-w-lg bg-white dark:bg-[#181624] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-[#262335] shadow-2xl p-5 max-h-[85vh] overflow-y-auto overscroll-contain space-y-4 z-10 safe-area-bottom"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-[#262335] pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    {selectedFiling.companyName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    BSE Scrip {selectedFiling.scrip_cd} &bull; {formatFilingRelativeTime(selectedFiling.bseTimestamp || selectedFiling.fetched_at || Date.now())}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFiling(null)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Subject
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-[#201E2E] p-3 rounded-xl border border-slate-200/80 dark:border-[#2D283E]">
                  {cleanBseSubject(selectedFiling.subject || selectedFiling.details || '').headline || selectedFiling.subject || selectedFiling.details || 'No subject details provided'}
                </p>
              </div>

              {/* Action */}
              <div className="pt-2 flex items-center gap-2">
                {selectedFiling.attachment || selectedFiling.pdf_link ? (
                  <a
                    href={getSafePdfUrl(selectedFiling.attachment || selectedFiling.pdf_link)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>Open Official BSE Document (PDF)</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedFiling(null)}
                    className="w-full min-h-[44px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
                  >
                    Close
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Result Detail Bottom Sheet */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResult(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs overscroll-contain"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={springSnappy}
              className="relative w-full sm:max-w-lg bg-white dark:bg-[#181624] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-[#262335] shadow-2xl p-5 max-h-[85vh] overflow-y-auto overscroll-contain space-y-4 z-10 safe-area-bottom"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-[#262335] pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    {selectedResult.companyName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Scheduled Board Meeting: {selectedResult.meetingDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedResult(null)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Meeting Purpose
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-[#201E2E] p-3 rounded-xl border border-slate-200/80 dark:border-[#2D283E]">
                  {selectedResult.purpose || 'Financial Results & Corporate Review'}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedResult(null);
                    onNavigate('results-calendar');
                  }}
                  className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CalendarDays size={14} />
                  <span>View in Earnings Calendar</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
