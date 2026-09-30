import React from 'react';

export type CompanySymbol = 'RELIANCE' | 'INFY' | 'HDFCBANK' | 'TCS';

interface CompanyLogoProps {
  symbol: CompanySymbol;
  size?: number;
  className?: string;
}

/**
 * CompanyLogo — premium brand-style logo tiles for the landing mockups.
 * Stylized brand-color marks (not the official trademark artwork); every
 * surface that uses them is labeled as a sample preview.
 */
export function CompanyLogo({ symbol, size = 34, className = '' }: CompanyLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-[11px] bg-white border border-slate-200/80 shadow-[0_4px_10px_rgba(2,32,71,0.10)] overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 68 68">
        <rect width="68" height="68" rx="14" fill="#ffffff" />
        {symbol === 'RELIANCE' && (
          <>
            <text x="34" y="45" textAnchor="middle" fontFamily="'Plus Jakarta Sans',sans-serif" fontWeight={800} fontSize="27" fill="#0B3D91">R</text>
            <path d="M14 53 Q34 61 54 51" stroke="#E31E24" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        )}
        {symbol === 'INFY' && (
          <text x="34" y="42" textAnchor="middle" fontFamily="'Plus Jakarta Sans',sans-serif" fontWeight={700} fontSize="16.5" fill="#007CC3">Infosys</text>
        )}
        {symbol === 'HDFCBANK' && (
          <>
            <rect x="13" y="15" width="19" height="19" rx="5" fill="#ED1C24" />
            <rect x="36" y="15" width="19" height="19" rx="5" fill="#004481" />
            <rect x="13" y="38" width="19" height="19" rx="5" fill="#004481" />
            <rect x="36" y="38" width="19" height="19" rx="5" fill="#ED1C24" />
          </>
        )}
        {symbol === 'TCS' && (
          <text x="34" y="45" textAnchor="middle" fontFamily="'Plus Jakarta Sans',sans-serif" fontWeight={800} fontSize="23" letterSpacing="1" fill="#1B1F4B">tcs</text>
        )}
      </svg>
    </span>
  );
}
