import './feature-icons.css';

interface IconProps { className?: string; }

/* Approved v2 feature icons — researched from real references:
   Telegram = official Telegram logo geometry, AI = Google Gemini sparkle geometry,
   Calendar = iOS Calendar style, Indices = Apple Stocks style. */

export function FilingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-filings" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6"/><stop offset="1" stopColor="#1D4ED8"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-filings)"/>
      <rect x="35" y="28" width="26" height="40" rx="6" fill="#fff"/>
      <path d="M52 28 L61 35 L52 35 Z" fill="#BFDBFE"/>
      <rect x="40" y="42" width="12" height="3.2" rx="1.6" fill="#3B82F6"/>
      <rect x="40" y="48.5" width="16" height="3.2" rx="1.6" fill="#3B82F6"/>
      <rect x="40" y="55" width="10" height="3.2" rx="1.6" fill="#3B82F6"/>
      <circle cx="59" cy="62" r="9" fill="#EF4444" opacity=".28"/>
      <circle cx="59" cy="62" r="6" fill="#EF4444" stroke="#fff" strokeWidth="2.2"/>
    </svg>
  );
}

export function ResultsCalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <rect x="10" y="10" width="76" height="76" rx="20" fill="#fff" stroke="#E2E8F0" strokeWidth="1.5"/>
      <path d="M10 32 a20 20 0 0 1 20 -20 h36 a20 20 0 0 1 20 20 v4 h-76 z" fill="#FF3B30"/>
      <text x="48" y="28" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff" letterSpacing="1.5" fontFamily="-apple-system,Segoe UI,sans-serif">WED</text>
      <text x="48" y="68" textAnchor="middle" fontSize="36" fontWeight="300" fill="#111" fontFamily="-apple-system,Segoe UI,sans-serif">28</text>
    </svg>
  );
}

export function AiSummariesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-ai" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4E8DF5"/><stop offset=".55" stopColor="#9B72CB"/><stop offset="1" stopColor="#D96570"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="#fff" stroke="#E2E8F0" strokeWidth="1.5"/>
      <g transform="translate(24,24) scale(2)"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" fill="url(#fi-ai)"/></g>
    </svg>
  );
}

export function TelegramAlertsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#37AEE2"/><stop offset="1" stopColor="#1E96C8"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-tg)"/>
      <g transform="translate(51.2,3.5) scale(3.53)"><path d="m4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" fill="#fff"/></g>
    </svg>
  );
}

export function IntelDossierIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-intel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F46E5"/><stop offset="1" stopColor="#312E81"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-intel)"/>
      <circle cx="48" cy="52" r="27" fill="none" stroke="#fff" strokeWidth="2.5" opacity=".55"/>
      <path d="M36 44 L48 35 L60 44 Z" fill="#fff"/>
      <rect x="39.5" y="46" width="3.6" height="15" fill="#fff"/>
      <rect x="46.2" y="46" width="3.6" height="15" fill="#fff"/>
      <rect x="52.9" y="46" width="3.6" height="15" fill="#fff"/>
      <rect x="37" y="62.5" width="22" height="3.6" rx="1.8" fill="#fff"/>
      <circle cx="71.4" cy="38.5" r="4" fill="#fff"/>
    </svg>
  );
}

export function ResultsLedgerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-results" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1E3A8A"/><stop offset="1" stopColor="#0F172A"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-results)"/>
      <rect x="36" y="52" width="7.5" height="14" rx="2" fill="#fff" opacity=".85"/>
      <rect x="46.5" y="44" width="7.5" height="22" rx="2" fill="#fff" opacity=".92"/>
      <rect x="57" y="35" width="7.5" height="31" rx="2" fill="#34D399"/>
      <rect x="32" y="68" width="32" height="3" rx="1.5" fill="#fff" opacity=".5"/>
    </svg>
  );
}

export function WatchlistsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-watch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBBF24"/><stop offset="1" stopColor="#D97706"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-watch)"/>
      <path d="M48 29 L52.9 43 L67.5 43.4 L55.9 52.2 L60.2 66.4 L48 58.2 L35.8 66.4 L40.1 52.2 L28.5 43.4 L43.1 43 Z" fill="#fff"/>
    </svg>
  );
}

export function AlertRulesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-rules" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FB7185"/><stop offset="1" stopColor="#E11D48"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-rules)"/>
      <g stroke="#fff" strokeWidth="3.6" strokeLinecap="round" opacity=".95">
        <line x1="32" y1="38" x2="64" y2="38"/><line x1="32" y1="50" x2="64" y2="50"/><line x1="32" y1="62" x2="64" y2="62"/>
      </g>
      <circle cx="42" cy="38" r="6" fill="#fff"/><circle cx="42" cy="38" r="2.4" fill="#E11D48"/>
      <circle cx="56" cy="50" r="6" fill="#fff"/><circle cx="56" cy="50" r="2.4" fill="#E11D48"/>
      <circle cx="46" cy="62" r="6" fill="#fff"/><circle cx="46" cy="62" r="2.4" fill="#E11D48"/>
    </svg>
  );
}

export function IndicesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-indices" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1F2937"/><stop offset="1" stopColor="#030712"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-indices)"/>
      <polyline points="30,60 38,52 44,56 52,44 60,48 66,38" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="66" cy="38" r="4.4" fill="#fff"/>
    </svg>
  );
}

export function QuotaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id="fi-quota" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2DD4BF"/><stop offset="1" stopColor="#0F766E"/></linearGradient></defs>
      <rect x="10" y="10" width="76" height="76" rx="20" fill="url(#fi-quota)"/>
      <path d="M31 63 A19 19 0 0 1 65 63" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".9"/>
      <line x1="48" y1="63" x2="59" y2="49" stroke="#fff" strokeWidth="4.5" strokeLinecap="round"/>
      <circle cx="48" cy="63" r="4.5" fill="#fff"/>
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".7">
        <line x1="35" y1="52" x2="38.5" y2="55"/><line x1="61" y1="52" x2="57.5" y2="55"/>
      </g>
    </svg>
  );
}
