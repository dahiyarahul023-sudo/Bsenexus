import React from 'react';

export function DashboardLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#12131C] text-slate-800 dark:text-slate-200 flex flex-col font-sans">
      {/* Top Main Navigation Bar Skeleton */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#15141F]/95 border-b border-slate-200/90 dark:border-[#2D283E]/80 backdrop-blur-md h-14 flex items-center px-4 sm:px-6">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo Skeleton */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-80" />
            <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded font-black" />
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">15s Live Feed</span>
            </div>
          </div>

          {/* Desktop Nav Skeleton */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-[#1E1C2B] p-1 rounded-xl">
            <div className="h-7 w-16 bg-white dark:bg-[#2A273C] rounded-lg shadow-2xs" />
            <div className="h-7 w-16 bg-transparent rounded-lg" />
            <div className="h-7 w-20 bg-transparent rounded-lg" />
            <div className="h-7 w-24 bg-transparent rounded-lg" />
            <div className="h-7 w-16 bg-transparent rounded-lg" />
          </div>

          {/* Right Action Icons Skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-[#1E1C2B] animate-pulse" />
            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-[#1E1C2B] animate-pulse" />
            <div className="h-8 w-20 rounded-lg bg-emerald-500/20 animate-pulse hidden sm:block" />
          </div>
        </div>
      </header>

      {/* Ticker Tape Bar Skeleton */}
      <div className="h-7 bg-slate-100/70 dark:bg-[#0D0C15] border-b border-slate-200/60 dark:border-[#2D283E]/40 flex items-center px-4 overflow-hidden">
        <div className="flex items-center gap-8 animate-pulse text-xs text-slate-400">
          <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4 animate-in fade-in duration-150">
        {/* Top filter row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-8 w-28 bg-slate-200/80 dark:bg-[#1E1C2B] rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-slate-200/60 dark:bg-[#1E1C2B]/60 rounded-lg animate-pulse hidden sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-44 bg-slate-200/70 dark:bg-[#1E1C2B] rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-slate-200/70 dark:bg-[#1E1C2B] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Content Cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div 
              key={i}
              className="p-4 rounded-2xl border border-slate-200/80 dark:border-[#2D283E]/80 bg-white dark:bg-[#15141E] space-y-3 shadow-2xs animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-4 w-16 bg-emerald-500/15 rounded" />
                </div>
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              <div className="h-4 w-4/5 bg-slate-200/90 dark:bg-slate-800/90 rounded" />
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded" />
              <div className="flex items-center justify-between pt-1">
                <div className="h-3 w-28 bg-slate-100 dark:bg-slate-900 rounded" />
                <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default DashboardLayoutSkeleton;
