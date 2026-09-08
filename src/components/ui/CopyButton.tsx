import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { springSnappy } from '../../utils/motionTokens';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function CopyButton({
  text,
  label,
  copiedLabel = 'Copied',
  className = '',
  size = 'xs',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const sizeClasses = {
    xs: 'text-[11px] px-2 py-1 gap-1',
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3 py-2 gap-2',
  }[size];

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 16,
  }[size];

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      transition={springSnappy}
      onClick={handleCopy}
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className={`inline-flex items-center rounded-lg border transition-all cursor-pointer select-none font-semibold ${
        copied
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          : 'bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border-slate-200/90 dark:border-[#352F48] text-slate-600 dark:text-slate-300'
      } ${sizeClasses} ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={springSnappy}
            className="flex items-center gap-1"
          >
            <Check size={iconSizes} className="text-emerald-500" />
            {label !== undefined && <span>{copiedLabel}</span>}
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={springSnappy}
            className="flex items-center gap-1"
          >
            <Copy size={iconSizes} />
            {label !== undefined && <span>{label}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
