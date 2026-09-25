import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Text shown during default state */
  children: React.ReactNode;
  /** Text shown immediately once pressed / loading (e.g. "Syncing...", "Placing...") */
  loadingText?: string;
  /** External loading boolean */
  isLoading?: boolean;
  /** Success message or transient state */
  successText?: string;
  /** Async or sync on-click callback */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void;
  /** Minimum lock time in ms to avoid double taps */
  cooldownMs?: number;
  /** Variant */
  variant?: 'primary' | 'secondary' | 'emerald' | 'danger' | 'ghost';
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  loadingText = 'Processing...',
  isLoading: externalIsLoading,
  successText,
  onClick,
  cooldownMs = 400,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const [justSucceeded, setJustSucceeded] = useState(false);

  const isBusy = externalIsLoading !== undefined ? externalIsLoading : internalIsLoading;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isBusy || disabled) return;

    // Instant acknowledge in <100ms: lock immediately!
    setInternalIsLoading(true);

    try {
      if (onClick) {
        await onClick(e);
      }
      if (successText) {
        setJustSucceeded(true);
        setTimeout(() => setJustSucceeded(false), 1800);
      }
    } finally {
      // Release after minimum cooldown to prevent double taps
      setTimeout(() => {
        setInternalIsLoading(false);
      }, cooldownMs);
    }
  };

  const variantStyles = {
    primary: 'bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-xs',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
    secondary: 'bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] dark:hover:bg-[#312C44] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#38324E]',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-[#201E2E] text-slate-700 dark:text-slate-300'
  }[variant];

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5 min-h-[38px] sm:min-h-[32px] touch-manipulation',
    md: 'px-3.5 py-2 text-xs sm:text-sm gap-2 min-h-[44px] sm:min-h-[40px] touch-manipulation',
    lg: 'px-5 py-2.5 text-sm sm:text-base gap-2.5 min-h-[48px] sm:min-h-[46px] touch-manipulation'
  }[size];

  return (
    <motion.button
      whileTap={!disabled && !isBusy ? { scale: 0.96 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      onClick={handleClick}
      disabled={disabled || isBusy}
      className={`relative inline-flex items-center justify-center font-bold rounded-xl transition-colors cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed active:outline-hidden ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {justSucceeded ? (
        <>
          <Check size={size === 'sm' ? 13 : 15} className="text-emerald-300 animate-in zoom-in-50 duration-150" />
          <span>{successText}</span>
        </>
      ) : isBusy ? (
        <>
          <RefreshCw size={size === 'sm' ? 13 : 15} className="animate-spin text-current opacity-80" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </motion.button>
  );
};
