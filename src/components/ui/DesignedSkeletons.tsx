import React from 'react';

/**
 * CompanyHubSkeleton - Mirrors the exact shape of CompanyIntelligenceModal
 * Top stats, valuation pills, and announcement history cards.
 */
export const CompanyHubSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Top Banner Metric Row */}
      <div className="p-4 rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-white dark:bg-[#181624] space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3.5 w-28 bg-slate-200/70 dark:bg-slate-800/70 rounded" />
          </div>
          <div className="h-8 w-24 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-lg" />
        </div>

        {/* 4-column metric pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-[#14131E] space-y-1">
              <div className="h-2.5 w-14 bg-slate-200/80 dark:bg-slate-800/80 rounded" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Announcements / Intel List Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl border border-slate-200/70 dark:border-[#2D283E]/70 bg-white dark:bg-[#181624] space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-3/5 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-16 bg-slate-200/80 dark:bg-slate-800/80 rounded" />
            </div>
            <div className="h-3 w-4/5 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * AiSummarySkeleton - Mirrors the exact shape of Executive AI Takeaway & YoY breakdown
 */
export const AiSummarySkeleton: React.FC = () => {
  return (
    <div className="space-y-3.5 animate-pulse min-h-[220px]">
      {/* Executive Callout */}
      <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-purple-400/50" />
          <div className="h-3.5 w-36 bg-purple-300/60 dark:bg-purple-800/60 rounded" />
        </div>
        <div className="space-y-1.5 pt-1">
          <div className="h-3 w-full bg-purple-200/60 dark:bg-purple-900/40 rounded" />
          <div className="h-3 w-5/6 bg-purple-200/60 dark:bg-purple-900/40 rounded" />
          <div className="h-3 w-3/4 bg-purple-200/60 dark:bg-purple-900/40 rounded" />
        </div>
      </div>

      {/* 2-Card Metric Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-slate-50/80 dark:bg-[#15141E] space-y-2">
          <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-6 w-32 bg-emerald-500/20 rounded" />
          <div className="h-2.5 w-full bg-slate-200/70 dark:bg-slate-800/70 rounded" />
        </div>
        <div className="p-3 rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-slate-50/80 dark:bg-[#15141E] space-y-2">
          <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-6 w-32 bg-sky-500/20 rounded" />
          <div className="h-2.5 w-full bg-slate-200/70 dark:bg-slate-800/70 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * NewsFeedSkeleton - Mirrors news portal headlines and tags
 */
export const NewsFeedSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-white dark:bg-[#181624] space-y-2.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-20 bg-slate-200/80 dark:bg-slate-800/80 rounded" />
            <div className="h-3 w-16 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
          </div>
          <div className="h-4 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3 w-full bg-slate-200/60 dark:bg-slate-800/60 rounded" />
        </div>
      ))}
    </div>
  );
};
