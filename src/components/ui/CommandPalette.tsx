import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Flame, List, CalendarDays, Newspaper, Settings, 
  Moon, Sun, Zap, Sparkles, Building2, TrendingUp, ExternalLink, 
  ChevronRight, Command, CornerDownLeft
} from 'lucide-react';
import { springSnappy } from '../../utils/motionTokens';
import { useIntelModal } from '../../context/IntelModalContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
  isRunning?: boolean;
  onToggleEngine?: () => void;
  isAdmin?: boolean;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Top Stocks' | 'Topics';
  icon: any;
  action: () => void;
  badge?: string;
  keywords?: string[];
}

const TOP_BSE_STOCKS = [
  { name: 'Reliance Industries Ltd', symbol: 'RELIANCE', scrip: '500325', sector: 'Oil & Telecom' },
  { name: 'Tata Consultancy Services', symbol: 'TCS', scrip: '532540', sector: 'IT Services' },
  { name: 'HDFC Bank Ltd', symbol: 'HDFCBANK', scrip: '500180', sector: 'Banking' },
  { name: 'ICICI Bank Ltd', symbol: 'ICICIBANK', scrip: '532174', sector: 'Banking' },
  { name: 'Infosys Ltd', symbol: 'INFY', scrip: '500209', sector: 'IT Services' },
  { name: 'Bharti Airtel Ltd', symbol: 'BHARTIARTL', scrip: '532454', sector: 'Telecom' },
  { name: 'State Bank of India', symbol: 'SBIN', scrip: '500112', sector: 'PSU Banking' },
  { name: 'ITC Ltd', symbol: 'ITC', scrip: '500875', sector: 'FMCG' },
  { name: 'Hindustan Unilever Ltd', symbol: 'HINDUNILVR', scrip: '500696', sector: 'FMCG' },
  { name: 'Larsen & Toubro Ltd', symbol: 'LT', scrip: '500510', sector: 'Infrastructure' },
  { name: 'Tata Motors Ltd', symbol: 'TATAMOTORS', scrip: '500570', sector: 'Automobile' },
  { name: 'Bajaj Finance Ltd', symbol: 'BAJFINANCE', scrip: '500034', sector: 'NBFC' },
  { name: 'Sun Pharmaceutical', symbol: 'SUNPHARMA', scrip: '524715', sector: 'Pharma' },
  { name: 'Maruti Suzuki India', symbol: 'MARUTI', scrip: '532500', sector: 'Automobile' },
  { name: 'Adani Enterprises Ltd', symbol: 'ADANIENT', scrip: '512599', sector: 'Conglomerate' },
];

