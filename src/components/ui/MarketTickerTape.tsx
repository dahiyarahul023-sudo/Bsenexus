import React, { useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Clock, Activity, ShieldAlert, Sparkles } from 'lucide-react';
import { useMarketIndices, MarketIndexItem } from '../../hooks/useMarketIndices';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarketTickerTapeProps {
  className?: string;
  showStatusBadge?: boolean;
  compact?: boolean;
  bseLatency?: number;
}

export function MarketTickerTape({ 
  className = '', 
  showStatusBadge = true,
  compact = false,
  bseLatency = 85
}: MarketTickerTapeProps) {
  const { indices, isMarketOpen, marketSession, marketStatusText, sessionBadge, loading, refresh } = useMarketIndices();
  const [isHovered, setIsHovered] = useState(false);

  const formatPrice = (idx: MarketIndexItem) => {
    if (idx.price === undefined || idx.price === null) return '--';
    if (idx.category === 'VOLATILITY') {
      return idx.price.toFixed(2);
    }
    if (idx.category === 'CURRENCY') {
      return `₹${idx.price.toFixed(2)}`;
    }
    return idx.price.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getChangeValues = (idx: MarketIndexItem) => {
    let change = idx.change;
    let pct = idx.changePercent;

    if ((change === 0 || change === undefined) && idx.previousClose && idx.previousClose > 0 && idx.price) {
      change = idx.price - idx.previousClose;
      if (pct === 0 || pct === undefined) {
        pct = (change / idx.previousClose) * 100;
      }
    }
    return { change: change || 0, pct: pct || 0 };
  };

  const formatChange = (idx: MarketIndexItem) => {
    const { change, pct } = getChangeValues(idx);
    const sign = change > 0 ? '+' : '';
    const pctSign = pct > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${pctSign}${pct.toFixed(2)}%)`;
  };

  const getSessionBadgeStyle = () => {
    switch (marketSession) {
      case 'REGULAR':
        return {
          dotBg: 'bg-emerald-500',
          ping: true,
          label: 'BSE/NSE LIVE',
          color: 'text-emerald-600 dark:text-emerald-400',
          badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
        };
      case 'CLOSING_WINDOW_10MIN':
        return {
          dotBg: 'bg-amber-500',
          ping: true,
          label: '10-MIN POST-CLOSE',
          color: 'text-amber-600 dark:text-amber-400',
          badgeBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
        };
      case 'POST_MARKET':
        return {
          dotBg: 'bg-sky-500',
          ping: false,
          label: 'POST-CLOSE TRADE',
          color: 'text-sky-600 dark:text-sky-400',
          badgeBg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60'
        };
      case 'PRE_MARKET':
        return {
          dotBg: 'bg-cyan-500',
          ping: true,
          label: 'PRE-MARKET',
          color: 'text-cyan-600 dark:text-cyan-400',
          badgeBg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/60'
        };
      default:
        return {
          dotBg: 'bg-slate-400',
          ping: false,
          label: sessionBadge || 'MARKET CLOSED',
          color: 'text-slate-700 dark:text-slate-300',
          badgeBg: 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
        };
    }
  };

  const sessionStyle = getSessionBadgeStyle();

  // Create duplicate array for seamless infinite looping
  const tickerItems = [...indices, ...indices];

  return (
    <div 
      className={cn(
        "bg-slate-100/95 dark:bg-[#111019] text-slate-800 dark:text-slate-300 border-b border-slate-200/90 dark:border-[#252236] text-[11px] font-mono py-1.5 px-2 sm:px-4 overflow-hidden relative select-none transition-colors group backdrop-blur-md",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Feed Status & Live Radar */}
        {showStatusBadge && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10 bg-slate-100/95 dark:bg-[#111019] pr-2 sm:pr-3 border-r border-slate-200 dark:border-[#2A263D]">
            <span className="relative flex h-2 w-2">
              {sessionStyle.ping && (
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", sessionStyle.dotBg)} />
              )}
              <span className={cn("relative inline-flex rounded-full h-2 w-2", sessionStyle.dotBg)} />
            </span>
            <span className={cn("font-extrabold uppercase tracking-wider text-[9.5px] sm:text-[10px]", sessionStyle.color)}>
              {sessionStyle.label}
            </span>
            <span 
              className="text-[10px] text-slate-700 dark:text-slate-300 hidden lg:inline max-w-[200px] truncate"
              title={marketStatusText}
            >
              • {marketStatusText}
            </span>
          </div>
        )}

        {/* Center: Seamless Infinite Smooth Auto-Scrolling Ticker (All Viewports) */}
        <div className="flex-1 overflow-hidden relative flex items-center">
          {/* Subtle fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-3 sm:w-4 bg-gradient-to-r from-slate-100 dark:from-[#111019] to-transparent z-1 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-3 sm:w-4 bg-gradient-to-l from-slate-100 dark:from-[#111019] to-transparent z-1 pointer-events-none" />

          <div 
            className="animate-ticker-smooth flex items-center gap-4 sm:gap-7 py-0.5 tabular-nums"
            style={{ animationPlayState: isHovered ? 'paused' : 'running' }}
          >
            {tickerItems.map((idx, i) => {
              const { change } = getChangeValues(idx);
              const isPositive = change >= 0;
              const isVix = idx.category === 'VOLATILITY';

              return (
                <div 
                  key={`${idx.id}-${i}`} 
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap px-2 py-1 rounded-md transition-all cursor-pointer hover:bg-slate-200/70 dark:hover:bg-[#1E1B2C]",
                    idx.tick === 'UP' && "tick-flash-up",
                    idx.tick === 'DOWN' && "tick-flash-down"
                  )}
                  title={`${idx.description || idx.name} | High: ${idx.dayHigh !== undefined ? formatPrice({ ...idx, price: idx.dayHigh }) : '--'} | Low: ${idx.dayLow !== undefined ? formatPrice({ ...idx, price: idx.dayLow }) : '--'}`}
                >
                  <span className="text-slate-700 dark:text-slate-300 font-bold text-[10px] sm:text-[10.5px]">
                    {idx.name}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-[10.5px] sm:text-[11px] tracking-tight font-mono">
                    {formatPrice(idx)}
                  </span>
                  <span className={cn(
                    "font-bold text-[9.5px] sm:text-[10px] flex items-center gap-0.5 font-mono",
                    isPositive 
                      ? isVix ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                      : isVix ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {isPositive ? <TrendingUp className="w-2.5 h-2.5 inline" /> : <TrendingDown className="w-2.5 h-2.5 inline" />}
                    {formatChange(idx)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Manual Refresh & Coverage Pill */}
        <div className="flex items-center gap-2 shrink-0 z-10 bg-slate-100/95 dark:bg-[#111019] pl-2 sm:pl-3 border-l border-slate-200 dark:border-[#2A263D]">
          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh Live Market Data"
            className="p-1.5 rounded-md bg-white dark:bg-[#1D1B2B] hover:bg-slate-200/80 dark:hover:bg-[#2A263D] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer border border-slate-200 dark:border-[#2D283E] active:scale-[0.96] disabled:opacity-50 min-w-[36px] min-h-[36px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center shadow-2xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 sm:w-3 sm:h-3", loading && "animate-spin text-emerald-500 dark:text-emerald-400")} />
          </button>
          {!compact && (
            <div className="hidden xl:flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-[10px]">
              <span className="text-slate-700 dark:text-slate-300 font-bold">COVERAGE:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">BSE 30 & 5,000+ EQUITIES</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
