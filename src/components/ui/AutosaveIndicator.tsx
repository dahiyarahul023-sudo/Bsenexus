import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, CloudCheck, HardDrive } from 'lucide-react';
import { springSnappy } from '../../utils/motionTokens';

interface AutosaveIndicatorProps {
  className?: string;
}

export function AutosaveIndicator({ className = '' }: AutosaveIndicatorProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  useEffect(() => {
    // Listen for custom autosave triggers from watchlists, settings, or filters
    const handleAutosave = (e: any) => {
      setSaveStatus('saving');
      setTimeout(() => {
        setSaveStatus('saved');
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        setLastSavedTime(timeStr);
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      }, 400);
    };

    window.addEventListener('bse-autosave', handleAutosave);
    return () => window.removeEventListener('bse-autosave', handleAutosave);
  }, []);

  if (saveStatus === 'idle' && !lastSavedTime) return null;

  return (
    <AnimatePresence>
      {(saveStatus !== 'idle' || lastSavedTime) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={springSnappy}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold select-none border transition-colors ${
            saveStatus === 'saving'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              : saveStatus === 'saved'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-slate-100 dark:bg-[#252233] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#352F48]'
          } ${className}`}
          title={lastSavedTime ? `Autosaved locally at ${lastSavedTime}` : 'All changes saved locally'}
        >
          {saveStatus === 'saving' ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check size={11} className="text-emerald-500 shrink-0" />
              <span className="font-mono">Saved {lastSavedTime ? lastSavedTime : 'locally'}</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
