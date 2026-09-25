import React from 'react';
import { motion } from 'framer-motion';
import { springSmoothPill, buttonTap } from '../../../utils/motionTokens';
import { cn } from '../../../lib/utils';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SlidingTabListProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function SlidingTabList<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId = 'activeSlidingPill',
  className = '',
  size = 'md',
}: SlidingTabListProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-[#161422] border border-slate-200/80 dark:border-[#2D283E] rounded-xl overflow-x-auto no-scrollbar select-none",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <motion.button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            whileTap={buttonTap}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap rounded-lg select-none",
              size === 'sm' ? "min-h-[30px] px-2.5 py-1 text-xs" : "min-h-[36px] px-3.5 py-1.5 text-xs sm:text-sm",
              isActive
                ? "text-slate-900 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            {/* Sliding Pill Indicator */}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={springSmoothPill}
                className="absolute inset-0 z-[-1] rounded-lg bg-white dark:bg-[#28243A] shadow-xs border border-slate-200/60 dark:border-[#3D3754]"
              />
            )}

            {tab.icon && (
              <motion.span
                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                transition={springSmoothPill}
                className="flex items-center justify-center"
              >
                {tab.icon}
              </motion.span>
            )}

            <span>{tab.label}</span>

            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full",
                  isActive
                    ? "bg-slate-100 dark:bg-[#342F4B] text-slate-900 dark:text-white"
                    : "bg-slate-200/80 dark:bg-[#201E2E] text-slate-600 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
