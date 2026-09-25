import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';
import { springElastic, springSnappy } from '../../../utils/motionTokens';
import { cn } from '../../../lib/utils';

interface WatchlistStarButtonProps {
  isSaved: boolean;
  onToggle: () => void | Promise<void>;
  isLoading?: boolean;
  showLabel?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  id?: string;
}

export const WatchlistStarButton: React.FC<WatchlistStarButtonProps> = ({
  isSaved,
  onToggle,
  isLoading = false,
  showLabel = false,
  activeLabel = 'Watching',
  inactiveLabel = 'Watch',
  size = 'sm',
  className = '',
  id,
}) => {
  const [isSparkling, setIsSparkling] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    setIsSparkling(true);
    setTimeout(() => setIsSparkling(false), 600);
    onToggle();
  };

  const sizeStyles = {
    xs: {
      btn: 'min-h-[34px] sm:min-h-[28px] px-2 py-1 text-[11px] gap-1 rounded-lg touch-manipulation',
      star: 12,
    },
    sm: {
      btn: 'min-h-[38px] sm:min-h-[34px] px-2.5 py-1.5 text-xs gap-1.5 rounded-xl touch-manipulation',
      star: 14,
    },
    md: {
      btn: 'min-h-[44px] sm:min-h-[40px] px-3.5 py-2 text-xs font-bold gap-2 rounded-xl touch-manipulation',
      star: 16,
    },
  }[size];

  return (
    <motion.button
      id={id}
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.84 }}
      transition={springSnappy}
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
      title={isSaved ? 'In your Watchlist (Tap to remove)' : 'Add to Watchlist'}
      className={cn(
        "relative inline-flex items-center justify-center font-bold transition-colors select-none cursor-pointer border",
        isSaved
          ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-xs"
          : "bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] dark:hover:bg-[#2F2B40] text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-[#352F48]",
        sizeStyles.btn,
        className
      )}
    >
      {/* Expanding Ripple Ring on Toggle */}
      <AnimatePresence>
        {isSparkling && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0.8 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0 rounded-xl border-2 border-amber-400 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Physics-based Pop Star Icon */}
      <motion.div
        animate={
          isSaved
            ? {
                scale: 1.16,
                rotate: 10,
              }
            : {
                scale: 1,
                rotate: 0,
              }
        }
        transition={springElastic}
        className="flex items-center justify-center"
      >
        <Star
          size={sizeStyles.star}
          className={cn(
            "transition-all duration-200",
            isSaved
              ? "fill-amber-400 text-amber-500 drop-shadow-[0_1px_3px_rgba(251,191,36,0.4)]"
              : "text-slate-400 dark:text-slate-400 group-hover:text-amber-400"
          )}
        />
      </motion.div>

      {/* Label with Vertical Slide */}
      {showLabel && (
        <span className="relative overflow-hidden inline-block leading-tight">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isSaved ? 'saved' : 'unsaved'}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={springSnappy}
              className="inline-block"
            >
              {isSaved ? activeLabel : inactiveLabel}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </motion.button>
  );
};
