import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Sparkles, Bell, Zap, Calendar, FileText,
  Signal, Wifi, BatteryFull, Home, Star, User, TrendingUp,
  Building2, ArrowUpRight, CheckCircle2,
} from 'lucide-react';

/**
 * CreativeHero — Finexa-inspired creative hero.
 * Sky gradient + CSS clouds, centered serif-italic headline, lime CTAs,
 * iPhone mockup with mini app UI, floating Telegram / AI-summary cards.
 * Dark mode renders a night-sky variant.
 */

interface CreativeHeroProps {
  onEnterTerminal: (tab?: string) => void;
}

const serifAccent = "font-[Georgia,'Times_New_Roman',serif] italic font-normal";

// Tiny sample filings for the phone mockup (clearly labeled SAMPLE — never real data)
const PHONE_FILINGS = [
  { symbol: 'RELIANCE', tag: 'BOARD MEETING', tagClass: 'bg-blue-500/15 text-blue-600', headline: 'Board to consider quarterly results & dividend', time: '2m' },
  { symbol: 'INFY', tag: 'RESULTS', tagClass: 'bg-emerald-500/15 text-emerald-600', headline: 'Q1 results: revenue +7.8% YoY (sample)', time: '18m' },
  { symbol: 'HDFCBANK', tag: 'REG 30', tagClass: 'bg-amber-500/15 text-amber-600', headline: 'Bond issuance disclosure (sample)', time: '42m' },
];

const TOP_COMPANIES = [
  { symbol: 'RELIANCE', name: 'Reliance Ind.', sector: 'Conglomerate', code: '500325' },
  { symbol: 'TCS', name: 'Tata Consultancy', sector: 'IT Services', code: '532540' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', code: '500180' },
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT Services', code: '500209' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking', code: '532174' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'PSU Bank', code: '500112' },
  { symbol: 'ITC', name: 'ITC Limited', sector: 'FMCG', code: '500875' },
  { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'Banking', code: '532215' },
];

