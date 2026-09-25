import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Sparkles, Activity, Bell, Send, Shield, List, Calendar,
  ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, FileText,
  TrendingUp, Search, Eye, Filter, Lock, Play, Cpu, Layers,
  ExternalLink, BarChart3, Clock, Check, RefreshCw, Sun, Moon,
  User, BookOpen, AlertCircle, Award, Terminal, Flame, Database,
  Building2, Target, Volume2, ShieldCheck, HelpCircle, CheckCheck,
  Share2, Compass, X, MoreVertical
} from 'lucide-react';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { MarketClock } from './ui/MarketClock';
import { MarketTickerTape } from './ui/MarketTickerTape';
import { MarketGuide } from '../types';
import { ComponentSkeleton } from './ui/ComponentSkeleton';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import MarketGuidesSection from './MarketGuidesSection';
import { BlogReaderModal } from './BlogReaderModal';
import { scrollToElementWithOffset } from '../utils/scrollState';
import { FollowBseNexusBlock, SocialIconsRow } from './ui/SocialLinks';
import { CommonQuestionsFAQ } from './ui/CommonQuestionsFAQ';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LandingPageProps {
  onEnterTerminal: (tab?: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
  bseHealth?: { status: string; latency?: number };
  telegramHealth?: { status: string; latency?: number };
}

// Sample mock announcements for the interactive Hero preview
const SAMPLE_HERO_ANNOUNCEMENTS = [
  {
    symbol: 'TATASTEEL',
    scripCode: '500470',
    companyName: 'Tata Steel Limited',
    category: 'Financial Results',
    headline: 'Q3 Financial Results: Consolidated PAT jumps 24.8% YoY to ₹1,420 Cr',
    time: '2 mins ago',
    badge: 'EARNINGS',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    aiMetrics: { rev: '+12.4% YoY', pat: '+24.8% YoY', ebitda: '18.2%' },
    summary: 'Consolidated revenue rose to ₹57,084 Cr driven by higher domestic deliveries and reduced UK transition costs.'
  },
  {
    symbol: 'RELIANCE',
    scripCode: '500325',
    companyName: 'Reliance Industries Ltd',
    category: 'Board Meeting',
    headline: 'Board to consider Q2 FY27 Financial Results & Dividend on October 24',
    time: '14 mins ago',
    badge: 'DIVIDEND',
    badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    aiMetrics: { rev: 'Board Meeting', pat: 'Dividend Agenda', ebitda: 'LODR Reg 29' },
    summary: 'Meeting of Board of Directors scheduled to consider and approve standalone & consolidated financial results and interim dividend.'
  },
  {
    symbol: 'INFY',
    scripCode: '500209',
    companyName: 'Infosys Limited',
    category: 'Acquisition / M&A',
    headline: 'Strategic Acquisition of leading AI engineering firm for €140 Million',
    time: '38 mins ago',
    badge: 'M&A',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    aiMetrics: { rev: '€140M EV', pat: '100% Equity', ebitda: 'Accretive' },
    summary: 'Expands enterprise generative AI capabilities across European cloud banking and automotive supply chain clients.'
  },
  {
    symbol: 'HDFCBANK',
    scripCode: '500180',
    companyName: 'HDFC Bank Limited',
    category: 'General Disclosure',
    headline: 'SEBI Reg 30: Issuance of Tier-II Subordinated Bond Tranche of ₹3,000 Cr',
    time: '1 hr ago',
    badge: 'REG 30',
    badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    aiMetrics: { rev: 'CRISIL AAA', pat: '₹3,000 Cr', ebitda: '7.68% Coupon' },
    summary: 'CRISIL AAA/Stable rating reaffirmed. Capital will support long-term loan book expansion and capital adequacy norms.'
  }
];

// Interactive Demo Companies for 360° Company Dossier
const DEMO_COMPANIES: Record<string, {
  symbol: string;
  scripCode: string;
  name: string;
  sector: string;
  mktCap: string;
  conviction: 'Ultra High' | 'High' | 'Medium';
  price: string;
  change: string;
  pe: string;
  pb: string;
  roe: string;
  dividendYield: string;
  description: string;
  actions: Array<{
    date: string;
    type: string;
    badgeColor: string;
    title: string;
    impact: string;
    reg: string;
  }>;
  results: Array<{
    quarter: string;
    revenue: string;
    revYoy: string;
    pat: string;
    patYoy: string;
    ebitdaMargin: string;
    status: 'DECLARED' | 'UPCOMING';
  }>;
  filings: Array<{
    date: string;
    category: string;
    headline: string;
    pdfSize: string;
  }>;
}> = {
  TATASTEEL: {
    symbol: 'TATASTEEL',
    scripCode: '500470',
    name: 'Tata Steel Limited',
    sector: 'Iron & Steel / Heavy Industrials',
    mktCap: '₹1,95,420 Cr (Large Cap)',
    conviction: 'Ultra High',
    price: '₹164.20',
    change: '+2.4%',
    pe: '18.4x',
    pb: '1.9x',
    roe: '14.2%',
    dividendYield: '2.18%',
    description: 'One of the world\'s top steel manufacturing companies with an annual crude steel capacity of 35 MTPA across India and Europe.',
    actions: [
      { date: 'Aug 24, 2026', type: 'SEBI Reg 30', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', title: 'Commissioning of 5 MTPA Kalinganagar Blast Furnace', impact: 'Boosts high-margin domestic automotive flat steel capacity by 25%.', reg: 'LODR Reg 30(2)' },
      { date: 'Jul 18, 2026', type: 'UK Restructuring', badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30', title: 'Transition to Electric Arc Furnace at Port Talbot', impact: 'Reduces recurring European carbon penalty cash outflows by £120M annually.', reg: 'LODR Reg 30' },
      { date: 'Jun 05, 2026', type: 'Dividend', badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', title: 'Annual Final Dividend of ₹3.60 per share approved', impact: 'Total cash payout of ₹4,420 Cr; Record Date Jul 12.', reg: 'Reg 42' }
    ],
    results: [
      { quarter: 'Q1 FY27', revenue: '₹57,084 Cr', revYoy: '+12.4%', pat: '₹1,420 Cr', patYoy: '+24.8%', ebitdaMargin: '18.2%', status: 'DECLARED' },
      { quarter: 'Q4 FY26', revenue: '₹53,905 Cr', revYoy: '+8.2%', pat: '₹1,180 Cr', patYoy: '+16.5%', ebitdaMargin: '16.8%', status: 'DECLARED' },
      { quarter: 'Q3 FY26', revenue: '₹54,771 Cr', revYoy: '+5.4%', pat: '₹918 Cr', patYoy: '-4.2%', ebitdaMargin: '14.9%', status: 'DECLARED' },
      { quarter: 'Q2 FY27 (Upcoming)', revenue: '₹59,200 Cr (Est)', revYoy: '+14.1%', pat: '₹1,650 Cr (Est)', patYoy: '+32.0%', ebitdaMargin: '19.0%', status: 'UPCOMING' },
    ],
    filings: [
      { date: 'Today, 11:24 AM', category: 'Financial Results', headline: 'Outcome of Board Meeting: Unaudited Financial Results for Q1 FY27', pdfSize: '1.4 MB' },
      { date: 'Yesterday', category: 'Company Update', headline: 'Operational Update: Record crude steel production in 9M FY26', pdfSize: '420 KB' },
      { date: '3 days ago', category: 'SEBI Reg 30', headline: 'Disclosure under Regulation 30: Execution of long-term pellet supply contract', pdfSize: '680 KB' }
    ]
  },
  RELIANCE: {
    symbol: 'RELIANCE',
    scripCode: '500325',
    name: 'Reliance Industries Limited',
    sector: 'Oil, Retail & Telecom',
    mktCap: '₹20,15,400 Cr (Mega Cap)',
    conviction: 'High',
    price: '₹2,980.40',
    change: '+1.1%',
    pe: '26.8x',
    pb: '2.4x',
    roe: '12.8%',
    dividendYield: '0.34%',
    description: 'India\'s largest private sector enterprise spanning hydrocarbon exploration, retail digital ecosystems (Jio), and renewable green energy.',
    actions: [
      { date: 'Aug 20, 2026', type: 'Board Meeting', badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', title: 'Board to consider Interim Dividend & Green Energy Unit IPO', impact: 'Value unlocking across clean energy & solar giga-factories.', reg: 'LODR Reg 29' },
      { date: 'Jul 30, 2026', type: 'SEBI Reg 30', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', title: 'Jio Platforms crosses 500 Million 5G Subscriber Milestone', impact: 'ARPU expands to ₹198 per month with AI data pack upsells.', reg: 'Press & Reg 30' }
    ],
    results: [
      { quarter: 'Q1 FY27', revenue: '₹2,48,200 Cr', revYoy: '+9.8%', pat: '₹19,650 Cr', patYoy: '+11.2%', ebitdaMargin: '17.6%', status: 'DECLARED' },
      { quarter: 'Q4 FY26', revenue: '₹2,35,480 Cr', revYoy: '+7.4%', pat: '₹18,240 Cr', patYoy: '+8.9%', ebitdaMargin: '17.1%', status: 'DECLARED' },
      { quarter: 'Q2 FY27 (Upcoming)', revenue: '₹2,55,000 Cr (Est)', revYoy: '+12.0%', pat: '₹20,800 Cr (Est)', patYoy: '+14.5%', ebitdaMargin: '18.0%', status: 'UPCOMING' }
    ],
    filings: [
      { date: 'Aug 20, 2026', category: 'Board Meeting Notice', headline: 'Notice of Board Meeting to consider Audited Results & Dividend', pdfSize: '890 KB' },
      { date: 'Aug 14, 2026', category: 'SEBI Reg 30', headline: 'Partnership disclosure: Global Cloud AI infrastructure agreement', pdfSize: '1.1 MB' }
    ]
  },
  LT: {
    symbol: 'LT',
    scripCode: '500510',
    name: 'Larsen & Toubro Limited',
    sector: 'Infrastructure & EPC Heavy Engineering',
    mktCap: '₹5,14,200 Cr (Large Cap)',
    conviction: 'Ultra High',
    price: '₹3,740.00',
    change: '+3.2%',
    pe: '32.1x',
    pb: '4.8x',
    roe: '16.5%',
    dividendYield: '1.05%',
    description: 'Indian multinational engaged in EPC projects, hi-tech manufacturing, defense systems, and international power transmission infrastructure.',
    actions: [
      { date: 'Aug 22, 2026', type: 'Major Order Win', badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', title: '₹4,200 Cr Offshore Gas Separation Platform in Middle East', impact: 'Order inflow for FY26 crosses ₹1.25 Lakh Cr; margin profile 10.2%.', reg: 'LODR Reg 30' },
      { date: 'Aug 04, 2026', type: 'Defense Disclosures', badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30', title: 'Ministry of Defense signs contract for Naval Artillery systems', impact: 'Strategic sovereign defense order with high indigenous content.', reg: 'SEBI LODR Reg 30' }
    ],
    results: [
      { quarter: 'Q3 FY26', revenue: '₹62,180 Cr', revYoy: '+18.4%', pat: '₹3,620 Cr', patYoy: '+21.5%', ebitdaMargin: '10.8%', status: 'DECLARED' },
      { quarter: 'Q2 FY26', revenue: '₹58,400 Cr', revYoy: '+15.2%', pat: '₹3,220 Cr', patYoy: '+17.4%', ebitdaMargin: '10.4%', status: 'DECLARED' }
    ],
    filings: [
      { date: 'Aug 22, 2026', category: 'SEBI Reg 30', headline: 'L&T Energy Hydrocarbon secures Mega Offshore Order Win', pdfSize: '540 KB' },
      { date: 'Aug 10, 2026', category: 'Shareholding', headline: 'Quarterly statement on institutional shareholding pattern', pdfSize: '310 KB' }
    ]
  },
  INFY: {
    symbol: 'INFY',
    scripCode: '500209',
    name: 'Infosys Limited',
    sector: 'IT Consulting & Enterprise Software',
    mktCap: '₹7,58,900 Cr (Large Cap)',
    conviction: 'High',
    price: '₹1,820.00',
    change: '+0.8%',
    pe: '27.4x',
    pb: '7.8x',
    roe: '31.2%',
    dividendYield: '2.45%',
    description: 'Global leader in next-generation digital services and enterprise consulting, pioneering enterprise Generative AI integrations across Fortune 500s.',
    actions: [
      { date: 'Aug 19, 2026', type: 'Acquisition', badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30', title: 'Strategic Acquisition of German AI Engineering Firm for €140M', impact: 'Expands Topaz Generative AI client footprint across European banks.', reg: 'LODR Reg 30' },
      { date: 'Jul 26, 2026', type: 'Dividend', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', title: 'Interim Dividend of ₹18.00 per share with record date Aug 02', impact: 'Free cash flow payout ratio maintained at 85%.', reg: 'Reg 42' }
    ],
    results: [
      { quarter: 'Q3 FY26', revenue: '₹41,250 Cr', revYoy: '+7.8%', pat: '₹6,850 Cr', patYoy: '+9.4%', ebitdaMargin: '21.4%', status: 'DECLARED' },
      { quarter: 'Q2 FY26', revenue: '₹40,986 Cr', revYoy: '+5.1%', pat: '₹6,506 Cr', patYoy: '+4.7%', ebitdaMargin: '21.1%', status: 'DECLARED' }
    ],
    filings: [
      { date: 'Aug 19, 2026', category: 'SEBI Reg 30', headline: 'Disclosure under Regulation 30: Material Strategic M&A Agreement in Europe', pdfSize: '1.2 MB' },
      { date: 'Jul 26, 2026', category: 'Financial Results', headline: 'Consolidated Audited Financial Results for the quarter', pdfSize: '2.8 MB' }
    ]
  }
};

export function LandingPage({
  onEnterTerminal,
  theme,
  setTheme,
  bseHealth = { status: 'stable', latency: 85 },
  telegramHealth = { status: 'connected', latency: 120 }
}: LandingPageProps) {
  const { user, profile, isPro, isAdmin, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  
  // Interactive States
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [activeAiDemoTab, setActiveAiDemoTab] = useState<'earnings' | 'acquisition' | 'dividend' | 'reg30'>('earnings');
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<'TATASTEEL' | 'RELIANCE' | 'LT' | 'INFY'>('TATASTEEL');
  const [activeCompanyHubTab, setActiveCompanyHubTab] = useState<'hub' | 'timeline' | 'results' | 'filings' | 'research'>('hub');
  const [selectedGuide, setSelectedGuide] = useState<MarketGuide | null>(null);

  // Lock body scroll when mobile navigation drawer is open
  useBodyScrollLock(isMobileNavOpen);

  // Auto cycle hero items
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % SAMPLE_HERO_ANNOUNCEMENTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (id: string) => {
    setIsMobileNavOpen(false);
    scrollToElementWithOffset(id, 88, 'smooth');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#12131C] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 selection:bg-emerald-500 selection:text-white">
      {/* Accessibility: Skip to main content bypass link for keyboard & screen reader users (WCAG 2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-emerald-600 focus:text-white focus:font-bold focus:text-xs focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      
      {/* 1. TOP LIVE REAL-TIME MARKET TICKER TAPE */}
      <MarketTickerTape bseLatency={bseHealth.latency || 85} />

      {/* 2. NAVBAR (Apple Frosted Glass Chrome) */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#12131C]/80 backdrop-blur-xl backdrop-saturate-180 border-b border-slate-200/60 dark:border-white/10 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            
            {/* Brand Logo */}
            <motion.div 
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <BseNexusLogo className="w-8 h-8 sm:w-9 sm:h-9 transition-transform group-hover:scale-105" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">
                    BSE<span className="text-emerald-500">NEXUS</span>
                  </span>
                  <span className="hidden sm:inline text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap select-none">
                    TERMINAL
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none hidden sm:block">
                  Corporate Intelligence & Filings
                </p>
              </div>
            </motion.div>

            {/* Nav Menu Links */}
            <nav aria-label="Landing Navigation" className="hidden xl:flex items-center gap-5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <button 
                onClick={() => scrollToSection('whats-new')} 
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-1 min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>What's New</span>
                <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono">2.0</span>
              </button>
              <button 
                onClick={() => scrollToSection('company-hub')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                Company Hub
              </button>
              <button 
                onClick={() => scrollToSection('features')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                AI Summarizer
              </button>
              <button 
                onClick={() => onEnterTerminal('results-calendar')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                <span>Earnings Ledger</span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              </button>
              <button 
                onClick={() => onEnterTerminal('watchlists')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                Watchlists
              </button>
              <button 
                onClick={() => scrollToSection('telegram-alerts')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                Telegram Bot
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                <span>Pricing</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono">₹499/mo</span>
              </button>
              <button 
                onClick={() => scrollToSection('market-guides')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                Guides
              </button>
              <button 
                onClick={() => scrollToSection('about')} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer min-h-[32px] px-1.5 py-1 whitespace-nowrap select-none"
              >
                About
              </button>
            </nav>

            {/* Right CTAs */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Toggle */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs border border-transparent dark:border-[#352F48] min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </motion.button>

              {/* User Sign In / Profile status (all screens — visible on mobile too) */}
              {user || profile ? (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('dashboard')}
                  aria-label={`User profile: ${profile?.displayName || 'User profile'}`}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#222030] hover:bg-slate-200 dark:hover:bg-[#2C293D] text-slate-900 dark:text-white text-xs font-bold transition-all border border-slate-200 dark:border-[#332E45] cursor-pointer shadow-xs min-h-[38px] whitespace-nowrap select-none"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {(profile?.displayName || profile?.email || 'U').substring(0, 1).toUpperCase()}
                  </div>
                  <span className="max-w-[70px] sm:max-w-[100px] truncate">{profile?.displayName?.split(' ')[0] || 'Account'}</span>
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setIsAuthModalOpen(true)}
                  aria-label="Sign in to your account"
                  className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#222030] hover:bg-slate-200 dark:hover:bg-[#2C293D] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-[#332E45] cursor-pointer shrink-0 min-h-[38px] whitespace-nowrap select-none"
                >
                  <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" />
                  <span>Sign In</span>
                </motion.button>
              )}

              {/* Main Launch Live Terminal CTA */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onEnterTerminal('dashboard')}
                aria-label="Launch Live Terminal Dashboard"
                className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-black shadow-md shadow-emerald-700/25 transition-all cursor-pointer select-none shrink-0 min-h-[38px]"
              >
                <Zap className="w-3.5 sm:w-4 h-3.5 sm:h-4 fill-white shrink-0" />
                <span className="hidden xs:inline sm:inline">Launch Live Terminal</span>
                <span className="inline xs:hidden sm:hidden">Terminal</span>
                <ArrowRight className="w-3.5 h-3.5 hidden sm:inline shrink-0" />
              </motion.button>

              {/* Three-dot menu (mobile/tablet, visible below xl) — rightmost */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsMobileNavOpen(prev => !prev)}
                aria-label={isMobileNavOpen ? "Close menu" : "Open navigation menu"}
                aria-expanded={isMobileNavOpen}
                className="xl:hidden p-2 rounded-xl bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs border border-slate-200/80 dark:border-[#352F48] min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                title="Open Menu"
              >
                {isMobileNavOpen ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Slide-down Navigation Menu (visible below xl) */}
        <AnimatePresence>
          {isMobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="xl:hidden overflow-hidden border-t border-slate-200/80 dark:border-[#2D283E] bg-white/95 dark:bg-[#12131C]/95 backdrop-blur-2xl shadow-xl"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-1">
                <button
                  onClick={() => scrollToSection('whats-new')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>What's New</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono">2.0</span>
                </button>

                <button
                  onClick={() => scrollToSection('company-hub')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span>Company Hub</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => scrollToSection('features')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span>AI Summarizer</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    onEnterTerminal('results-calendar');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <span>Earnings Ledger</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    onEnterTerminal('watchlists');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span>Watchlists</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => scrollToSection('telegram-alerts')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span>Telegram Bot</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => scrollToSection('pricing')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span>Pricing</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono">₹499/mo</span>
                </button>

                <button
                  onClick={() => scrollToSection('market-guides')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span>Guides</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => scrollToSection('about')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1A27] transition-colors text-left"
                >
                  <span>About</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="pt-3 pb-1 border-t border-slate-200/80 dark:border-[#2D283E]">
                  <button
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      onEnterTerminal('dashboard');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>Terminal</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Primary Semantic Main Landmark for Screen Readers & Lighthouse Compliance */}
      <main id="main-content" role="main" tabIndex={-1} className="focus:outline-none">

      {/* 3. HERO HEADER SECTION */}
      <section className="relative overflow-hidden pt-8 sm:pt-14 pb-16 sm:pb-24 border-b border-slate-200/80 dark:border-[#2D283E]">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Hero Copy */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Continuous BSE India Corporate Disclosure Ingestion</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-black text-slate-900 dark:text-white leading-[1.12] tracking-tight font-display">
                BSE India Corporate Filings, Earnings Calendar & AI Intelligence
              </h1>

              {/* Subheadline */}
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-normal">
                Track market-moving announcements with AI financial summaries, YoY &amp; QoQ metric breakdowns, custom watchlist filtering, and Telegram alerts — sourced directly from official BSE India filings.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('dashboard')}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-black shadow-lg shadow-emerald-700/30 transition-all cursor-pointer select-none min-h-[44px] whitespace-nowrap"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Enter Live Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => scrollToSection('features')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-[#1A1926] hover:bg-slate-100 dark:hover:bg-[#252233] text-slate-800 dark:text-slate-200 text-sm font-bold border border-slate-200 dark:border-[#2D283E] transition-all shadow-xs cursor-pointer select-none min-h-[44px] whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Explore AI Features</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('results-calendar')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#222030] hover:bg-slate-200 dark:hover:bg-[#2B273C] text-slate-700 dark:text-slate-300 text-sm font-semibold transition-all cursor-pointer border border-transparent dark:border-[#332E45] select-none min-h-[44px] whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4 text-rose-500" />
                  <span>Earnings Calendar</span>
                </motion.button>
              </div>

              {/* Trust Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200/80 dark:border-[#2D283E]">
                <div className="space-y-0.5">
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">Live</div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">BSE Filing Ingestion</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">AI</div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Filing Summaries</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">Coverage</div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">BSE Announcements, One Feed</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">Telegram</div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Filing Alerts</div>
                </div>
              </div>
            </div>

            {/* Right Hero Interactive Terminal Card Preview */}
            <div className="lg:col-span-5">
              <div className="bg-white dark:bg-[#1A1926] rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl overflow-hidden">
                {/* Terminal Card Header with semantic h2 */}
                <div className="px-4 py-3 bg-[#15141E] text-slate-200 flex items-center justify-between border-b border-[#2A263A]">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-200 ml-2 inline">bse-live-stream.terminal</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>STREAMING</span>
                  </div>
                </div>

                {/* Interactive Stream Tabs */}
                <div className="p-3 bg-slate-50 dark:bg-[#171622] border-b border-slate-200 dark:border-[#2A263A] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {SAMPLE_HERO_ANNOUNCEMENTS.map((item, idx) => (
                    <motion.button
                      key={item.symbol}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setActiveHeroIndex(idx)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none min-h-[32px]",
                        activeHeroIndex === idx
                          ? "bg-emerald-700 text-white dark:bg-emerald-600 dark:text-white shadow-xs"
                          : "bg-white dark:bg-[#201E2E] text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#2B273C]"
                      )}
                    >
                      {item.symbol}
                    </motion.button>
                  ))}
                </div>

                {/* Announcement Card Content */}
                <div className="overflow-hidden min-h-[360px] flex flex-col justify-between">
                  <AnimatePresence mode="wait">
                    {(() => {
                      const currentItem = SAMPLE_HERO_ANNOUNCEMENTS[activeHeroIndex];
                      return (
                        <motion.div
                          key={currentItem.symbol}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                          className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between"
                        >
                          {/* Illustrative Disclaimer Tag */}
                          <div className="flex items-center justify-between text-[10px] px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-900/60 font-mono select-none">
                            <span>⚡ LIVE DISCLOSURE DEMO</span>
                            <span>Illustrative sample • Not investment advice</span>
                          </div>

                          {/* Ticker & Meta */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                                {currentItem.symbol}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                ({currentItem.scripCode})
                              </span>
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap select-none", currentItem.badgeColor)}>
                                {currentItem.badge}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1 select-none">
                              <Clock className="w-3.5 h-3.5" />
                              {currentItem.time}
                            </span>
                          </div>

                          {/* Headline */}
                          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                            {currentItem.headline}
                          </div>

                          {/* AI Metrics Table Bar */}
                          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#14131E] border border-slate-200/80 dark:border-[#2D283E] font-mono text-xs">
                            <div>
                              <div className="text-[10px] text-slate-700 dark:text-slate-300 uppercase font-semibold select-none">Revenue</div>
                              <div className="font-black text-emerald-700 dark:text-emerald-400">{currentItem.aiMetrics.rev}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-700 dark:text-slate-300 uppercase font-semibold select-none">Net Profit</div>
                              <div className="font-black text-emerald-700 dark:text-emerald-400">{currentItem.aiMetrics.pat}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-700 dark:text-slate-300 uppercase font-semibold select-none">EBITDA / Type</div>
                              <div className="font-black text-purple-700 dark:text-purple-400">{currentItem.aiMetrics.ebitda}</div>
                            </div>
                          </div>

                          {/* AI Summary Box */}
                          <div className="p-3 rounded-lg bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-800 dark:text-purple-300 select-none">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Gemini AI Synthesis</span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {currentItem.summary}
                            </p>
                          </div>

                          {/* Fast Action */}
                          <div className="pt-1 flex items-center justify-between">
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={() => onEnterTerminal('dashboard')}
                              className="w-full py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs min-h-[40px] select-none whitespace-nowrap"
                            >
                              <span>Open Live Announcement in Terminal</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Top Companies Quick Intelligence Strip (Fix 3) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-8 border-t border-slate-200/60 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                Top BSE Companies • Live Dossiers &amp; Filings
              </span>
            </div>
            <a
              href="/companies"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors group"
            >
              <span>View all 26 BSE listed companies</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {[
              { symbol: 'RELIANCE', name: 'Reliance Ind.', sector: 'Conglomerate', code: '500325' },
              { symbol: 'TCS', name: 'Tata Consultancy', sector: 'IT Services', code: '532540' },
              { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', code: '500180' },
              { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT Services', code: '500209' },
              { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking', code: '532174' },
              { symbol: 'SBIN', name: 'State Bank of India', sector: 'PSU Bank', code: '500112' },
              { symbol: 'ITC', name: 'ITC Limited', sector: 'FMCG', code: '500875' },
              { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'Banking', code: '532215' },
            ].map((co) => (
              <a
                key={co.symbol}
                href={`/company/${co.symbol}`}
                className="group p-2.5 rounded-xl bg-white/70 dark:bg-[#15141E]/90 hover:bg-emerald-50/50 dark:hover:bg-[#1A2228] border border-slate-200/80 dark:border-white/5 hover:border-emerald-500/40 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white font-mono group-hover:text-emerald-500 transition-colors">
                    {co.symbol}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                    {co.code}
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                    {co.name}
                  </div>
                  <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                    {co.sector}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 3.5 WHAT'S NEW IN BSE NEXUS 2.0 SECTION */}
      <section id="whats-new" className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 to-white dark:from-[#0B0F17] dark:to-[#0F172A] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>MAJOR PLATFORM UPDATE • VERSION 2.0</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Everything newly built & enhanced in BSE Nexus
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Explore the latest suite of institutional tools designed for active Indian equity investors, forensic analysts, and prop desks.
            </p>
          </div>

          {/* 6-Card Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* New Feature 1: Company Intelligence Dossier */}
            <motion.div
              whileHover={{ y: -4, transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
              className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/30 hover:border-emerald-500 transition-all shadow-sm flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 uppercase tracking-wider whitespace-nowrap select-none">
                    ✨ NEW CORE HUB
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                  360° Company Intelligence Dossier
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Deep multi-tab dossier for every BSE ticker. Access corporate fundamentals, historical filings, SEBI Reg 30 material actions timeline, earnings ledgers, and one-click Screener.in research sync.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Material Actions</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Quarterly Results</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Screener Sync</span>
                </div>
              </div>
              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => scrollToSection('company-hub')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer min-h-[36px] select-none"
                >
                  <span>Interactive Preview Below</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>

            {/* New Feature 2: Quarterly Results Ledger & Historical Sync */}
            <motion.div
              whileHover={{ y: -4, transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
              className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all shadow-sm flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider whitespace-nowrap select-none">
                    ⚡ ENHANCED
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  Quarterly Results Ledger & 1-3Y Historical Sync
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Filter by <strong>Declared Results</strong> vs <strong>Upcoming Board Meetings</strong>. Audit YoY% and QoQ% revenue, PAT, and EBITDA margin expansions with 1 to 3-year automated history synchronization.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Declared Filter</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">YoY/QoQ Margins</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Docket Export</span>
                </div>
              </div>
              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('results-calendar')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer min-h-[36px] select-none"
                >
                  <span>Open Results Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>

            {/* New Feature 3: Multi-Tier Conviction Watchlists */}
            <motion.div
              whileHover={{ y: -4, transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
              className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all shadow-sm flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800">
                    <Target className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider whitespace-nowrap select-none">
                    🎯 SMART TIERS
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-500 transition-colors">
                  Conviction-Tiered Watchlists
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Categorize portfolio ideas by conviction level (Ultra High, High, Medium, Low). Includes live filing counters, price targets, research notes, and 1-click dossier launch.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Conviction Tiers</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Live Counters</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">CSV Export</span>
                </div>
              </div>
              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('watchlists')}
                  className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline cursor-pointer min-h-[36px] select-none"
                >
                  <span>Manage Watchlists</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>

            {/* New Feature 4: Telegram Rules & Audio Chimes */}
            <motion.div
              whileHover={{ y: -4, transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
              className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all shadow-sm flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase tracking-wider whitespace-nowrap select-none">
                    ⚡ ZERO DELAY
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-500 transition-colors">
                  Smart Telegram Alert Rules & Sound Chimes
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Build custom rule filters triggering on Dividend, Bonus, Buyback, Order Win, Loss, Resignation keywords. Supports rich markdown dispatch to unlimited Telegram channels with custom notification chimes.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Keyword Rules</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Audio Chimes</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Telegram Bot</span>
                </div>
              </div>
              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('settings')}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 hover:underline cursor-pointer min-h-[36px] select-none"
                >
                  <span>Configure Alert Rules</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>

            {/* New Feature 5: Live Market Indices & Market Session Hours */}
            <motion.div
              whileHover={{ y: -4, transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
              className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all shadow-sm flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider whitespace-nowrap select-none">
                    📈 LIVE CLOCK
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                  Indian Indices & Session Hours Clock
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Continuous monitoring across BSE Sensex, Nifty 50, BSE Midcap, BSE Smallcap, and India VIX. Dynamic badges indicate Pre-Open, Regular Trading, and Post-Close market statuses.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Sensex & Nifty</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">India VIX</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Session Clocks</span>
                </div>
              </div>
              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('dashboard')}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline cursor-pointer min-h-[36px] select-none"
                >
                  <span>View Live Indices</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>

            {/* New Feature 6: Storage Quota Optimizer & Offline Failover */}
            <motion.div
              whileHover={{ y: -4, transition: { type: 'spring', bounce: 0, duration: 0.3 } }}
              className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all shadow-sm flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 uppercase tracking-wider whitespace-nowrap select-none">
                    🛡️ ROBUST
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-teal-500 transition-colors">
                  Quota Optimizer & Offline Failover
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Automatic data retention cleanup prevents Firestore quota overflow. Seamless offline fallbacks cache live filings locally so you never miss a filing during connectivity dips.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Auto-Pruning</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Zero Data Loss</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">Instant Failover</span>
                </div>
              </div>
              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onEnterTerminal('diagnostics')}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1 hover:underline cursor-pointer min-h-[36px] select-none"
                >
                  <span>Check Engine Health</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 3.8 INTERACTIVE SHOWCASE: 360° COMPANY INTELLIGENCE DOSSIER */}
      <section id="company-hub" className="py-16 sm:py-24 bg-white dark:bg-[#0A0E1A] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                <Building2 className="w-3.5 h-3.5" />
                <span>INTERACTIVE FEATURE DEMO</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                360° Company Intelligence & Material Actions Hub
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Click across the companies and explore all 5 dossier tabs below. See how BSE Nexus transforms dense disclosures into actionable alpha.
              </p>
            </div>

            {/* Company Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              {(['TATASTEEL', 'RELIANCE', 'LT', 'INFY'] as const).map((key) => {
                const isSelected = selectedCompanyKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCompanyKey(key)}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                      isSelected
                        ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-md scale-105"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    <span>{DEMO_COMPANIES[key].symbol}</span>
                    <span className={cn(
                      "text-[10px] font-mono px-1.5 py-0.2 rounded",
                      isSelected ? "bg-white/20 text-white dark:text-slate-950 dark:bg-slate-950/20" : "text-slate-500"
                    )}>
                      {DEMO_COMPANIES[key].price}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Modal-Like Container Box */}
          {(() => {
            const company = DEMO_COMPANIES[selectedCompanyKey];
            return (
              <div className="bg-slate-50 dark:bg-[#111625] rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                
                {/* Dossier Header Bar */}
                <div className="p-4 sm:p-6 bg-white dark:bg-[#161D31] border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm shrink-0">
                      {company.symbol.substring(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                          {company.name}
                        </h3>
                        <span className="font-mono text-xs text-slate-500 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                          BSE: {company.scripCode}
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {company.conviction} Conviction
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {company.sector} • {company.mktCap}
                      </p>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="flex items-center gap-3 self-end md:self-auto">
                    <div className="text-right">
                      <div className="text-lg font-mono font-black text-slate-900 dark:text-white tabular-nums">
                        {company.price}
                      </div>
                      <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {company.change} Today
                      </div>
                    </div>
                    <button
                      onClick={() => onEnterTerminal('dashboard')}
                      className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-95 min-h-[40px] whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Open in Terminal</span>
                    </button>
                  </div>
                </div>

                {/* 5 Dossier Navigation Tabs */}
                <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar bg-slate-100/70 dark:bg-[#13192B]">
                  {[
                    { id: 'hub', label: 'Company Hub', icon: Building2 },
                    { id: 'timeline', label: 'Material Actions (LODR Reg 30)', icon: Activity, count: company.actions.length },
                    { id: 'results', label: 'Quarterly Results Ledger', icon: BarChart3 },
                    { id: 'filings', label: 'BSE Filings & Disclosures', icon: FileText, count: company.filings.length },
                    { id: 'research', label: 'Research Tools & Links', icon: ExternalLink }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeCompanyHubTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveCompanyHubTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap border-t-2",
                          isActive
                            ? "bg-white dark:bg-[#111625] text-slate-900 dark:text-white border-emerald-500 shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border-transparent hover:bg-white/50 dark:hover:bg-slate-800/40"
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5", isActive ? "text-emerald-500" : "text-slate-400")} />
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                            isActive ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600"
                          )}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content Display */}
                <div className="p-4 sm:p-6 min-h-[300px]">
                  
                  {/* TAB 1: COMPANY HUB */}
                  {activeCompanyHubTab === 'hub' && (
                    <div className="space-y-6">
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-4xl">
                        {company.description}
                      </p>

                      {/* 4 Financial Key Metrics Tiles */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-[#161D31] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">P/E Ratio</div>
                          <div className="text-lg font-mono font-black text-slate-900 dark:text-white mt-1 tabular-nums">{company.pe}</div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Industry Median: 22.4x</div>
                        </div>
                        <div className="bg-white dark:bg-[#161D31] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Price to Book</div>
                          <div className="text-lg font-mono font-black text-slate-900 dark:text-white mt-1 tabular-nums">{company.pb}</div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Book Value: High safety</div>
                        </div>
                        <div className="bg-white dark:bg-[#161D31] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Return on Equity</div>
                          <div className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">{company.roe}</div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Annualized Average</div>
                        </div>
                        <div className="bg-white dark:bg-[#161D31] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Dividend Yield</div>
                          <div className="text-lg font-mono font-black text-blue-700 dark:text-blue-400 mt-1 tabular-nums">{company.dividendYield}</div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Regular Payout</div>
                        </div>
                      </div>

                      {/* Quick Snapshot List */}
                      <div className="bg-white dark:bg-[#161D31] p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">Continuous BSE filing stream active for {company.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">Direct PDF Ingestion Enabled</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: MATERIAL ACTIONS TIMELINE (SEBI LODR REG 30) */}
                  {activeCompanyHubTab === 'timeline' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Chronological Corporate Material Events (SEBI LODR)
                        </p>
                        <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          Continuous Ingestion Active
                        </span>
                      </div>

                      <div className="space-y-3">
                        {company.actions.map((act, i) => (
                          <div key={i} className="bg-white dark:bg-[#161D31] p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 hover:border-emerald-500/40 transition-colors">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full border", act.badgeColor)}>
                                  {act.type}
                                </span>
                                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">{act.reg}</span>
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {act.date}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {act.title}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                              <span className="font-bold text-slate-800 dark:text-slate-200">Financial Impact: </span>
                              {act.impact}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: QUARTERLY RESULTS LEDGER */}
                  {activeCompanyHubTab === 'results' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Consolidated Financial Trajectory & Margin Expansion
                        </p>
                        <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                          YoY & QoQ Normalized
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold bg-slate-100/60 dark:bg-slate-900/50">
                              <th className="py-2.5 px-3">Quarter</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Revenue (YoY)</th>
                              <th className="py-2.5 px-3">PAT (YoY)</th>
                              <th className="py-2.5 px-3">EBITDA Margin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                            {company.results.map((res, idx) => (
                              <tr key={idx} className="hover:bg-white dark:hover:bg-[#161D31] transition-colors">
                                <td className="py-3 px-3 font-sans font-bold text-slate-900 dark:text-white">{res.quarter}</td>
                                <td className="py-3 px-3">
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                    res.status === 'DECLARED' ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                  )}>
                                    {res.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {res.revenue} <span className="text-emerald-600 dark:text-emerald-400 text-[11px] ml-1">{res.revYoy}</span>
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {res.pat} <span className={cn("text-[11px] ml-1", res.patYoy.startsWith('+') ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>{res.patYoy}</span>
                                </td>
                                <td className="py-3 px-3 font-bold text-purple-600 dark:text-purple-400">{res.ebitdaMargin}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: BSE FILINGS & DISCLOSURES */}
                  {activeCompanyHubTab === 'filings' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Original Exchange Disclosures (PDF Archive)
                        </p>
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">Showing recent 3 filings</span>
                      </div>

                      {company.filings.map((filing, fIdx) => (
                        <div key={fIdx} className="bg-white dark:bg-[#161D31] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-[10px] shrink-0">
                              PDF
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {filing.category}
                                </span>
                                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">{filing.date}</span>
                              </div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                {filing.headline}
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 shrink-0">{filing.pdfSize}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 5: RESEARCH TOOLS */}
                  {activeCompanyHubTab === 'research' && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Synchronized External Equity Research Portals
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <a
                          href={`https://www.bseindia.com/stock-share-price/${company.symbol.toLowerCase()}/${company.scripCode}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white dark:bg-[#161D31] p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all flex flex-col justify-between group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">BSE Official Corporate Page</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500" />
                            </div>
                            <p className="text-[11px] text-slate-500">View official shareholding patterns, corp actions, and order books on BSE India.</p>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1">
                            <span>Open BSE Page</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </a>

                        <a
                          href={`https://www.screener.in/company/${company.symbol}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white dark:bg-[#161D31] p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all flex flex-col justify-between group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">Screener.in Financials</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500" />
                            </div>
                            <p className="text-[11px] text-slate-500">Audit 10-year balance sheets, cash flows, debtor days, and shareholding changes.</p>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1">
                            <span>Open Screener.in</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </a>

                        <a
                          href={`https://www.moneycontrol.com/india/stockpricequote/`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white dark:bg-[#161D31] p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all flex flex-col justify-between group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">Moneycontrol News Sync</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500" />
                            </div>
                            <p className="text-[11px] text-slate-500">Live broker targets, analyst upgrades/downgrades, and market rumors.</p>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1">
                            <span>Open Moneycontrol</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </a>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            );
          })()}

        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 sm:mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              End-to-End Workflow
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Connect your watchlist, receive BSE announcements, and get AI filing summaries
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              From raw exchange PDF submission to institutional-grade insights on your phone in seconds.
            </p>
          </div>

          {/* 4 Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Step 1 */}
            <motion.div 
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onEnterTerminal('watchlists')}
              className="bg-[#F8FAFC] dark:bg-[#0B0F17] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 relative group hover:border-emerald-500/50 transition-all shadow-xs cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono font-black text-base mb-4 border border-emerald-200 dark:border-emerald-800">
                  01
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Curate Watchlist
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Add your portfolio stocks or track all 5,000+ BSE equities. Filter by high-priority categories like Financials, Board Meetings, Dividends, or Acquisitions.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span>Manage Watchlists →</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div 
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onEnterTerminal('dashboard')}
              className="bg-[#F8FAFC] dark:bg-[#0B0F17] p-6 rounded-2xl border border-blue-300/80 dark:border-blue-900/60 relative group hover:border-blue-500 transition-all shadow-xs cursor-pointer flex flex-col justify-between ring-1 ring-blue-500/20"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono font-black text-base border border-blue-200 dark:border-blue-800">
                    02
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Live Stream</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <span>Continuous BSE Stream</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Our cloud engine continuously polls BSE India official disclosure endpoints every 15 seconds, grabbing new filings immediately.
                </p>
              </div>
              <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/60 flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400">
                <span>Open Live BSE Feed →</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div 
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onEnterTerminal('dashboard')}
              className="bg-[#F8FAFC] dark:bg-[#0B0F17] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 relative group hover:border-purple-500/50 transition-all shadow-xs cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-mono font-black text-base mb-4 border border-purple-200 dark:border-purple-800">
                  03
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Gemini AI Synthesis
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Gemini model digests complex corporate disclosures and financial PDFs, extracting YoY/QoQ revenue, PAT, EBITDA margins, and management commentary highlights.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-purple-600 dark:text-purple-400">
                <span>Explore AI Summaries →</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </motion.div>

            {/* Step 4 */}
            <motion.div 
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onEnterTerminal('settings')}
              className="bg-[#F8FAFC] dark:bg-[#0B0F17] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 relative group hover:border-rose-500/50 transition-all shadow-xs cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center font-mono font-black text-base mb-4 border border-rose-200 dark:border-rose-800">
                  04
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Instant Alerts
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Alerts are delivered to your Telegram channel and in-app notification inbox in ~2 seconds with custom audio chimes so you can act before market reaction.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-rose-600 dark:text-rose-400">
                <span>Setup Telegram Alerts →</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 5. FEATURE SECTION 1: GEMINI AI SUMMARIES OF CORPORATE FILINGS */}
      <section id="features" className="py-16 sm:py-24 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left: Info */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Feature 01 • Neural Analysis</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Gemini AI summaries of corporate filings and financial results
              </h2>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Reading 40-page unstructured earnings PDFs under market pressure is prone to errors. Our server-side Gemini AI engine extracts clean YoY and QoQ comparisons, detects EBITDA margin trajectory, and highlights key regulatory disclosures automatically.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">YoY & QoQ Profitability Matrices</h3>
                    <p className="text-xs text-slate-500">Separates organic operational revenue from one-time exceptional gains.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">SEBI Regulation 30 Impact Scoring</h3>
                    <p className="text-xs text-slate-500">Evaluates business materiality of order wins, plant shutdowns, and management changes.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Direct Official PDF Verification</h3>
                    <p className="text-xs text-slate-500">Every AI summary links directly to the verified BSE India original document.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onEnterTerminal('dashboard')}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Test AI Summary in Live Feed</span>
                </button>
              </div>
            </div>

            {/* Right: Interactive AI Demo Card */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
                {/* Sample Selector Tabs */}
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-500" />
                    <span>Interactive Gemini AI Demo:</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[
                      { id: 'earnings', label: 'Q3 Financials' },
                      { id: 'acquisition', label: 'M&A Deal' },
                      { id: 'dividend', label: 'Bonus & Dividend' },
                      { id: 'reg30', label: 'Order Win' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveAiDemoTab(tab.id as any)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                          activeAiDemoTab === tab.id
                            ? "bg-purple-600 text-white shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Demo Content Showcase */}
                {activeAiDemoTab === 'earnings' && (
                  <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between text-[10px] px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-900/60 font-mono">
                      <span>⚡ DEMO EXTRACTION</span>
                      <span>Illustrative sample for demonstration • Source: BSE LODR Filing</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">TATASTEEL (500470)</span>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">Unaudited Consolidated Q3 Results for FY26</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        YoY Growth
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Revenue</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">₹57,084 Cr</div>
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">+12.4% YoY</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Net Profit (PAT)</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">₹1,420 Cr</div>
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">+24.8% YoY</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">EBITDA Margin</div>
                        <div className="text-sm font-black text-purple-700 dark:text-purple-400">18.2%</div>
                        <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400">+140 bps</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Basic EPS</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">₹1.16</div>
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">+22.1% YoY</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1.5 text-xs">
                      <div className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Key Operational Takeaways:</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        • India crude steel production rose 6% YoY to record 5.32 MT.<br />
                        • UK operation losses narrowed by 42% following electric arc furnace transition.<br />
                        • Net Debt reduced by ₹3,120 Cr during the quarter, improving leverage ratio to 2.1x EBITDA.
                      </p>
                    </div>
                  </div>
                )}

                {activeAiDemoTab === 'acquisition' && (
                  <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">INFY (500209)</span>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">Acquisition of Cloud AI Leader in Germany</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        M&A Disclosed
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Enterprise Value</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">€140 Million</div>
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-400">100% Cash</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Target CY25 Rev</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">€45 Million</div>
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">+35% YoY</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Closing Timeline</div>
                        <div className="text-sm font-black text-purple-700 dark:text-purple-400">Q1 FY27</div>
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-400">Subject to Regs</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1.5 text-xs">
                      <div className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Strategic Impact:</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        • Adds 350+ deep-tech AI engineers across Frankfurt and Munich offices.<br />
                        • Strengthens automotive Tier-1 autonomous software contracts.<br />
                        • Expected to be EPS accretive from year two of integration.
                      </p>
                    </div>
                  </div>
                )}

                {activeAiDemoTab === 'dividend' && (
                  <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">ITC (500875)</span>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">Special Interim Dividend of ₹7.50 per Share</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        Record Date Set
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Dividend / Share</div>
                        <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">₹7.50 (750%)</div>
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-400">Face Value ₹1.00</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Record Date</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">Aug 28, 2026</div>
                        <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400">T+1 Settlement</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Payout Date</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">Sep 15, 2026</div>
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-400">Direct Bank Credit</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1.5 text-xs">
                      <div className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Dividend Assessment:</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        • Implies annualized dividend yield of ~3.4% at current market price.<br />
                        • Total cash outflow of approx ₹9,340 Cr funded via strong cigarette & FMCG free cash flow.
                      </p>
                    </div>
                  </div>
                )}

                {activeAiDemoTab === 'reg30' && (
                  <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">LT (500510)</span>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">Major Hydrocarbon Offshore Order Win of ₹4,200 Cr</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        Major Order
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Contract Size</div>
                        <div className="text-sm font-black text-amber-700 dark:text-amber-400">₹4,200 Cr</div>
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-400">L&T Energy</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Client Entity</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">Middle East Major</div>
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">International</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase">Execution Period</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">36 Months</div>
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-400">EPC Fixed Price</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1.5 text-xs">
                      <div className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Materiality Check:</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        • Order book expands to record ₹4.9 Lakh Crore with international share exceeding 38%.<br />
                        • Fall under 'Mega' order classification according to L&T's project size criteria.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. FEATURE SECTION 2: CUSTOM STOCK WATCHLISTS */}
      <section className="py-16 sm:py-24 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Interactive Watchlist Builder Showcase */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="bg-[#F8FAFC] dark:bg-[#0B0F17] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
                
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">Active Watchlist: Core Largecaps & Midcaps</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    6 Stocks
                  </span>
                </div>

                {/* Stock Items in Watchlist */}
                <div className="space-y-2 font-mono text-xs">
                  {[
                    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', price: '₹2,980.40', cat: 'Oil & Telecom', priority: 'HIGH', filings: 3 },
                    { symbol: 'TATASTEEL', name: 'Tata Steel Limited', price: '₹164.20', cat: 'Metals & Mining', priority: 'HIGH', filings: 5 },
                    { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', price: '₹1,640.80', cat: 'Banking & Fin', priority: 'MEDIUM', filings: 2 },
                    { symbol: 'INFY', name: 'Infosys Limited', price: '₹1,820.00', cat: 'IT Services', priority: 'HIGH', filings: 4 },
                    { symbol: 'ITC', name: 'ITC Limited', price: '₹480.20', cat: 'FMCG & Hotels', priority: 'MEDIUM', filings: 1 },
                  ].map((stk) => (
                    <div 
                      key={stk.symbol}
                      className="p-3 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between hover:border-emerald-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold flex items-center justify-center text-xs">
                          {stk.symbol.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{stk.symbol}</span>
                            <span className="text-[10px] font-normal text-slate-400">({stk.cat})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-sans">{stk.name}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          stk.priority === 'HIGH' ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300" : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                        )}>
                          {stk.priority}
                        </span>
                        <div className="text-right">
                          <div className="font-bold text-slate-900 dark:text-white">{stk.price}</div>
                          <div className="text-[10px] text-emerald-500 font-bold">{stk.filings} new filings</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>⚡ Instant category filtering applied</span>
                  <button 
                    onClick={() => onEnterTerminal('watchlists')}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Full Watchlists</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>

            {/* Right: Info */}
            <div className="lg:col-span-5 space-y-5 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                <List className="w-3.5 h-3.5" />
                <span>Feature 02 • Precision Watchlists</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Custom stock watchlists with BSE corporate announcements
              </h2>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Filter out general market noise. Build unlimited watchlists by theme (e.g. Dividend Yielders, Defense Order Winners, SME Breakouts) and receive announcements exclusively for the tickers you hold.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>One-click Symbol search across all 5,000+ BSE Scrips</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Priority Tagging: High, Medium, and Routine</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Mute Routine Administrative Filings (e.g., duplicate certificate loss)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onEnterTerminal('watchlists')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <List className="w-4 h-4" />
                  <span>Create Your First Watchlist</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. FEATURE SECTION 3: EARNINGS CALENDAR */}
      <section className="py-16 sm:py-24 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left: Info */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800">
                <Calendar className="w-3.5 h-3.5" />
                <span>Feature 03 • Earnings Intelligence</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Earnings calendar tracking all BSE India financial results
              </h2>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Stay prepared before numbers hit the wire. Track scheduled Board Meetings for quarterly results, interim dividends, and stock splits days in advance with automated reminders.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Quarterly Result Dates (Q1, Q2, Q3, Q4 & Audited Annuals)</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Pre-Meeting Dividend & Bonus Agenda Tracking</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Post-Result YoY Performance Scorecard Linking</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onEnterTerminal('results-calendar')}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Open Full Earnings Calendar</span>
                </button>
              </div>
            </div>

            {/* Right: Earnings Calendar Preview Table */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-500" />
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">Upcoming Board Meetings for Results</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    Live BSE Docket
                  </span>
                </div>

                <div className="overflow-x-auto font-mono text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 uppercase font-bold">
                        <th className="pb-2 font-black">Company & Scrip</th>
                        <th className="pb-2 font-black">Board Meeting Date</th>
                        <th className="pb-2 font-black">Quarter</th>
                        <th className="pb-2 font-black text-right">Agenda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {[
                        { symbol: 'TCS', scrip: '532540', date: 'October 08, 2026', q: 'Q2 FY27 (Unaudited)', agenda: 'Results & Interim Div', color: 'text-blue-700 dark:text-blue-400' },
                        { symbol: 'HCLTECH', scrip: '532281', date: 'October 12, 2026', q: 'Q2 FY27 (Unaudited)', agenda: 'Results & Dividend', color: 'text-emerald-700 dark:text-emerald-400' },
                        { symbol: 'HDFCBANK', scrip: '500180', date: 'October 17, 2026', q: 'Q2 FY27 (Unaudited)', agenda: 'Financial Results', color: 'text-purple-700 dark:text-purple-400' },
                        { symbol: 'INFY', scrip: '500209', date: 'October 23, 2026', q: 'Q2 FY27 (Unaudited)', agenda: 'Results & Interim Div', color: 'text-amber-700 dark:text-amber-400' },
                        { symbol: 'RELIANCE', scrip: '500325', date: 'October 24, 2026', q: 'Q2 FY27 (Unaudited)', agenda: 'Results & Dividend', color: 'text-rose-700 dark:text-rose-400' },
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="py-2.5">
                            <div className="font-bold text-slate-900 dark:text-white">{row.symbol}</div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">Scrip {row.scrip}</div>
                          </td>
                          <td className="py-2.5 text-slate-800 dark:text-slate-200 font-semibold">
                            {row.date}
                          </td>
                          <td className="py-2.5 text-slate-700 dark:text-slate-300 font-medium">
                            {row.q}
                          </td>
                          <td className={cn("py-2.5 text-right font-bold text-[11px]", row.color)}>
                            {row.agenda}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span>📅 Updated with official BSE Section 29 notices</span>
                  <button 
                    onClick={() => onEnterTerminal('results-calendar')}
                    className="font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All 200+ Scheduled Meetings</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. FEATURE SECTION 4: INSTANT TELEGRAM ALERTS */}
      <section id="telegram-alerts" className="py-16 sm:py-24 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left: Interactive Telegram Alert Bot Simulator */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="bg-[#1E293B] rounded-2xl border border-slate-700 p-5 sm:p-6 shadow-2xl space-y-4 text-white">
                
                {/* Telegram Header */}
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>BSE Nexus Intelligence Bot</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">@BseNexusBot • bot</div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold bg-blue-900/60 text-blue-300 px-2 py-1 rounded border border-blue-700">
                    DELIVERY ~2s
                  </span>
                </div>

                {/* Simulated Telegram Message Bubble */}
                <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 space-y-2.5 font-sans text-xs sm:text-sm">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-emerald-400">⚡ BREAKING BSE FILING</span>
                    <span className="text-slate-400">12:34:02 PM</span>
                  </div>

                  <div className="font-black text-sm sm:text-base text-white">
                    📊 TATA STEEL LTD (500470) | Q1 RESULTS
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-xl font-mono text-xs space-y-1 text-slate-200 border border-slate-700/60">
                    <p>• <span className="text-emerald-400 font-bold">Revenue:</span> ₹57,084 Cr (+12.4% YoY)</p>
                    <p>• <span className="text-emerald-400 font-bold">Net Profit:</span> ₹1,420 Cr (+24.8% YoY)</p>
                    <p>• <span className="text-purple-400 font-bold">EBITDA Margin:</span> 18.2% (+140 bps YoY)</p>
                    <p>• <span className="text-blue-400 font-bold">Key Driver:</span> Lower UK transition costs & strong India deliveries.</p>
                  </div>

                  {/* Telegram Inline Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={() => onEnterTerminal('dashboard')}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>View in AI Terminal</span>
                    </button>

                    <button 
                      onClick={() => window.open('https://www.bseindia.com', '_blank')}
                      className="py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Official BSE PDF</span>
                    </button>
                  </div>
                </div>

                {/* Keyword Alert Customizer Bar */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                  <span>Keyword Trigger: <span className="text-emerald-400 font-mono font-bold">RESULTS, DIVIDEND, ORDER_WIN</span></span>
                  <span className="text-emerald-400 font-bold">Instant Delivery Active</span>
                </div>

              </div>
            </div>

            {/* Right: Info */}
            <div className="lg:col-span-5 space-y-5 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800">
                <Send className="w-3.5 h-3.5" />
                <span>Feature 04 • Telegram Broadcast</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Instant Telegram alerts for critical corporate filings
              </h2>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Connect your private channel or group. Receive instant markdown-formatted corporate filing summaries delivered directly to Telegram within seconds of exchange publication.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Custom Chat ID & Bot Token Integration</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>High-Priority Filter: Ignore noisy routine filings</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Pro Plan: Unlimited Telegram Channel Broadcasts (₹499/mo after 1-week free trial)</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setIsProModalOpen(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Connect Telegram Bot</span>
                </button>
                <button
                  onClick={() => scrollToSection('pricing')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <span>View Pro Features (100% Free)</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. PRICING SECTION: FREE VS PRO COMPARISON */}
      <section id="pricing" className="py-16 sm:py-24 bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              <Zap className="w-3.5 h-3.5 fill-emerald-500" />
              <span>Launch Special • 100% Free Access</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Fast Filing Alerts, Free For All Early Users
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              We are currently giving 100% free access to all Pro features — including unlimited watchlists, Telegram alerts, and AI financial breakdowns. No credit card required.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
            
            {/* Free Tier Card */}
            <div className="bg-white dark:bg-[#15141E] rounded-3xl border border-slate-200 dark:border-[#2D283E] p-6 sm:p-8 flex flex-col justify-between shadow-xs">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Community Free</h3>
                    <p className="text-xs text-slate-500">For retail traders & individual investors</p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Forever Free
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900 dark:text-white font-mono">₹0</span>
                  <span className="text-xs text-slate-500 font-semibold">/ month</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>BSE announcements, updated continuously</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Full coverage across all 5,000+ BSE Equities</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Standard Gemini AI Financial Summaries</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Custom Ticker Watchlists</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Personal Telegram Alert connection</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Board Meeting & Earnings Calendar</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => onEnterTerminal('dashboard')}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                >
                  <span>Launch Terminal (Free)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pro Tier Card */}
            <div className="bg-white dark:bg-[#1A1926] rounded-3xl border-2 border-emerald-500 p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 font-black text-[10px] px-3.5 py-1 rounded-bl-xl uppercase tracking-wider">
                1-WEEK FREE TRIAL
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Pro Intelligence</span>
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                    </h3>
                    <p className="text-xs text-slate-500">For serious traders, research desks & Telegram channels</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl line-through text-slate-400 font-mono">₹499</span>
                  <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono">₹0</span>
                  <span className="text-xs text-slate-500 font-semibold">/ 1st week (then ₹499/mo)</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold ml-1 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    1 Week Free Trial
                  </span>
                </div>

                <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Everything in Free, plus:</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Unlimited Watchlists & Priority Ticker Groups</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Broadcast to Personal & Channel Telegram</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Unlimited High-Priority Gemini AI Financial Extraction</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Filter & Mute Routine Administrative Filings</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Export Watchlists & Financial Summaries (CSV / JSON)</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => setIsProModalOpen(true)}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Claim 1-Week Free Trial — ₹0</span>
                </button>
              </div>
            </div>

          </div>

          {/* Feature Comparison Matrix Table */}
          <div className="max-w-4xl mx-auto bg-white dark:bg-[#15141E] rounded-2xl border border-slate-200 dark:border-[#2D283E] overflow-hidden shadow-xs">
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#1A1926] border-b border-slate-200 dark:border-[#2D283E]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Detailed Plan Comparison</h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-[#242033] text-xs">
              <div className="grid grid-cols-12 px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-[#171622]">
                <div className="col-span-6 sm:col-span-7">Capability</div>
                <div className="col-span-3 sm:col-span-2 text-center">Free (₹0)</div>
                <div className="col-span-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">Pro (₹499/mo)</div>
              </div>

              {[
                { feature: 'BSE India disclosure ingestion', free: 'Included', pro: 'Included (Priority Server)' },
                { feature: 'Coverage across 5,000+ Listed Scrips', free: 'Full 5,000+', pro: 'Full 5,000+' },
                { feature: 'AI filing summaries', free: 'Standard', pro: 'High-Priority Instant' },
                { feature: 'Watchlist Capacity', free: 'Up to 2 Lists', pro: 'Unlimited Lists' },
                { feature: 'Telegram Notifications', free: '1 Personal Chat', pro: 'Unlimited Channels & Groups' },
                { feature: 'Routine Administrative Filter', free: 'Basic', pro: 'Advanced Smart Mute' },
                { feature: 'Earnings & Board Meeting Calendar', free: 'Included', pro: 'Included + Docket Export' },
                { feature: 'Data Export (Watchlists, CSV)', free: '—', pro: 'Included' },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 px-6 py-3 items-center">
                  <div className="col-span-6 sm:col-span-7 font-medium text-slate-800 dark:text-slate-200">{row.feature}</div>
                  <div className="col-span-3 sm:col-span-2 text-center text-slate-500 font-mono text-[11px]">{row.free}</div>
                  <div className="col-span-3 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">{row.pro}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* 9. BLOG LIST SECTION: MARKET INSIGHTS & BSE GUIDES */}
      <MarketGuidesSection onSelectGuide={(guide) => setSelectedGuide(guide)} />

      {/* 9.2. POPULAR GUIDES SECTION: PLAIN ANCHOR LINKS FOR FAST SEARCH ENGINE DISCOVERY */}
      <section className="py-12 bg-slate-100/70 dark:bg-[#0E131F] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 mb-2">
                <BookOpen className="w-3 h-3" />
                <span>Popular Research Guides</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Popular Guides &amp; Regulatory Manuals
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Essential regulatory playbooks for Dalal Street investors &amp; equity research analysts
              </p>
            </div>
            <a href="/guides" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
              <span>View all research guides</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <a href="/guides/sebi-lodr-regulation-30" className="p-4 rounded-xl bg-white dark:bg-[#15141F] border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all block group">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">SEBI Regulations</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">SEBI LODR Regulation 30: Material Disclosures &amp; Timelines</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Master material event disclosure rules, 30-minute to 24-hour timelines, and market-moving filings.</p>
            </a>
            <a href="/guides/board-meeting-results-guide" className="p-4 rounded-xl bg-white dark:bg-[#15141F] border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all block group">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Corporate Actions</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">BSE Board Meetings &amp; Financial Results: Outcome Guide</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Decode board meeting intimations, dividend approvals, bonus share issues, and quarterly earnings.</p>
            </a>
            <a href="/guides/auditor-resignations-red-flags" className="p-4 rounded-xl bg-white dark:bg-[#15141F] border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all block group">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Forensic Analysis</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">Auditor Resignations: Forensic Red Flags on Dalal Street</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Detect early governance warning signs, mid-term auditor exits, and qualified audit opinions.</p>
            </a>
            <a href="/guides/insider-trading-pit-regulations" className="p-4 rounded-xl bg-white dark:bg-[#15141F] border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all block group">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Compliance</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">SEBI PIT Regulations &amp; Insider Trading Filings Explained</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Track trading window closures, designated person disclosures, and promoter transaction signals.</p>
            </a>
            <a href="/guides/cash-flow-forensics-india" className="p-4 rounded-xl bg-white dark:bg-[#15141F] border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all block group">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Accounting Forensics</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">Cash Flow Forensics: Auditing Indian Corporate Earnings</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Evaluate CFO vs PAT conversion, working capital expansion, and aggressive revenue recognition.</p>
            </a>
            <a href="/guides/bse-quarterly-results-calendar-guide" className="p-4 rounded-xl bg-white dark:bg-[#15141F] border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all block group">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Earnings Calendar</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">BSE Results Calendar Guide: Earnings &amp; Board Meeting Dates</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Track Regulation 29 board meeting notices, Regulation 33 quarterly results, and Limited Review Reports.</p>
            </a>
            <a href="/guides/bse-shareholding-pattern-explained" className="p-4 rounded-xl bg-white dark:bg-[#15141F] border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all block group">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Corporate Governance</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">How to Read BSE Shareholding Patterns: Regulation 31 Guide</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">Decode promoter stakes, promoter share pledges, institutional FII/DII inflows, and retail holding traps.</p>
            </a>
          </div>
        </div>
      </section>

      {/* 9.5. ABOUT BSE NEXUS SECTION */}
      <section id="about" aria-labelledby="about-heading" className="py-16 sm:py-24 bg-white dark:bg-[#0B0F17] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-6 mb-12">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                <Building2 className="w-3.5 h-3.5" />
                <span>Institutional Equity Analytics &amp; AEO Knowledge Base</span>
              </div>
              <h2 id="about-heading" className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                About BSE Nexus: Corporate Filings &amp; Market Intelligence
              </h2>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed space-y-4">
              <p>
                <strong>BSE Nexus</strong> structures corporate announcements, regulatory disclosures, and earnings releases sourced directly from the official portal of the <a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-500">Bombay Stock Exchange (BSE India)</a>. Built for retail investors, equity research analysts, and market participants who track Indian listed companies.
              </p>

              <p>
                The platform continuously monitors regulatory compliance under the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015, specifically capturing material events under Regulation 30 and financial outcome declarations under Regulation 33. All regulatory filings mandated by the <a href="https://www.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-500">Securities and Exchange Board of India (SEBI)</a>—such as dividend declarations, board meeting intimations, mergers and acquisitions, capital expenditure projects, order wins, management transitions, and forensic auditor resignations—are parsed through an automated neural pipeline powered by Gemini AI. This delivers instantaneous extraction of year-over-year (YoY) and quarter-over-quarter (QoQ) revenue, operating EBITDA, and net profit metrics directly from unformatted corporate PDF documents.
              </p>

              <p>
                Beyond the disclosure feed, BSE Nexus maintains an updated <a href="/results-calendar" className="text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-500">Quarterly Results Calendar</a> tracking scheduled board meetings, audited and unaudited earnings declarations, and historical corporate actions across 5,000+ BSE-listed companies. Investors can navigate directly to dedicated company pages—such as <a href="/company/RELIANCE" className="text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-500">Reliance Industries</a>, <a href="/company/TCS" className="text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-500">Tata Consultancy Services (TCS)</a>, and HDFC Bank—to review comprehensive regulatory histories, price metrics, and peer group benchmarks.
              </p>

              <p>
                To empower investors with actionable domain expertise, our <a href="/guides" className="text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-500">Market Research Guides</a> offer step-by-step forensic playbooks on decoding corporate actions, analyzing balance sheets, auditing shareholding patterns under Regulation 31, and interpreting SEBI PIT insider trading disclosures. Users can also configure personalized watchlists and receive Telegram push notifications shortly after target companies submit new filings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#15141F] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
                01
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Continuous Regulatory Ingestion
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                BSE Nexus continuously tracks live regulatory feeds under SEBI LODR Regulation 30 &amp; 33. Announcements from 5,000+ BSE-listed companies are ingested, parsed, and categorized within minutes of filing.
              </p>
              <div className="pt-2">
                <a href="/guides/sebi-lodr-reg-30-disclosures" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                  <span>SEBI Regulation 30 Guide</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#15141F] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
                02
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Gemini AI Financial Extraction
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Our neural parsing pipeline extracts YoY &amp; QoQ Revenue, Operating EBITDA, and Net Profit directly from unformatted corporate PDF filings, allowing investors to digest financial results in seconds.
              </p>
              <div className="pt-2">
                <a href="/guides/reading-quarterly-financial-results" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                  <span>Guide to Reading Results</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#15141F] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
                03
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Multi-Channel Alert Dispatch
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Connect custom watchlists with private Telegram bots to receive immediate push alerts for board meetings, dividends, quarterly earnings, and high-impact disclosures directly on mobile.
              </p>
              <div className="pt-2">
                <a href="/pricing" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                  <span>Explore Free Launch Access</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 p-6 rounded-2xl bg-slate-100/70 dark:bg-[#111622] border border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Entity Notice
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                BSE Nexus is not affiliated with Nexus Select Trust (REIT Scrip: 543913), BSE India Ltd, or SEBI, and is not a SEBI-registered investment adviser.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a href="/faq" className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-500 transition-colors">
                Read FAQ
              </a>
              <a href="/results-calendar" className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-500 transition-colors">
                Earnings Calendar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 10. CTA SECTION: START TRACKING BSE TODAY */}
      <section className="py-16 sm:py-24 bg-slate-900 text-white relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
            <Zap className="w-3.5 h-3.5 fill-emerald-400" />
            <span>Continuous BSE Disclosure Stream • Institutional Grade</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
            Start tracking BSE corporate filings with AI intelligence today
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Join thousands of active investors, equity analysts, and prop desks who use BSE Nexus to capture corporate earnings and critical disclosures before the broader market reacts.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-xl shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Launch Free Live Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onEnterTerminal('watchlists')}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-2"
            >
              <List className="w-4 h-4" />
              <span>Create Custom Watchlist</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Live filing stream</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Free tier forever</span>
            </div>
          </div>

        </div>
      </section>

      {/* Common Questions FAQ Section */}
      <section className="py-12 sm:py-16 bg-slate-50/60 dark:bg-[#0E0C17]/60 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CommonQuestionsFAQ id="homepage-faq" />
        </div>
      </section>

      {/* Follow BSE Nexus Social Community Block */}
      <FollowBseNexusBlock />
      </main>

      {/* 11. FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-400 text-xs py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Brand column */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <BseNexusLogo className="w-7 h-7" />
                <span className="font-black text-base text-slate-900 dark:text-white">
                  BSE<span className="text-emerald-500">NEXUS</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                Advanced financial intelligence platform structuring Bombay Stock Exchange (BSE) corporate filings with AI summaries and Telegram alerts.
              </p>
              {(() => {
                const now = new Date();
                const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
                const istDate = new Date(now.getTime() + istOffsetMs);
                const day = istDate.getUTCDay();
                const mins = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
                const isMarket = day >= 1 && day <= 5 && mins >= 555 && mins <= 930;
                const dynamicStatus = isMarket ? "Live (30s)" : "Relaxed (5m)";
                return (
                  <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>BSE Disclosure Poller: Active ({dynamicStatus})</span>
                  </div>
                );
              })()}

              {/* Official Social Links Row */}
              <div className="pt-2">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Official Channels</p>
                <SocialIconsRow size={22} />
              </div>
            </div>

            {/* Quick Links 1 */}
            <div className="md:col-span-2 space-y-2.5">
              <p className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Terminal</p>
              <ul className="space-y-2">
                <li><button onClick={() => onEnterTerminal('dashboard')} className="hover:text-emerald-500 transition-colors cursor-pointer text-slate-700 dark:text-slate-300">Live Announcements</button></li>
                <li><button onClick={() => onEnterTerminal('watchlists')} className="hover:text-emerald-500 transition-colors cursor-pointer text-slate-700 dark:text-slate-300">Watchlist Manager</button></li>
                <li><button onClick={() => onEnterTerminal('results-calendar')} className="hover:text-emerald-500 transition-colors cursor-pointer text-slate-700 dark:text-slate-300">Earnings Calendar</button></li>
                <li><button onClick={() => onEnterTerminal('settings')} className="hover:text-emerald-500 transition-colors cursor-pointer text-slate-700 dark:text-slate-300">Telegram Webhook</button></li>
              </ul>
            </div>

            {/* Quick Links 2 */}
            <div className="md:col-span-2 space-y-2.5">
              <p className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Resources</p>
              <ul className="space-y-2">
                <li><a href="/about" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">About BSE Nexus</a></li>
                <li><a href="/companies" className="hover:text-emerald-500 transition-colors text-emerald-600 dark:text-emerald-400 font-semibold block">BSE Listed Companies</a></li>
                <li><a href="/pricing" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">Pricing &amp; Plans</a></li>
                <li><a href="/guides" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">Market Research Guides</a></li>
                <li><a href="/faq" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">SEBI Disclosures FAQ</a></li>
                <li><a href="/rss.xml" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">RSS Feed</a></li>
                <li><a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">XML Sitemap</a></li>
                <li><a href="/embed/widget?symbol=RELIANCE" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">Free Embed Widget</a></li>
              </ul>
            </div>

            {/* Compliance & Trust */}
            <div className="md:col-span-3 space-y-2.5">
              <p className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Trust &amp; Legal</p>
              <ul className="space-y-2">
                <li><a href="/about" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">About Us</a></li>
                <li><a href="/contact" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">Contact &amp; Support</a></li>
                <li><a href="/disclaimer" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">Disclaimer</a></li>
                <li><a href="/privacy-policy" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-emerald-500 transition-colors text-slate-700 dark:text-slate-300 block">Terms of Service</a></li>
              </ul>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                BSE Nexus is not affiliated with BSE India Ltd, SEBI, or any exchange; informational use only; not investment advice; verify filings on bseindia.com.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
            <div>© {new Date().getFullYear()} BSE Nexus. Not affiliated with BSE Limited or NSE. Built and operated by Rahul Dahiya (admin@bsenexus.in).</div>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/about" className="hover:text-emerald-500 transition-colors">About</a>
              <span>•</span>
              <a href="/contact" className="hover:text-emerald-500 transition-colors">Contact</a>
              <span>•</span>
              <a href="/disclaimer" className="hover:text-emerald-500 transition-colors">Disclaimer</a>
              <span>•</span>
              <a href="/privacy-policy" className="hover:text-emerald-500 transition-colors">Privacy</a>
              <span>•</span>
              <a href="/terms" className="hover:text-emerald-500 transition-colors">Terms</a>
            </div>
          </div>

        </div>
      </footer>

      {/* Global Blog Reader Modal */}
      {selectedGuide && (
        <BlogReaderModal
          guide={selectedGuide}
          isOpen={!!selectedGuide}
          onClose={() => setSelectedGuide(null)}
          onOpenTerminal={() => {
            setSelectedGuide(null);
            onEnterTerminal('dashboard');
          }}
        />
      )}

    </div>
  );
}
