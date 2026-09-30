import React from 'react';

export type CompanySymbol = 'RELIANCE' | 'INFY' | 'HDFCBANK' | 'TCS';

interface CompanyLogoProps {
  symbol: CompanySymbol;
  size?: number;
  className?: string;
}

const LOGO_SRC: Record<CompanySymbol, string> = {
  RELIANCE: '/company-logos/reliance.svg',
  INFY: '/company-logos/infosys.svg',
  HDFCBANK: '/company-logos/hdfc-bank.svg',
  TCS: '/company-logos/tcs.svg',
};

/**
 * CompanyLogo — real company brand marks for the landing mockups.
 * The SVG files in public/company-logos/ are faithful vector depictions
 * of each company's actual logo artwork (sources recorded in
 * docs/COMPANY_LOGOS.md). Shown nominatively next to that company's own
 * filings/disclosures — never altered, never recreated from memory.
 */
export function CompanyLogo({ symbol, size = 34, className = '' }: CompanyLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-[11px] bg-white border border-slate-200/80 shadow-[0_4px_10px_rgba(2,32,71,0.10)] overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={LOGO_SRC[symbol]}
        alt=""
        draggable={false}
        style={{ width: '80%', height: '80%', objectFit: 'contain' }}
      />
    </span>
  );
}