function Clouds() {
  // Soft CSS clouds — a few blurred white ellipses drifting slowly
  const clouds = [
    { left: '6%', top: '12%', w: 220, h: 64, d: 26, delay: 0 },
    { left: '68%', top: '8%', w: 280, h: 76, d: 34, delay: 4 },
    { left: '30%', top: '26%', w: 180, h: 52, d: 30, delay: 9 },
    { left: '82%', top: '30%', w: 160, h: 48, d: 24, delay: 2 },
    { left: '12%', top: '44%', w: 200, h: 58, d: 38, delay: 6 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {clouds.map((c, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/70 dark:bg-white/[0.07] blur-2xl"
          style={{ left: c.left, top: c.top, width: c.w, height: c.h }}
          animate={{ x: [0, 34, 0], opacity: [0.55, 0.85, 0.55] }}
          transition={{ duration: c.d, delay: c.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* sun glow (light) / moon glow (dark) */}
      <div className="absolute -top-24 right-[12%] w-72 h-72 rounded-full bg-yellow-200/60 dark:bg-sky-300/15 blur-3xl" />
      <div className="absolute top-1/3 -left-24 w-96 h-96 rounded-full bg-sky-200/40 dark:bg-indigo-500/10 blur-3xl" />
    </div>
  );
}

function IPhoneMockup() {
  return (
    <div className="relative">
      {/* phone frame */}
      <div className="relative w-[270px] sm:w-[300px] rounded-[52px] bg-slate-900 p-[11px] shadow-[0_40px_80px_-20px_rgba(2,32,71,0.45)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border border-slate-700">
        {/* side buttons */}
        <div className="absolute -left-[2px] top-28 w-[3px] h-10 bg-slate-700 rounded-l-md" />
        <div className="absolute -left-[2px] top-44 w-[3px] h-14 bg-slate-700 rounded-l-md" />
        <div className="absolute -right-[2px] top-36 w-[3px] h-16 bg-slate-700 rounded-r-md" />
        {/* screen */}
        <div className="relative rounded-[42px] overflow-hidden bg-gradient-to-b from-sky-50 to-white dark:from-[#0D1B2E] dark:to-[#0A1424] h-[560px] sm:h-[590px]">
          {/* dynamic island */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-[26px] bg-black rounded-full z-20" />
          {/* status bar */}
          <div className="relative z-10 flex items-center justify-between px-7 pt-4 text-[11px] font-semibold text-slate-900 dark:text-white">
            <span className="font-mono">9:41</span>
            <span className="flex items-center gap-1">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <BatteryFull className="w-4 h-4" />
            </span>
          </div>
          {/* app header */}
          <div className="relative z-10 px-4 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-[12px] font-black text-slate-900 dark:text-white leading-none">BSE Nexus</div>
                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                </div>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-white dark:bg-white/10 shadow flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </div>
          </div>
          {/* sample tag */}
          <div className="relative z-10 px-4 pt-2">
            <span className="text-[8px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">Sample UI preview</span>
          </div>
          {/* filing cards */}
          <div className="relative z-10 px-3 pt-1 space-y-2">
            {PHONE_FILINGS.map((f, i) => (
              <motion.div
                key={f.symbol}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.22, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl bg-white dark:bg-white/[0.07] border border-slate-100 dark:border-white/10 shadow-[0_8px_20px_-8px_rgba(2,32,71,0.25)] p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black font-mono text-slate-900 dark:text-white">{f.symbol}</span>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${f.tagClass}`}>{f.tag}</span>
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug mt-1 line-clamp-2">{f.headline}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[8px] text-slate-400 font-semibold">{f.time} ago • sample</span>
                  <span className="text-[8px] font-bold text-sky-600 dark:text-sky-400">AI summary →</span>
                </div>
              </motion.div>
            ))}
          </div>
          {/* bottom nav */}
          <div className="absolute bottom-0 inset-x-0 z-10 px-6 pb-5 pt-3 bg-gradient-to-t from-white dark:from-[#0A1424] to-transparent">
            <div className="flex items-center justify-between px-2">
              {[Home, FileText, Star, User].map((Icon, i) => (
                <div key={i} className={`w-9 h-9 rounded-2xl flex items-center justify-center ${i === 0 ? 'bg-lime-300 text-slate-900' : 'text-slate-400 dark:text-slate-500'}`}>
                  <Icon className="w-4 h-4" />
                </div>
              ))}
            </div>
            <div className="mx-auto mt-2 w-24 h-1 rounded-full bg-slate-900/80 dark:bg-white/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingCard({ className, delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute z-20 ${className || ''}`}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5.5, delay, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-2xl bg-white/95 dark:bg-[#101B2E]/95 backdrop-blur border border-white/60 dark:border-white/10 shadow-[0_20px_50px_-12px_rgba(2,32,71,0.35)] p-3.5 w-52"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function CreativeHero({ onEnterTerminal }: CreativeHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-sky-200/60 dark:border-white/10">
      {/* sky background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#79C6F2] via-[#4EA6E4] to-[#2B7FC9] dark:from-[#060D1A] dark:via-[#0A1E3C] dark:to-[#0D2A52]" aria-hidden />
      <Clouds />
      {/* stars for night mode */}
      <div className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-100" aria-hidden>
        {[
          { l: '12%', t: '18%' }, { l: '24%', t: '8%' }, { l: '48%', t: '14%' },
          { l: '66%', t: '22%' }, { l: '84%', t: '12%' }, { l: '92%', t: '34%' },
          { l: '38%', t: '30%' }, { l: '56%', t: '6%' },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white"
            style={{ left: s.l, top: s.t }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        {/* pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/85 dark:bg-white/10 backdrop-blur border border-white/70 dark:border-white/15 text-slate-800 dark:text-sky-100 text-xs font-bold shadow-lg"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live BSE corporate filings intelligence
        </motion.div>

        {/* headline */}
        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 text-4xl sm:text-6xl lg:text-[68px] font-black text-white leading-[1.06] tracking-tight drop-shadow-[0_2px_12px_rgba(2,32,71,0.35)]"
        >
          Every BSE filing,
          <br />
          <span className={`${serifAccent} text-lime-200 dark:text-lime-300`}>decoded</span> in seconds.
        </motion.h1>

        {/* subcopy */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22 }}
          className="mt-4 text-sm sm:text-lg text-sky-50/95 dark:text-sky-100/80 max-w-2xl mx-auto leading-relaxed font-medium"
        >
          AI summaries, YoY metric breakdowns, results calendar, watchlists and Telegram
          alerts — straight from official BSE India disclosures.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.32 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onEnterTerminal('dashboard')}
            className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-lime-300 hover:bg-lime-200 text-slate-900 text-sm font-black shadow-[0_16px_36px_-10px_rgba(190,242,100,0.7)] cursor-pointer min-h-[48px]"
          >
            <Zap className="w-4 h-4 fill-slate-900" />
            Enter Live Terminal
            <ArrowRight className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onEnterTerminal('results-calendar')}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/90 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 backdrop-blur text-slate-800 dark:text-white text-sm font-bold border border-white/70 dark:border-white/20 shadow-lg cursor-pointer min-h-[48px]"
          >
            <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-300" />
            Earnings Calendar
          </motion.button>
        </motion.div>

        {/* phone + floating cards */}
        <div className="relative mt-12 sm:mt-14 flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 70, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            >
              <IPhoneMockup />
            </motion.div>
          </motion.div>

          {/* left floating card — Telegram alert */}
          <FloatingCard className="left-[2%] sm:left-[8%] lg:left-[16%] top-16 hidden md:block" delay={1.0}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-lime-300 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-slate-900" />
              </div>
              <div className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">Telegram Alert</div>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">RELIANCE</span> • Board meeting intimation
            </div>
            <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-emerald-600">
              <CheckCircle2 className="w-3 h-3" /> Sample alert delivered
            </div>
          </FloatingCard>

          {/* right floating card — AI summary */}
          <FloatingCard className="right-[2%] sm:right-[8%] lg:right-[16%] top-40 hidden md:block" delay={1.2}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">AI Summary</div>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/15 w-full" />
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/15 w-4/5" />
              <div className="h-1.5 rounded-full bg-lime-300/70 w-3/5" />
            </div>
            <div className="mt-2 flex gap-1">
              {['+12.4% YoY', 'PAT ↑'].map((m) => (
                <span key={m} className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">{m}</span>
              ))}
            </div>
          </FloatingCard>
        </div>

        {/* mobile floating chips (visible only on small screens) */}
        <div className="md:hidden mt-6 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/85 dark:bg-white/10 text-[11px] font-bold text-slate-700 dark:text-sky-100">
            <Bell className="w-3 h-3" /> Telegram alerts
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/85 dark:bg-white/10 text-[11px] font-bold text-slate-700 dark:text-sky-100">
            <Sparkles className="w-3 h-3" /> AI summaries
          </span>
        </div>

        {/* top companies strip */}
        <div className="mt-12 pt-8 border-t border-white/25 dark:border-white/10 text-left">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-white/20 backdrop-blur text-white flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/95 font-mono">
                Top BSE Companies • Live Dossiers &amp; Filings
              </span>
            </div>
            <a href="/companies" className="inline-flex items-center gap-1.5 text-xs font-bold text-lime-200 hover:text-lime-100 transition-colors group">
              <span>View all companies</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {TOP_COMPANIES.map((co) => (
              <a
                key={co.symbol}
                href={`/company/${co.symbol}`}
                className="group p-2.5 rounded-xl bg-white/85 dark:bg-white/[0.07] backdrop-blur hover:bg-white dark:hover:bg-white/[0.12] border border-white/50 dark:border-white/10 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white font-mono group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors">
                    {co.symbol}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">{co.code}</span>
                </div>
                <div className="mt-1">
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">{co.name}</div>
                  <div className="text-[9px] text-sky-700 dark:text-sky-300 font-semibold truncate">{co.sector}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
