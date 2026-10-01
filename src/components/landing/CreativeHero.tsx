import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, Sparkles, Bell, Home, Newspaper, Star, User,
  Signal, Wifi, BatteryFull, Check,
} from 'lucide-react';
import { BseNexusLogo } from '../ui/BseNexusLogo';
import { CompanyLogo, type CompanySymbol } from './CompanyLogos';
import { ActionButton } from './ActionButton';

interface CreativeHeroProps {
  onEnterTerminal: (tab?: string) => void;
}

// Sample filings for the phone mockup — clearly labeled SAMPLE, never real data.
const PHONE_FILINGS: Array<{ symbol: CompanySymbol; tag: string; tagClass: string; headline: string; time: string }> = [
  { symbol: 'RELIANCE', tag: 'BOARD MEETING', tagClass: 'bg-blue-500/15 text-blue-700', headline: 'Board to consider quarterly results & dividend', time: '2m' },
  { symbol: 'INFY', tag: 'RESULTS', tagClass: 'bg-emerald-500/15 text-emerald-700', headline: 'Q1 results: revenue +7.8% YoY', time: '18m' },
  { symbol: 'HDFCBANK', tag: 'REG 30', tagClass: 'bg-amber-500/15 text-amber-700', headline: 'Bond issuance disclosure', time: '42m' },
];

const WATCHLIST_ROWS = [
  { label: 'RELIANCE filings', count: '12 new', width: '82%' },
  { label: 'INFY filings', count: '8 new', width: '54%' },
  { label: 'HDFCBANK filings', count: '5 new', width: '36%' },
];

const TG_ROWS: Array<{ symbol: CompanySymbol; name: string; sub: string; time: string; fresh: boolean }> = [
  { symbol: 'INFY', name: 'INFY', sub: 'Q1 results filed', time: 'now', fresh: true },
  { symbol: 'RELIANCE', name: 'RELIANCE', sub: 'Board meeting', time: '12m', fresh: false },
];

const GRAIN_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

