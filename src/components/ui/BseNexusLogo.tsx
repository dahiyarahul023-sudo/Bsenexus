import React from 'react';

export interface BseNexusLogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'icon-only' | 'horizontal' | 'stacked';
  textClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function BseNexusLogo({ 
  className,
  showText = false,
  variant = 'icon-only',
  textClassName,
  size = 'md'
}: BseNexusLogoProps) {
  // Determine effective display mode
  const effectiveVariant = showText ? (variant === 'icon-only' ? 'horizontal' : variant) : variant;

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-7 h-7',
    md: 'w-8 h-8 sm:w-9 sm:h-9',
    lg: 'w-11 h-11',
    xl: 'w-16 h-16'
  };

  const iconClass = className || sizeClasses[size] || 'w-8 h-8';

  return (
    <div className={`inline-flex items-center shrink-0 ${effectiveVariant === 'stacked' ? 'flex-col gap-1.5 text-center' : 'gap-2.5'}`}>
      {/* Crisp Molecular Constellation Icon Tile */}
      <div className={`relative flex items-center justify-center shrink-0 ${iconClass}`}>
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm select-none"
        >
          {/* Background Squircle */}
          <rect width="100" height="100" rx="22" fill="#0B0F19" />
          <rect width="100" height="100" rx="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

          {/* Centered Nexus Molecular Constellation */}
          <g fill="#F8FAFC">
            {/* Standalone Satellites in Diamond Grid */}
            <circle cx="50" cy="27" r="3.5" />
            <circle cx="39" cy="38" r="3.5" />
            <circle cx="61" cy="38" r="3.5" />
            <circle cx="28" cy="49" r="3.5" />
            <circle cx="50" cy="71" r="3.5" />

            {/* Continuous Wave / 'N' Backbone */}
            <path d="M 39 60 L 50 49" stroke="#F8FAFC" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 50 49 L 61 60" stroke="#F8FAFC" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 61 60 L 72 49" stroke="#F8FAFC" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

            {/* Joint Nodes */}
            <circle cx="39" cy="60" r="5.2" />
            <circle cx="50" cy="49" r="5.2" />
            <circle cx="61" cy="60" r="5.2" />
            <circle cx="72" cy="49" r="5.2" />
          </g>
        </svg>
      </div>

      {/* Optional Brand Typography */}
      {effectiveVariant !== 'icon-only' && (
        <div className={`flex flex-col leading-tight ${effectiveVariant === 'stacked' ? 'items-center' : 'items-start'}`}>
          <div className="flex items-center gap-1">
            <span className={textClassName || "font-black tracking-wider text-slate-900 dark:text-white uppercase font-display text-sm sm:text-base"}>
              BSE<span className="text-emerald-500">NEXUS</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

