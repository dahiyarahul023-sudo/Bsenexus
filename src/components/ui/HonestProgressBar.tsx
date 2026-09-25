import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface HonestStep {
  label: string;
  durationMs?: number;
}

export interface HonestProgressBarProps {
  /** Optional current percentage (0 to 100). If not provided, it can auto-advance through steps. */
  progress?: number;
  /** Current step description or active step label */
  activeStepLabel?: string;
  /** Step number, e.g. 2 */
  currentStep?: number;
  /** Total steps, e.g. 4 */
  totalSteps?: number;
  /** Estimated seconds remaining */
  estimatedSecondsLeft?: number;
  /** List of predefined steps to simulate progress over time if exact progress isn't streaming */
  simulatedSteps?: HonestStep[];
  /** Is the operation actively running */
  isRunning?: boolean;
  /** Theme accent */
  color?: 'emerald' | 'purple' | 'sky' | 'amber';
  className?: string;
}

export const HonestProgressBar: React.FC<HonestProgressBarProps> = ({
  progress: explicitProgress,
  activeStepLabel: explicitStepLabel,
  currentStep: explicitCurrentStep,
  totalSteps: explicitTotalSteps,
  estimatedSecondsLeft: explicitSecLeft,
  simulatedSteps,
  isRunning = true,
  color = 'emerald',
  className = ''
}) => {
  const [internalProgress, setInternalProgress] = useState(12);
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(explicitSecLeft ?? 5);

  const steps = simulatedSteps || [
    { label: 'Connecting to regulatory data stream...', durationMs: 1200 },
    { label: 'Extracting key financial statements & ratios...', durationMs: 2500 },
    { label: 'Synthesizing quantitative market takeaway...', durationMs: 3000 },
    { label: 'Finalizing intelligence digest...', durationMs: 1500 }
  ];

  const totalSteps = explicitTotalSteps ?? steps.length;
  const currentStep = explicitCurrentStep ?? (stepIndex + 1);
  const activeLabel = explicitStepLabel ?? (steps[stepIndex]?.label || 'Processing data...');

  // Auto-progress simulation if no explicit progress is streamed
  useEffect(() => {
    if (explicitProgress !== undefined || !isRunning) return;

    setInternalProgress(10);
    setStepIndex(0);
    setSecondsRemaining(Math.ceil(steps.reduce((acc, s) => acc + (s.durationMs || 2000), 0) / 1000));

    let currentElapsed = 0;
    const totalDuration = steps.reduce((acc, s) => acc + (s.durationMs || 2000), 0);

    const interval = setInterval(() => {
      currentElapsed += 150;
      const pct = Math.min(94, Math.round((currentElapsed / totalDuration) * 95));
      setInternalProgress(pct);

      const remainingSec = Math.max(1, Math.ceil((totalDuration - currentElapsed) / 1000));
      setSecondsRemaining(remainingSec);

      // Determine step
      let accumulated = 0;
      for (let i = 0; i < steps.length; i++) {
        accumulated += (steps[i].durationMs || 2000);
        if (currentElapsed <= accumulated) {
          setStepIndex(i);
          break;
        }
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isRunning, explicitProgress]);

  const effectiveProgress = explicitProgress !== undefined ? Math.min(100, Math.max(0, explicitProgress)) : internalProgress;
  const effectiveSecondsLeft = explicitSecLeft !== undefined ? explicitSecLeft : secondsRemaining;

  const colorClasses = {
    emerald: {
      bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
      badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
      text: 'text-emerald-600 dark:text-emerald-400'
    },
    purple: {
      bar: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      badge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80',
      text: 'text-purple-600 dark:text-purple-400'
    },
    sky: {
      bar: 'bg-gradient-to-r from-sky-500 to-blue-500',
      badge: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/80',
      text: 'text-sky-600 dark:text-sky-400'
    },
    amber: {
      bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
      badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
      text: 'text-amber-600 dark:text-amber-400'
    }
  }[color];

  return (
    <div className={`w-full p-3.5 rounded-xl border border-slate-200/90 dark:border-[#2D283E] bg-white/90 dark:bg-[#181624]/90 backdrop-blur-xs space-y-2.5 ${className}`}>
      {/* Top Header: Step Name + Number + Percentage */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 font-mono ${colorClasses.badge}`}>
            Step {currentStep} of {totalSteps}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
            {activeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {effectiveSecondsLeft > 0 ? `~${effectiveSecondsLeft}s left` : 'finishing...'}
          </span>
          <span className={`font-bold text-xs ${colorClasses.text}`}>
            {effectiveProgress}%
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-800">
        <motion.div
          className={`h-full rounded-full ${colorClasses.bar}`}
          initial={{ width: '5%' }}
          animate={{ width: `${effectiveProgress}%` }}
          transition={{ ease: 'easeOut', duration: 0.25 }}
        />
      </div>
    </div>
  );
};
