import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CalendarDays, Sparkles, Bell, Star, ChevronRight,
  TrendingUp, Clock, CheckCircle2, ArrowUpRight,
} from 'lucide-react';

/**
 * FeatureTabs — selectable feature tabs (Finexa "Built for Individuals and
 * Businesses" pattern). Left: tab list; right: animated visual per tab.
 * Auto-advances, pauses on hover. All mockups carry sample labeling.
 */

interface FeatureTabsProps {
  onEnterTerminal: (tab?: string) => void;
}

const serifAccent = "font-[Georgia,'Times_New_Roman',serif] italic font-normal";

type TabId = 'filings' | 'results' | 'ai' | 'telegram' | 'watchlists';

const TABS: Array<{ id: TabId; icon: any; title: string; desc: string; cta: string; terminalTab: string }> = [
  { id: 'filings', icon: FileText, title: 'Live Filings Feed', desc: 'Every BSE announcement the second it drops — filtered by your watchlist.', cta: 'Open live feed', terminalTab: 'dashboard' },
  { id: 'results', icon: CalendarDays, title: 'Results Calendar', desc: 'Earnings dates, board meetings and dividend agendas — never miss one.', cta: 'View calendar', terminalTab: 'results-calendar' },
  { id: 'ai', icon: Sparkles, title: 'AI Summaries', desc: 'Long PDFs condensed into YoY trends, risks and key numbers.', cta: 'Try AI digest', terminalTab: 'dashboard' },
  { id: 'telegram', icon: Bell, title: 'Telegram Alerts', desc: 'Instant filing pings on your phone, tuned to your stocks.', cta: 'Set up alerts', terminalTab: 'alerts' },
  { id: 'watchlists', icon: Star, title: 'Watchlists', desc: 'Track the companies you care about — one clean updates feed.', cta: 'Build watchlist', terminalTab: 'watchlist' },
];

/* ---------------- visuals ---------------- */

