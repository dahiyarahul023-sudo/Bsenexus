import type { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type HeliosTone = 'emerald' | 'rose' | 'sky' | 'amber' | 'slate' | 'violet';

const toneBg: Record<HeliosTone, string> = {
  emerald: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300',
  rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300',
  sky: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300',
  amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
  slate: 'bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-300',
  violet: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300',
};

const toneDot: Record<HeliosTone, string> = {
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
  violet: 'bg-violet-500',
};

/**
 * Helios status pill — rounded-full badge with a semantic color dot.
 * The shared badge language for every card surface (filings, watchlist,
 * results calendar, news). One accent color per status, muted gray for meta.
 */
export function HeliosPill({
  tone = 'slate',
  dot = true,
  pulseDot = false,
  className,
  children,
  title,
}: {
  tone?: HeliosTone;
  dot?: boolean;
  pulseDot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap select-none',
        toneBg[tone],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', toneDot[tone], pulseDot && 'animate-pulse')} />
      )}
      {children}
    </span>
  );
}

/** Helios card shell — white, large radius, soft shadow (no heavy borders). */
export const heliosCard =
  'bg-white dark:bg-[#1A1926] rounded-[22px] border border-transparent dark:border-[#2D283E] shadow-[0_10px_30px_rgba(15,23,42,0.07)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]';

/** Hairline divider used inside Helios cards. */
export const heliosDivider = 'h-px bg-slate-100 dark:bg-[#262238]';

/** Helios card title — single strong weight jump. */
export const heliosTitle =
  'text-[19px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug';

/** Helios card description — muted gray, relaxed. */
export const heliosDesc = 'text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400';

/** Helios meta/footer text. */
export const heliosMeta = 'text-xs text-slate-400 dark:text-slate-500 font-medium';