export function CommandPalette({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  theme,
  setTheme,
  isRunning = true,
  onToggleEngine,
  isAdmin = false,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { openIntelModal } = useIntelModal();

  useBodyScrollLock(isOpen);

  // Focus input automatically when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcut listener (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open
          setQuery('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const items: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [
      // Navigation
      {
        id: 'nav_filings',
        title: 'BSE Filings Live Feed',
        subtitle: 'Real-time corporate disclosures, board results, SEBI LODR filings',
        category: 'Navigation',
        icon: Flame,
        action: () => { onTabChange('dashboard'); onClose(); },
        badge: 'Live',
        keywords: ['announcements', 'filings', 'feed', 'disclosures', 'bse']
      },
      {
        id: 'nav_watchlist',
        title: 'My Stock Watchlist',
        subtitle: 'Filtered corporate notifications for your portfolio',
        category: 'Navigation',
        icon: List,
        action: () => { onTabChange('watchlists'); onClose(); },
        keywords: ['watchlist', 'portfolio', 'stocks', 'alerts']
      },
      {
        id: 'nav_calendar',
        title: 'Earnings & Board Results Calendar',
        subtitle: 'Upcoming quarterly results dates, board meetings',
        category: 'Navigation',
        icon: CalendarDays,
        action: () => { onTabChange('results-calendar'); onClose(); },
        keywords: ['earnings', 'results', 'calendar', 'q1', 'q2', 'q3', 'q4', 'board meeting']
      },
      {
        id: 'nav_news',
        title: 'Indian Market News',
        subtitle: 'Live curated financial & business news feeds',
        category: 'Navigation',
        icon: Newspaper,
        action: () => { onTabChange('news'); onClose(); },
        keywords: ['news', 'market', 'headlines', 'economy', 'rbi']
      },
      ...(isAdmin ? [{
        id: 'nav_seo',
        title: 'Super SEO Suite (11 Skills)',
        subtitle: 'Page audits, 70-point scorecards, EEAT, snippets & anti-slop writer',
        category: 'Navigation' as const,
        icon: Sparkles,
        action: () => { onTabChange('seo-suite'); onClose(); },
        badge: '11 Skills',
        keywords: ['seo', 'page audit', 'audit', 'eeat', 'semantic gap', 'keyword', 'content brief', 'cluster', 'snippets', 'linkbuilding']
      }] : []),
      {
        id: 'nav_settings',
        title: 'Terminal Settings & Preferences',
        subtitle: 'Audio alerts, Telegram bot token, chat ID, theme',
        category: 'Navigation',
        icon: Settings,
        action: () => { onTabChange('settings'); onClose(); },
        keywords: ['settings', 'telegram', 'bot', 'audio', 'sound', 'preferences']
      },

      // Actions
      {
        id: 'act_theme',
        title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: `Currently in ${theme} mode`,
        category: 'Actions',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); },
        keywords: ['theme', 'dark', 'light', 'mode', 'color', 'night']
      },
      {
        id: 'act_engine',
        title: isRunning ? 'Pause BSE Indexing Poller' : 'Resume BSE Indexing Poller',
        subtitle: isRunning ? 'Engine is actively polling BSE disclosures' : 'Poller is currently paused',
        category: 'Actions',
        icon: Zap,
        action: () => { onToggleEngine?.(); onClose(); },
        badge: isRunning ? 'Active' : 'Paused',
        keywords: ['engine', 'poller', 'stream', 'pause', 'resume', 'toggle', 'bse']
      },

      // Stocks
      ...TOP_BSE_STOCKS.map((stock) => ({
        id: `stock_${stock.symbol}`,
        title: `${stock.name} (${stock.symbol})`,
        subtitle: `BSE Code: ${stock.scrip} • ${stock.sector}`,
        category: 'Top Stocks' as const,
        icon: Building2,
        action: () => {
          openIntelModal({
            scripCode: stock.scrip,
            symbol: stock.symbol,
            companyName: stock.name,
          });
          onClose();
        },
        badge: stock.scrip,
        keywords: [stock.name, stock.symbol, stock.scrip, stock.sector, 'stock', 'intelligence']
      })),

      // Topics / Common Filings Search
      {
        id: 'topic_results',
        title: 'Financial Results Disclosures',
        subtitle: 'Filtered for unaudited / audited quarterly results',
        category: 'Topics',
        icon: Sparkles,
        action: () => {
          onTabChange('dashboard');
          window.dispatchEvent(new CustomEvent('bse-filter-topic', { detail: { topic: 'Financial Result' } }));
          onClose();
        },
        keywords: ['financial', 'results', 'profit', 'revenue', 'q1', 'q2', 'q3', 'q4']
      },
      {
        id: 'topic_dividends',
        title: 'Dividends & Bonus Announcements',
        subtitle: 'Filter for interim/final dividends and record dates',
        category: 'Topics',
        icon: TrendingUp,
        action: () => {
          onTabChange('dashboard');
          window.dispatchEvent(new CustomEvent('bse-filter-topic', { detail: { topic: 'Dividend' } }));
          onClose();
        },
        keywords: ['dividend', 'bonus', 'split', 'corporate action', 'payout']
      },
    ];

    return list;
  }, [theme, isRunning, onTabChange, setTheme, onToggleEngine, openIntelModal, onClose]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.subtitle?.toLowerCase().includes(q)) return true;
      if (item.badge?.toLowerCase().includes(q)) return true;
      if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [items, query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-20 overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      {/* Frosted Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />

      {/* Palette Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={springSnappy}
        className="relative w-full max-w-xl bg-white/95 dark:bg-[#181624]/95 backdrop-blur-2xl rounded-2xl border border-slate-200/90 dark:border-[#2D283E] shadow-2xl overflow-hidden z-10 flex flex-col max-h-[82vh]"
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-[#2D283E]">
          <Search className="w-5 h-5 text-emerald-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a company, symbol, or command (e.g. Reliance, dark mode)..."
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-md"
            >
              <X size={16} />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-[#252233] px-2 py-0.5 rounded border border-slate-200 dark:border-[#352F48]">
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div 
          ref={listRef} 
          className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar max-h-[55vh]"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Building2 className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                No matching results found
              </div>
              <p className="text-xs max-w-xs mx-auto text-slate-400">
                Try searching by stock name, BSE Scrip code (e.g., 500325), or keyword like "results"
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30'
                      : 'hover:bg-slate-100/70 dark:hover:bg-[#222030] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-300'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm font-bold truncate ${
                          isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                        }`}>
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-[#2F2B40] text-slate-700 dark:text-slate-300 leading-none">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider hidden sm:inline">
                      {item.category}
                    </span>
                    {isSelected && (
                      <CornerDownLeft size={13} className="text-emerald-500" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-[#2D283E] bg-slate-50/50 dark:bg-[#14121E]/50 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#252233] text-slate-700 dark:text-slate-300 font-mono text-[9px]">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#252233] text-slate-700 dark:text-slate-300 font-mono text-[9px]">↵</kbd> Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#252233] text-slate-700 dark:text-slate-300 font-mono text-[9px]">Esc</kbd> Dismiss
            </span>
          </div>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            BSE Nexus Command
          </span>
        </div>
      </motion.div>
    </div>
  );
}
