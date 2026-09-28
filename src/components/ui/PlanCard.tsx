import React from 'react';
import { Check } from 'lucide-react';

/**
 * PlanCard — the single shared payment/plan card for the whole app.
 *
 * Implements the "Design Cheatsheet" system: monochrome discipline
 * (near-black / white / grays only), hairline 1px borders, generous
 * 24px padding on a strict 4px spacing grid, tight-tracked large price,
 * full-width pill CTA, and thin-checkmark feature rows.
 *
 * Two modes:
 *  - display (default): title → subtitle → price → CTA → features
 *  - selectable: the whole card is a picker button (checkout plan list);
 *    no CTA, radio indicator + selected ring instead.
 *
 * Prices/durations/tags must come from src/config/plans.ts — never
 * hardcode them at the call site.
 */
export interface PlanCardFeature {
  title: string;
  desc?: string;
}

interface PlanCardProps {
  title: string;
  subtitle?: string;
  currencySymbol?: string;
  price: string;
  priceSuffix?: string;
  wasPrice?: string;
  tag?: string;
  sub?: string;
  features?: (PlanCardFeature | string)[];
  ctaLabel?: React.ReactNode;
  onCta?: () => void;
  ctaLoading?: boolean;
  ctaLoadingText?: string;
  ctaDisabled?: boolean;
  footnote?: React.ReactNode;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  title,
  subtitle,
  currencySymbol = '₹',
  price,
  priceSuffix,
  wasPrice,
  tag,
  sub,
  features = [],
  ctaLabel,
  onCta,
  ctaLoading = false,
  ctaLoadingText,
  ctaDisabled = false,
  footnote,
  selectable = false,
  selected = false,
  onSelect,
  className = '',
}) => {
  const featureList = features.map((f) =>
    typeof f === 'string' ? { title: f } : f
  );

  const card = (
    <>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[20px] font-medium tracking-[-0.02em] text-[#121212] dark:text-white leading-tight">
            {title}
          </h3>
          {tag && (
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
              {tag}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#7B7B7B] dark:text-zinc-400">
            {subtitle}
          </p>
        )}
      </div>

      {/* Price row */}
      <div>
        <div className="flex items-end gap-1.5">
          {wasPrice && (
            <span className="text-[15px] text-[#7B7B7B] dark:text-zinc-500 line-through font-medium mb-2">
              {currencySymbol}{wasPrice}
            </span>
          )}
          <span className="text-[15px] text-[#7B7B7B] dark:text-zinc-400 font-medium mb-2">
            {currencySymbol}
          </span>
          <span className="text-[40px] leading-none font-medium tracking-[-0.03em] text-[#121212] dark:text-white">
            {price}
          </span>
          {priceSuffix && (
            <span className="text-[12px] leading-tight text-[#7B7B7B] dark:text-zinc-400 font-normal mb-1">
              {priceSuffix}
            </span>
          )}
        </div>
        {sub && (
          <p className="mt-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
            {sub}
          </p>
        )}
      </div>

      {/* CTA (display mode only) */}
      {!selectable && ctaLabel && (
        <button
          type="button"
          onClick={onCta}
          disabled={ctaDisabled || ctaLoading}
          className="w-full h-12 rounded-full bg-[#121212] dark:bg-white text-white dark:text-black text-[15px] font-medium tracking-[-0.01em] hover:opacity-85 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {ctaLoading ? (ctaLoadingText || 'Please wait…') : ctaLabel}
        </button>
      )}

      {/* Feature list */}
      {featureList.length > 0 && (
        <ul className="space-y-3">
          {featureList.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Check
                size={20}
                strokeWidth={1.5}
                className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-[1px]"
              />
              <span className="text-[13px] leading-relaxed text-[#121212] dark:text-zinc-200">
                <span className="font-medium">{f.title}</span>
                {f.desc && (
                  <span className="block text-[#7B7B7B] dark:text-zinc-400 font-normal mt-0.5">
                    {f.desc}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Footnote */}
      {footnote && (
        <div className="text-[11px] leading-relaxed text-[#7B7B7B] dark:text-zinc-500 text-center">
          {footnote}
        </div>
      )}
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full text-left rounded-[20px] border bg-[#FCFCFC] dark:bg-[#16161B] p-6 flex flex-col gap-5 transition-all cursor-pointer ${
          selected
            ? 'border-[#121212] dark:border-white border-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
            : 'border-[#E2E2E2] dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-[#c9c9c9] dark:hover:border-white/25'
        } ${className}`}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-[17px] font-medium tracking-[-0.02em] text-[#121212] dark:text-white">
              {title}
            </span>
            {tag && (
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
                {tag}
              </span>
            )}
          </span>
          <span
            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              selected
                ? 'border-[#121212] dark:border-white bg-[#121212] dark:bg-white'
                : 'border-[#c9c9c9] dark:border-zinc-600 bg-transparent'
            }`}
          >
            {selected && (
              <Check size={12} strokeWidth={3} className="text-white dark:text-black" />
            )}
          </span>
        </span>
        <span>
          <span className="flex items-end gap-1.5">
            <span className="text-[15px] text-[#7B7B7B] dark:text-zinc-400 font-medium mb-1.5">
              {currencySymbol}
            </span>
            <span className="text-[32px] leading-none font-medium tracking-[-0.03em] text-[#121212] dark:text-white">
              {price}
            </span>
            {priceSuffix && (
              <span className="text-[12px] leading-tight text-[#7B7B7B] dark:text-zinc-400 mb-1">
                {priceSuffix}
              </span>
            )}
          </span>
          {sub && (
            <span className="block mt-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
              {sub}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <div
      className={`rounded-[20px] border border-[#E2E2E2] dark:border-white/10 bg-[#FCFCFC] dark:bg-[#16161B] p-6 flex flex-col gap-6 shadow-[0_2px_12px_rgba(0,0,0,0.05)] ${className}`}
    >
      {card}
    </div>
  );
};
