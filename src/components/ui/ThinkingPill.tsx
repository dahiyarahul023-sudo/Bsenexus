import React from 'react';

/**
 * ThinkingPill — animated AI "thinking" status pill.
 *
 * Replicates the liquid mesh-gradient pill from the reference reel:
 * a dark pill with slowly flowing blue/cyan + red/pink gradient blobs,
 * faint light outline, soft glass depth, and static white text.
 * The gradient loops seamlessly; glow intensity stays constant.
 */
interface ThinkingPillProps {
  /** Status text shown on the pill. Defaults to "Thinking...". */
  text?: string;
  className?: string;
}

export const ThinkingPill: React.FC<ThinkingPillProps> = ({
  text = 'Thinking...',
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text}
      className={`thinking-pill relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/25 px-7 py-2.5 shadow-[inset_0_1px_12px_rgba(255,255,255,0.12),inset_0_-8px_16px_rgba(0,0,0,0.45),0_4px_18px_rgba(0,0,0,0.35)] ${className}`}
    >
      {/* Base dark fill */}
      <div className="absolute inset-0 bg-[#0b0b14]" aria-hidden="true" />

      {/* Flowing mesh-gradient blobs (blurred, drifting like liquid) */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="thinking-blob thinking-blob-1 absolute -left-[15%] -top-[60%] h-[220%] w-[55%] rounded-full bg-cyan-400/90 blur-2xl" />
        <div className="thinking-blob thinking-blob-2 absolute -left-[10%] -bottom-[70%] h-[220%] w-[50%] rounded-full bg-blue-700/90 blur-2xl" />
        <div className="thinking-blob thinking-blob-3 absolute left-[38%] -top-[55%] h-[210%] w-[48%] rounded-full bg-red-500/90 blur-2xl" />
        <div className="thinking-blob thinking-blob-4 absolute -right-[12%] -bottom-[60%] h-[220%] w-[52%] rounded-full bg-rose-600/90 blur-2xl" />
        <div className="thinking-blob thinking-blob-5 absolute right-[18%] top-[10%] h-[90%] w-[26%] rounded-full bg-pink-300/70 blur-xl" />
      </div>

      {/* Glass sheen on top */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/15 via-transparent to-transparent"
        aria-hidden="true"
      />

      {/* Static label */}
      <span className="relative z-10 whitespace-nowrap text-[15px] font-medium tracking-wide text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
        {text}
      </span>

      <style>{`
        .thinking-pill .thinking-blob {
          will-change: transform;
          animation: thinking-drift 7s ease-in-out infinite alternate;
        }
        .thinking-pill .thinking-blob-1 { animation-delay: 0s; }
        .thinking-pill .thinking-blob-2 { animation-delay: -1.8s; }
        .thinking-pill .thinking-blob-3 { animation-delay: -3.4s; }
        .thinking-pill .thinking-blob-4 { animation-delay: -5s; }
        .thinking-pill .thinking-blob-5 { animation-delay: -2.6s; }
        @keyframes thinking-drift {
          0%   { transform: translate3d(-14%, 6%, 0) scale(1); }
          50%  { transform: translate3d(16%, -8%, 0) scale(1.12); }
          100% { transform: translate3d(30%, 4%, 0) scale(0.96); }
        }
        @media (prefers-reduced-motion: reduce) {
          .thinking-pill .thinking-blob { animation: none; }
        }
      `}</style>
    </div>
  );
};
