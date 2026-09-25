import React from 'react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isPulling: boolean;
  isRefreshing: boolean;
  progress: number;
  label?: string;
}

const CIRCUMFERENCE = 56.55; // 2 * Math.PI * 9

export function PullToRefreshIndicator({
  pullDistance,
  isPulling,
  isRefreshing,
  progress,
  label = "Feed"
}: PullToRefreshIndicatorProps) {
  // Hide completely when at 0 and not refreshing
  if (pullDistance <= 0 && !isRefreshing) return null;

  const isArmed = progress >= 1;
  // Resting height when actively refreshing
  const displayHeight = isRefreshing ? 52 : Math.max(0, pullDistance);
  const opacity = isRefreshing ? 1 : Math.min(1, Math.max(0.1, progress * 1.3));
  const scale = isRefreshing ? 1 : Math.min(1, 0.7 + progress * 0.3);

  // SVG arc math: Stretch -> Full Ring -> Spinner
  const strokeOffset = isRefreshing 
    ? 0 
    : CIRCUMFERENCE * (1 - Math.min(1, progress));

  return (
    <div
      className="flex items-center justify-center overflow-hidden w-full select-none pointer-events-none z-20"
      style={{
        height: `${displayHeight}px`,
        transition: isPulling 
          ? 'none' 
          : isRefreshing 
            ? 'height 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease'
            : 'height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease',
        opacity
      }}
    >
      <div 
        className="flex items-center justify-center py-1.5"
        style={{
          transform: `scale(${scale})`,
          transition: isPulling ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
      >
        {/* Apple-grade Frosted Glass Pull Capsule */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xs backdrop-blur-md transition-all duration-200 ${
          isArmed || isRefreshing 
            ? 'bg-white/95 dark:bg-[#1E1B2E]/95 border-emerald-500/40 dark:border-emerald-500/40 ring-2 ring-emerald-500/15' 
            : 'bg-white/90 dark:bg-[#1A1826]/90 border-slate-200/90 dark:border-[#352F48]'
        }`}>
          {/* Circular SVG: Stretch becomes Spinner */}
          <div className="relative w-5 h-5 flex items-center justify-center">
            <svg 
              className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              style={{
                transform: !isRefreshing ? `rotate(${progress * 180 - 90}deg)` : undefined,
                animationDuration: '720ms'
              }}
            >
              {/* Background faint track */}
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-slate-200 dark:text-zinc-700/80"
              />

              {/* Dynamic Stretch/Spinner Arc */}
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={isRefreshing ? "38 18" : `${CIRCUMFERENCE}`}
                strokeDashoffset={strokeOffset}
                className={`transition-colors duration-150 ${
                  isArmed || isRefreshing
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              />
            </svg>
          </div>

          {/* Dynamic contextual state hint */}
          <span className={`text-[11px] font-bold tracking-tight select-none whitespace-nowrap transition-colors duration-150 ${
            isArmed || isRefreshing 
              ? 'text-emerald-600 dark:text-emerald-400' 
              : 'text-slate-600 dark:text-slate-300'
          }`}>
            {isRefreshing 
              ? `Syncing ${label}...` 
              : isArmed 
                ? 'Release to refresh' 
                : `Pull down to refresh`}
          </span>
        </div>
      </div>
    </div>
  );
}