function MacBrowser({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#101B2E] border border-sky-200/70 dark:border-white/10 shadow-[0_30px_60px_-20px_rgba(2,32,71,0.35)]">
      <div className="flex items-center gap-2 px-4 py-3 bg-sky-50 dark:bg-white/[0.04] border-b border-sky-100 dark:border-white/10">
        <span className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-400" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-emerald-400" />
        </span>
        <span className="ml-3 flex-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-white/[0.06] rounded-full px-3 py-1 truncate">
          bsenexus.in — sample UI preview
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FilingsVisual() {
  const rows = [
    { s: 'RELIANCE', t: 'BOARD MEETING', c: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', h: 'Board to consider Q1 results & dividend (sample)', time: '2m' },
    { s: 'INFY', t: 'RESULTS', c: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', h: 'Q1 revenue +7.8% YoY, PAT +9.4% YoY (sample)', time: '18m' },
    { s: 'HDFCBANK', t: 'REG 30', c: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', h: 'Bond issuance disclosure under Reg 30 (sample)', time: '42m' },
    { s: 'TCS', t: 'DIVIDEND', c: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', h: 'Interim dividend record date announced (sample)', time: '1h' },
  ];
  return (
    <MacBrowser>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-black text-slate-900 dark:text-white">Live feed</div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> streaming
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <motion.div
            key={r.s}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.45 }}
            className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/10 p-2.5"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-black text-white font-mono">{r.s.slice(0, 2)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black font-mono text-slate-900 dark:text-white">{r.s}</span>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${r.c}`}>{r.t}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{r.h}</div>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold shrink-0">{r.time}</span>
          </motion.div>
        ))}
      </div>
    </MacBrowser>
  );
}

function ResultsVisual() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const events: Record<number, string> = { 3: 'bg-sky-500', 9: 'bg-lime-400', 14: 'bg-sky-500', 21: 'bg-amber-400', 27: 'bg-lime-400' };
  return (
    <MacBrowser>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-black text-slate-900 dark:text-white">October 2026 <span className="text-[9px] font-bold text-slate-400">(sample)</span></div>
        <CalendarDays className="w-4 h-4 text-sky-500" />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((d, i) => (
          <div key={i} className="text-[9px] font-black text-slate-400 pb-1">{d}</div>
        ))}
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <div
            key={d}
            className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold ${
              events[d]
                ? 'bg-sky-50 dark:bg-white/[0.07] text-slate-900 dark:text-white border border-sky-200 dark:border-white/15'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span className="relative">
              {d}
              {events[d] && <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${events[d]}`} />}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
        <Clock className="w-3 h-3" /> 5 board meetings &amp; results this month (sample)
      </div>
    </MacBrowser>
  );
}

function AiVisual() {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#101B2E] border border-sky-200/70 dark:border-white/10 shadow-[0_30px_60px_-20px_rgba(2,32,71,0.35)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="text-xs font-black text-slate-900 dark:text-white">AI Digest <span className="text-[9px] font-bold text-slate-400">(sample)</span></div>
      </div>
      <div className="space-y-2">
        {[
          'Revenue grew on strong domestic volumes…',
          'Margins expanded 140 bps on cost control…',
          'Watch: rising receivables vs cash flow…',
        ].map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12 }}
            className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-300"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>{t}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {['Rev +12.4% YoY', 'PAT +24.8% YoY', 'EBITDA 18.2%'].map((m) => (
          <span key={m} className="text-[10px] font-black px-2.5 py-1 rounded-full bg-lime-300/60 dark:bg-lime-300/20 text-slate-800 dark:text-lime-200">{m}</span>
        ))}
      </div>
    </div>
  );
}

function TelegramVisual() {
  const notes = [
    { s: 'INFY', h: 'Q1 results filed — AI digest ready (sample)', t: 'now' },
    { s: 'RELIANCE', h: 'Board meeting intimation (sample)', t: '12m' },
  ];
  return (
    <div className="rounded-2xl bg-gradient-to-b from-sky-500 to-blue-700 p-5 shadow-[0_30px_60px_-20px_rgba(2,32,71,0.45)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
          <Bell className="w-4 h-4 text-white" />
        </div>
        <div className="text-xs font-black text-white">Telegram alerts <span className="text-[9px] font-bold text-sky-200">(sample)</span></div>
      </div>
      <div className="space-y-2.5">
        {notes.map((n, i) => (
          <motion.div
            key={n.s}
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.18, type: 'spring', stiffness: 260, damping: 20 }}
            className="rounded-2xl bg-white/95 backdrop-blur p-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-slate-900">{n.s}</span>
              <span className="text-[9px] text-slate-400 font-semibold">{n.t}</span>
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">{n.h}</div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 text-center text-[10px] font-bold text-sky-100">Instant pings • zero noise • your stocks only</div>
    </div>
  );
}

function WatchlistVisual() {
  const stocks = [
    { s: 'RELIANCE', n: '3 new filings', c: 'bg-sky-500' },
    { s: 'INFY', n: '1 new filing', c: 'bg-emerald-500' },
    { s: 'HDFCBANK', n: '2 new filings', c: 'bg-amber-500' },
  ];
  return (
    <div className="rounded-2xl bg-white dark:bg-[#101B2E] border border-sky-200/70 dark:border-white/10 shadow-[0_30px_60px_-20px_rgba(2,32,71,0.35)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-lime-300 flex items-center justify-center">
          <Star className="w-4 h-4 text-slate-900 fill-slate-900" />
        </div>
        <div className="text-xs font-black text-slate-900 dark:text-white">My watchlist <span className="text-[9px] font-bold text-slate-400">(sample)</span></div>
      </div>
      <div className="space-y-2">
        {stocks.map((s, i) => (
          <motion.div
            key={s.s}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/10 p-3"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${s.c} shrink-0`} />
            <span className="text-[11px] font-black font-mono text-slate-900 dark:text-white flex-1">{s.s}</span>
            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{s.n}</span>
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          </motion.div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-lime-300/40 dark:bg-lime-300/10 border border-lime-300/60 p-3 text-[10px] font-bold text-slate-700 dark:text-lime-200 text-center">
        One updates feed for everything you track
      </div>
    </div>
  );
}

const VISUALS: Record<TabId, React.ReactNode> = {
  filings: <FilingsVisual />,
  results: <ResultsVisual />,
  ai: <AiVisual />,
  telegram: <TelegramVisual />,
  watchlists: <WatchlistVisual />,
};

/* ---------------- section ---------------- */

export function FeatureTabs({ onEnterTerminal }: FeatureTabsProps) {
  const [active, setActive] = useState<TabId>('filings');
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => {
      setActive((cur) => {
        const idx = TABS.findIndex((t) => t.id === cur);
        return TABS[(idx + 1) % TABS.length].id;
      });
    }, 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [paused]);

  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <section className="py-16 sm:py-24 bg-[#FAF6EE] dark:bg-[#0A0F1C] border-b border-slate-200/80 dark:border-white/10 relative overflow-hidden">
      {/* soft blobs */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-sky-200/50 dark:bg-sky-500/10 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-lime-200/50 dark:bg-lime-400/10 blur-3xl pointer-events-none" aria-hidden />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <div className="text-[11px] font-black tracking-[0.2em] text-sky-600 dark:text-sky-400 uppercase">/ Explore /</div>
          <h2 className="mt-3 text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            One hub, <span className={`${serifAccent} text-sky-600 dark:text-sky-400`}>every</span> workflow.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Pick a workflow — the preview switches instantly. This is the actual product, not a slideshow.
          </p>
        </div>

        <div
          className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* tab list */}
          <div className="lg:col-span-5 space-y-2" role="tablist" aria-label="Product workflows">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(t.id)}
                  className={`w-full text-left rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer border relative ${
                    isActive
                      ? 'bg-white dark:bg-white/[0.07] border-sky-200 dark:border-sky-400/30 shadow-[0_16px_36px_-16px_rgba(2,32,71,0.35)] scale-[1.01]'
                      : 'bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' : 'bg-sky-100 dark:bg-white/10 text-sky-600 dark:text-sky-300'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-black ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {t.title}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{t.desc}</span>
                  </span>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-all ${isActive ? 'text-sky-500 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'}`} />
                  {isActive && !paused && (
                    <motion.span
                      key={active}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 6, ease: 'linear' }}
                      className="absolute bottom-2 left-4 right-4 h-0.5 rounded-full bg-lime-400 origin-left"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* visual panel */}
          <div className="lg:col-span-7">
            <div className="relative min-h-[420px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 26, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.98 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  {VISUALS[active]}
                </motion.div>
              </AnimatePresence>
            </div>
            <button
              onClick={() => onEnterTerminal(activeTab.terminalTab)}
              className="mt-5 inline-flex items-center gap-2 text-sm font-black text-sky-700 dark:text-sky-300 hover:gap-3 transition-all cursor-pointer group"
            >
              {activeTab.cta}
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