function WatchlistCard() {
  return (
    <div className="w-[224px] rounded-[20px] bg-white/95 border border-white/70 shadow-[0_30px_60px_-18px_rgba(2,32,71,0.45)] p-4 text-left">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-extrabold text-slate-900">My Watchlist</span>
        <span className="text-[10px] font-bold text-sky-600">See all ›</span>
      </div>
      <span className="inline-block text-[8px] font-extrabold tracking-[1.5px] text-slate-400 uppercase mb-2">Sample</span>
      {WATCHLIST_ROWS.map((r, i) => (
        <div key={r.label} className="mb-2.5 last:mb-0">
          <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
            <span>{r.label}</span><span className="text-sky-600">{r.count}</span>
          </div>
          <div className="h-[7px] rounded-full bg-slate-200/80 overflow-hidden">
            <motion.i
              className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600"
              initial={{ width: 0 }}
              animate={{ width: r.width }}
              transition={{ delay: 0.9 + i * 0.2, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TelegramCard() {
  return (
    <div className="w-[224px] rounded-[20px] bg-white/95 border border-white/70 shadow-[0_30px_60px_-18px_rgba(2,32,71,0.45)] p-4 text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-extrabold text-slate-900">Telegram Alert</span>
        <Bell className="w-3.5 h-3.5 text-slate-500" />
      </div>
      {TG_ROWS.map((r) => (
        <div key={r.name} className="flex items-center gap-2.5 py-2 border-t border-slate-100 first:border-t-0">
          <CompanyLogo symbol={r.symbol} size={30} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-900">{r.name}</div>
            <div className="text-[9px] text-slate-400">{r.sub}</div>
          </div>
          <span className={`ml-auto text-[10px] font-extrabold font-mono ${r.fresh ? 'text-emerald-600' : 'text-slate-400'}`}>{r.time}</span>
        </div>
      ))}
      <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
        <Check className="w-3 h-3" /> Sample alert delivered
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="w-[300px] rounded-[54px] bg-[#101828] p-3 relative shadow-[0_60px_100px_-30px_rgba(2,32,71,0.55),0_0_0_2px_#3b4a63,inset_0_0_0_2px_#000]">
      <div className="rounded-[44px] overflow-hidden h-[648px] relative bg-gradient-to-b from-sky-100 via-sky-50 to-white">
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-[6]" />
        <div className="flex justify-between px-[30px] pt-4 text-xs font-bold text-slate-900 relative z-[5]">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <Signal className="w-3.5 h-3.5" /><Wifi className="w-3.5 h-3.5" /><BatteryFull className="w-4 h-4" />
          </span>
        </div>

        <div className="flex items-center justify-between px-[18px] pt-3 relative z-[5]">
          <div className="flex items-center gap-2.5">
            <BseNexusLogo className="w-[34px] h-[34px]" />
            <div>
              <div className="text-[13px] font-extrabold text-slate-900">Bsenexus</div>
              <div className="text-[9px] text-emerald-600 font-bold">● Live</div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
            <Bell className="w-4 h-4 text-slate-600" />
          </div>
        </div>

        <div className="text-center text-[8px] font-extrabold tracking-[2.5px] text-slate-400 uppercase mt-2 relative z-[5]">
          Sample UI preview
        </div>
        <div className="text-center mt-2.5 relative z-[5]">
          <div className="text-[10px] text-slate-500 font-semibold">Filings decoded today (sample)</div>
          <div className="font-serif text-[34px] font-bold text-slate-900 tracking-tight">2,847</div>
        </div>
        <div className="flex gap-2 justify-center mt-2.5 relative z-[5]" aria-hidden="true">
          <span className="text-[10px] font-bold px-4 py-2 rounded-full bg-slate-900 text-white">+ Watchlist</span>
          <span className="text-[10px] font-bold px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-900">AI Digest</span>
        </div>

        {PHONE_FILINGS.map((f, i) => (
          <motion.div
            key={f.symbol}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.9 + i * 0.18, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-[14px] mt-2.5 rounded-[18px] bg-white border border-slate-100 shadow-[0_14px_30px_-12px_rgba(2,32,71,0.3)] p-3 relative z-[5] flex gap-2.5"
          >
            <CompanyLogo symbol={f.symbol} size={34} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-1.5">
                <span className="text-[11px] font-extrabold font-mono text-slate-900">{f.symbol}</span>
                <span className={`text-[8px] font-extrabold px-2 py-[3px] rounded-full whitespace-nowrap ${f.tagClass}`}>{f.tag}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 leading-snug">{f.headline} <span className="text-slate-400">(sample)</span></div>
              <div className="flex justify-between mt-1.5 text-[8px] text-slate-400 font-semibold">
                <span>{f.time} ago</span><span className="text-sky-600 font-bold">AI summary →</span>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="absolute bottom-0 left-0 right-0 z-[5] px-[30px] pt-3.5 pb-[22px] bg-gradient-to-t from-white via-white/95 to-transparent">
          <div className="flex justify-between px-2.5">
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-[#d4f565] text-[#1a2e05] shadow-[0_8px_18px_-6px_rgba(212,245,101,0.9)]"><Home className="w-4 h-4" /></span>
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-slate-400"><Newspaper className="w-4 h-4" /></span>
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-slate-400"><Star className="w-4 h-4" /></span>
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-slate-400"><User className="w-4 h-4" /></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CreativeHero — approved v3 creative hero.
 * Sky gradient + drifting clouds, serif-italic headline, lime CTAs,
 * iPhone mockup with the real Bsenexus mark + premium company logo tiles,
 * floating watchlist / Telegram cards with mouse parallax. On mobile the
 * side cards stack under the phone instead of hiding.
 */
export function CreativeHero({ onEnterTerminal }: CreativeHeroProps) {
  const heroRef = useRef<HTMLElement>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.querySelectorAll<HTMLElement>('[data-depth]').forEach((l) => {
      const d = parseFloat(l.dataset.depth || '0');
      l.style.translate = `${-x * d}px ${-y * d}px`;
    });
  };
  const onMouseLeave = () => {
    heroRef.current?.querySelectorAll<HTMLElement>('[data-depth]').forEach((l) => { l.style.translate = '0px 0px'; });
  };

  return (
    <>
      <section
        ref={heroRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="relative overflow-hidden rounded-b-[36px]"
        style={{
          background:
            'radial-gradient(ellipse 55% 40% at 76% 14%, rgba(255,247,205,.95), rgba(255,247,205,0) 68%),' +
            'radial-gradient(ellipse 40% 30% at 12% 26%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%),' +
            'radial-gradient(ellipse 50% 32% at 55% 55%, rgba(255,255,255,.28), rgba(255,255,255,0) 70%),' +
            'linear-gradient(to bottom, #2b8ad4 0%, #45a0e0 30%, #77c0ec 58%, #b5dff6 82%, #d8eefb 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: GRAIN_BG }} />
        {[
          { left: '4%', top: '10%', w: 340, h: 110, d: 0 },
          { left: '62%', top: '6%', w: 420, h: 130, d: 5 },
          { left: '28%', top: '30%', w: 260, h: 90, d: 11 },
          { left: '84%', top: '38%', w: 220, h: 80, d: 3 },
          { left: '44%', top: '14%', w: 200, h: 70, d: 8 },
        ].map((c, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: c.left, top: c.top, width: c.w, height: c.h,
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,.95), rgba(255,255,255,0) 72%)',
              filter: 'blur(14px)',
            }}
            animate={{ x: [0, 46, 0], y: [0, -10, 0] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: c.d }}
          />
        ))}
        <div
          className="absolute bottom-[-4px] left-0 right-0 h-[90px] pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(101,163,13,0), rgba(77,124,15,.55) 70%, rgba(63,98,18,.75))', filter: 'blur(1px)' }}
        />

        <div className="relative z-[5] text-center px-5 pt-[52px]">
          <motion.span
            initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 bg-white/95 rounded-full px-[18px] py-2 text-xs font-bold text-[#1e3a5f] shadow-[0_10px_26px_rgba(2,32,71,0.25)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Live BSE Intelligence Platform
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif mx-auto mt-6 max-w-[840px] font-semibold text-white leading-[1.08] tracking-[-1.5px] text-[clamp(40px,7.2vw,82px)] [text-shadow:0_3px_26px_rgba(2,32,71,0.35)]"
          >
            Every BSE filing,<br /><em className="font-medium">decoded</em> in seconds.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-[18px] max-w-[600px] text-[clamp(13px,2.2vw,17px)] text-white/95 leading-[1.65] font-medium [text-shadow:0_1px_10px_rgba(2,32,71,0.3)]"
          >
            AI summaries, YoY metric breakdowns, results calendar, watchlists and Telegram alerts — straight from official BSE India disclosures.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 flex gap-3 justify-center flex-wrap"
          >
            <ActionButton
              onAction={() => onEnterTerminal('dashboard')}
              className="px-[30px] py-[15px] min-h-[52px] rounded-full text-sm font-bold bg-[#d4f565] text-[#1a2e05] shadow-[0_18px_40px_-10px_rgba(212,245,101,0.8),0_4px_12px_rgba(2,32,71,0.2)] transition-transform duration-150 hover:scale-[1.06] hover:-translate-y-0.5 active:scale-95"
            >
              Enter Live Terminal <ArrowUpRight className="w-4 h-4" />
            </ActionButton>
            <ActionButton
              onAction={() => onEnterTerminal('dashboard')}
              className="px-[30px] py-[15px] min-h-[52px] rounded-full text-sm font-bold bg-white/95 text-slate-900 shadow-[0_12px_28px_rgba(2,32,71,0.22)] transition-transform duration-150 hover:scale-[1.06] hover:-translate-y-0.5 active:scale-95"
            >
              Explore Features
            </ActionButton>
          </motion.div>

          <div className="relative flex justify-center mt-[50px] pb-16">
            <motion.div data-depth="26" className="absolute z-[8] top-[110px] hidden lg:block" style={{ left: 'calc(50% - 336px)' }}
              animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
              <WatchlistCard />
            </motion.div>

            <motion.div data-depth="8" animate={{ y: [0, -14, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
              <PhoneMockup />
            </motion.div>

            <motion.div data-depth="34" className="absolute z-[8] top-[200px] hidden lg:block" style={{ right: 'calc(50% - 336px)' }}
              animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}>
              <TelegramCard />
            </motion.div>
          </div>

          {/* Mobile / tablet: side cards stack under the phone instead of hiding */}
          <div className="lg:hidden relative z-[6] grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-[560px] mx-auto px-5 pb-[46px] -mt-[30px]">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="mx-auto">
              <WatchlistCard />
            </motion.div>
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }} className="mx-auto">
              <TelegramCard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* About statement */}
      <section className="bg-white dark:bg-[#12131C] transition-colors">
        <div className="max-w-[1180px] mx-auto px-6 py-[72px]">
          <div className="flex justify-between text-[11px] font-semibold tracking-[2px] text-slate-400 uppercase mb-[34px]">
            <span>/ About Bsenexus /</span><span>© 2026</span>
          </div>
          <p className="text-[clamp(22px,3.8vw,38px)] leading-[1.38] max-w-[1020px]">
            <span className="font-serif font-semibold text-slate-900 dark:text-white tracking-[-0.5px]">
              Bsenexus{' '}
              <span className="inline-flex items-center justify-center w-[0.95em] h-[0.95em] rounded-lg bg-[#d4f565] text-[#1a2e05] text-[0.62em] not-italic">↗</span>{' '}
              is an AI-powered market-intelligence platform
            </span>{' '}
            <span className="text-slate-400 font-medium">
              designed to decode every BSE disclosure the second it drops — from results and board meetings to insider trades, we turn dense filings into clear, tradable insight.
            </span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] mt-11">
            <div className="rounded-3xl p-[26px] min-h-[210px] flex flex-col justify-between bg-[#f6f4ee] dark:bg-white/[0.04] border border-[#ece8dd] dark:border-white/10 transition-all duration-200 hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-[0_30px_50px_-20px_rgba(2,32,71,0.3)]">
              <div>
                <div className="font-serif text-[44px] font-bold tracking-[-1px] text-slate-900 dark:text-white">20<span className="text-2xl">s</span></div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-2">Feed refresh cadence — new BSE announcements surface in seconds, not hours.</div>
              </div>
              <div className="flex gap-2 mt-3">
                <CompanyLogo symbol="RELIANCE" /><CompanyLogo symbol="INFY" /><CompanyLogo symbol="HDFCBANK" /><CompanyLogo symbol="TCS" />
              </div>
            </div>
            <div className="rounded-3xl p-[26px] min-h-[210px] flex flex-col justify-between bg-[#f6f4ee] dark:bg-white/[0.04] border border-[#ece8dd] dark:border-white/10 transition-all duration-200 hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-[0_30px_50px_-20px_rgba(2,32,71,0.3)]">
              <div>
                <div className="font-serif text-[44px] font-bold tracking-[-1px] text-slate-900 dark:text-white">100%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-2">Official BSE India disclosures — every filing structured, searchable, linked to source.</div>
              </div>
              <div className="text-xs italic text-slate-900 dark:text-white mt-3">“Every filing that matters, before the market reacts.”</div>
            </div>
            <div className="rounded-3xl p-[26px] min-h-[210px] flex flex-col justify-between bg-[#0d1526] text-white transition-all duration-200 hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-[0_30px_50px_-20px_rgba(2,32,71,0.3)]">
              <div>
                <div className="font-serif text-[44px] font-bold tracking-[-1px] text-[#d4f565]">Live ↗</div>
                <div className="text-xs text-slate-400 font-semibold leading-relaxed mt-2">AI summaries, results calendar and Telegram alerts on every stock you track.</div>
              </div>
              <div className="mt-3.5">
                <ActionButton
                  onAction={() => onEnterTerminal('dashboard')}
                  className="min-h-[44px] px-6 py-3 rounded-full text-sm font-bold bg-[#d4f565] text-[#1a2e05] transition-transform duration-150 hover:scale-105 active:scale-95"
                >
                  Start Tracking Free <ArrowUpRight className="w-4 h-4" />
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
