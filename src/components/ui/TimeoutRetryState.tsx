import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export interface TimeoutRetryStateProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
  isRetrying?: boolean;
  className?: string;
}

export const TimeoutRetryState: React.FC<TimeoutRetryStateProps> = ({
  title = "We couldn't reach the server in time",
  message = "The BSE stream or analysis service took longer than expected. Your session and saved data are safe.",
  onRetry,
  onBack,
  retryLabel = "Try again",
  backLabel = "Go back",
  isRetrying = false,
  className = ""
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`p-6 sm:p-7 rounded-2xl border border-slate-200/90 dark:border-rose-950/50 bg-white dark:bg-[#161422] text-left space-y-4 max-w-md mx-auto shadow-sm ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
        <AlertTriangle size={20} />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {message}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
        >
          <RefreshCw size={13} className={isRetrying ? "animate-spin" : ""} />
          <span>{isRetrying ? "Retrying..." : retryLabel}</span>
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#221E31] border border-slate-200 dark:border-[#332D48] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>{backLabel}</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};
