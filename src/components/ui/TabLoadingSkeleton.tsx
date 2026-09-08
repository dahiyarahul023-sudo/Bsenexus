import React from 'react';

interface TabLoadingSkeletonProps {
  type?: 'feed' | 'calendar' | 'watchlist' | 'news' | 'default';
}

export function TabLoadingSkeleton({ type = 'default' }: TabLoadingSkeletonProps) {
  return (
    <div className="w-full space-y-4 animate-in fade-in duration-150 py-2">
      {/* Top action/filter skeleton row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-200/70 dark:bg-[#1A1926] rounded-lg animate-pulse" />
          <div className="h-8 w-20 bg-slate-200/50 dark:bg-[#1A1926]/70 rounded-lg animate-pulse hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-36 bg-slate-200/60 dark:bg-[#1A1926] rounded-lg animate-pulse" />
          <div className="h-8 w-8 bg-slate-200/60 dark:bg-[#1A1926] rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Main content skeleton items */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div 
            key={idx} 
            className="p-4 rounded-xl border border-slate-200/60 dark:border-[#2D283E]/60 bg-white/60 dark:bg-[#15141E]/60 space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-4 w-12 bg-emerald-500/20 rounded" />
              </div>
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-4 w-3/4 bg-slate-200/80 dark:bg-slate-800/80 rounded" />
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800/40 rounded" />
            <div className="flex items-center justify-between pt-1">
              <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/50 rounded" />
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
