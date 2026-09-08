import React from 'react';

interface ComponentSkeletonProps {
  type?: 'modal' | 'card' | 'section' | 'chart';
}

export function ComponentSkeleton({ type = 'card' }: ComponentSkeletonProps) {
  if (type === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div className="w-full max-w-2xl bg-white dark:bg-[#15141E] border border-slate-200 dark:border-[#2D283E] rounded-2xl p-6 space-y-4 animate-pulse">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-6 w-6 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-4 w-3/4 bg-slate-200/80 dark:bg-slate-800/80 rounded" />
            <div className="h-4 w-1/2 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
            <div className="h-24 w-full bg-slate-100 dark:bg-slate-900 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className="w-full h-64 bg-slate-100/70 dark:bg-[#1A1926]/70 border border-slate-200/60 dark:border-[#2D283E]/60 rounded-2xl p-4 flex flex-col justify-between animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="flex items-end gap-2 h-36 pt-4 px-2">
          {[40, 65, 30, 85, 55, 75, 90, 45, 60, 80, 50, 70].map((h, i) => (
            <div 
              key={i} 
              className="flex-1 bg-emerald-500/20 dark:bg-emerald-500/15 rounded-t"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-8 space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-[#15141E]/60 space-y-3">
            <div className="h-4 w-24 bg-emerald-500/20 rounded" />
            <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-12 w-full bg-slate-100 dark:bg-slate-900 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ComponentSkeleton;
