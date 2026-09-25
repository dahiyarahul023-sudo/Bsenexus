import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, CheckCircle2 } from 'lucide-react';
import { springSnappy } from '../../utils/motionTokens';

interface ScrollRestoredPillProps {
  restoredY: number | null;
  onScrollToTop?: () => void;
}

export function ScrollRestoredPill({ restoredY, onScrollToTop }: ScrollRestoredPillProps) {
  if (!restoredY || restoredY < 180) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.95 }}
        transition={springSnappy}
        className="fixed bottom-16 sm:bottom-6 left-4 z-40 select-none pointer-events-auto"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-[#1E1B2E]/95 text-white border border-slate-700/60 dark:border-emerald-500/30 shadow-lg backdrop-blur-md text-[11px] font-semibold">
          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
          <span>Restored to position ({Math.round(restoredY)}px)</span>
          {onScrollToTop && (
            <button
              type="button"
              onClick={onScrollToTop}
              className="ml-1 pl-1.5 border-l border-slate-700 dark:border-slate-600/60 flex items-center gap-0.5 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Jump to Top"
            >
              <ArrowUp size={11} />
              <span className="text-[10px]">Top</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
