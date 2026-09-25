import React from 'react';
import { clsx } from 'clsx';

export interface SocialLinkItem {
  id: 'x' | 'instagram' | 'threads' | 'telegram' | 'linkedin' | 'email';
  name: string;
  handle: string;
  href: string;
  ariaLabel: string;
  svgPath: string;
  hoverColor: string;
  badge?: string;
}

export const OFFICIAL_SOCIAL_LINKS: SocialLinkItem[] = [
  {
    id: 'x',
    name: 'X',
    handle: '@bsenexus',
    href: 'https://x.com/bsenexus',
    ariaLabel: 'Follow BSE Nexus on X (formerly Twitter)',
    // Official Simple Icons X path (viewBox: 0 0 24 24)
    svgPath: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    hoverColor: 'hover:text-white hover:bg-slate-800/80',
    badge: 'Official'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    handle: '@bsenexus',
    href: 'https://www.instagram.com/bsenexus/',
    ariaLabel: 'Follow BSE Nexus on Instagram',
    // Official Simple Icons Instagram path (viewBox: 0 0 24 24)
    svgPath: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
    hoverColor: 'hover:text-pink-400 hover:bg-pink-950/40'
  },
  {
    id: 'threads',
    name: 'Threads',
    handle: '@bsenexus',
    href: 'https://www.threads.com/@bsenexus',
    ariaLabel: 'Follow BSE Nexus on Threads',
    // Official Simple Icons Threads path (viewBox: 0 0 24 24)
    svgPath: 'M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z',
    hoverColor: 'hover:text-white hover:bg-slate-800/80'
  },
  {
    id: 'telegram',
    name: 'Telegram',
    handle: '@BseNexusOfficial',
    href: 'https://t.me/BseNexusOfficial',
    ariaLabel: 'Join BSE Nexus Official Telegram Channel',
    // Official Simple Icons Telegram path (viewBox: 0 0 24 24)
    svgPath: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
    hoverColor: 'hover:text-sky-400 hover:bg-sky-950/40',
    badge: 'Channel'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    handle: 'bse-nexus',
    href: 'https://www.linkedin.com/company/bse-nexus',
    ariaLabel: 'Follow BSE Nexus on LinkedIn',
    // Official Simple Icons LinkedIn path (viewBox: 0 0 24 24)
    svgPath: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.225 0z',
    hoverColor: 'hover:text-blue-400 hover:bg-blue-950/40',
    badge: 'Official'
  },
  {
    id: 'email',
    name: 'Email',
    handle: 'admin@bsenexus.in',
    href: 'mailto:admin@bsenexus.in',
    ariaLabel: 'Email BSE Nexus Team (admin@bsenexus.in)',
    // Clean email envelope path (viewBox: 0 0 24 24)
    svgPath: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
    hoverColor: 'hover:text-emerald-400 hover:bg-emerald-950/40'
  }
];

export function TelegramDiscussionButton({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  return (
    <a
      href="https://t.me/BseNexusDiscussion"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join BSE Nexus Telegram Discussion Group"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-xl font-bold transition-all duration-200 cursor-pointer shadow-xs select-none",
        "bg-gradient-to-r from-emerald-950 via-[#101826] to-slate-900 border border-emerald-500/40 hover:border-emerald-400",
        "text-emerald-300 hover:text-white hover:shadow-emerald-950/50 hover:shadow-md active:scale-95",
        size === 'sm' ? "px-2.5 py-1 text-[11px]" : "px-4 py-2 text-xs",
        className
      )}
      title="Join BSE Nexus Traders & Investors Discussion Community"
    >
      <svg
        viewBox="0 0 24 24"
        width={size === 'sm' ? 13 : 15}
        height={size === 'sm' ? 13 : 15}
        fill="currentColor"
        aria-hidden="true"
        className="shrink-0 text-emerald-400"
      >
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
      <span>Join Discussion</span>
    </a>
  );
}

interface SocialIconsRowProps {
  className?: string;
  size?: number; // ~22px as specified
  showTooltip?: boolean;
  showCommunityButton?: boolean;
}

/**
 * Clean Footer Social Icons Row
 * Displays X, Instagram, Threads, Telegram, LinkedIn, and Email
 * with official Simple Icons SVGs (~22px), theme-matching colors,
 * brightening on hover, full aria-labels, plus a Telegram Discussion button.
 */
export function SocialIconsRow({ className, size = 20, showTooltip = true, showCommunityButton = true }: SocialIconsRowProps) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2.5 sm:gap-3.5", className)}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {OFFICIAL_SOCIAL_LINKS.map((item) => {
          const isExternal = item.href.startsWith('http');
          return (
            <a
              key={item.id}
              href={item.href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              aria-label={item.ariaLabel}
              title={showTooltip ? item.ariaLabel : undefined}
              className={clsx(
                "p-1.5 rounded-lg text-slate-400 dark:text-slate-400",
                "hover:text-slate-900 dark:hover:text-white",
                "transition-all duration-200 ease-out",
                "hover:scale-110 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              )}
            >
              <svg
                viewBox="0 0 24 24"
                width={size}
                height={size}
                fill="currentColor"
                aria-hidden="true"
                className="shrink-0 transition-transform duration-200"
              >
                <path d={item.svgPath} />
              </svg>
              <span className="sr-only">{item.name}</span>
            </a>
          );
        })}
      </div>

      {showCommunityButton && (
        <TelegramDiscussionButton size="sm" />
      )}
    </div>
  );
}

interface FollowBseNexusBlockProps {
  className?: string;
}

/**
 * Homepage "Follow BSE Nexus" Block
 * Positioned just above the footer on the Homepage.
 * Matches the site's dark theme, short heading + subtext,
 * and stacks cleanly on mobile.
 */
export function FollowBseNexusBlock({ className }: FollowBseNexusBlockProps) {
  return (
    <section className={clsx("w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8 sm:my-12", className)}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#13121F] to-[#1C182E] border border-slate-800/90 p-6 sm:p-8 shadow-xl shadow-black/20">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Header & Subtext */}
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Follow BSE Nexus & Join Community
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              BSE filings, earnings results, and market alerts in real-time. Join our trader and investor discussion group.
            </p>
            <div className="pt-1">
              <TelegramDiscussionButton size="md" />
            </div>
          </div>

          {/* Social Icon Buttons - Stacks cleanly on mobile, row on tablet/desktop */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {OFFICIAL_SOCIAL_LINKS.map((item) => {
              const isExternal = item.href.startsWith('http');
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  aria-label={item.ariaLabel}
                  className={clsx(
                    "group inline-flex items-center gap-2 px-3 py-2 rounded-xl",
                    "bg-[#1A1828] hover:bg-[#25223A] border border-slate-700/80 hover:border-slate-600",
                    "text-slate-300 hover:text-white transition-all duration-200 shadow-xs",
                    "hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={18}
                    height={18}
                    fill="currentColor"
                    aria-hidden="true"
                    className="shrink-0 text-slate-300 group-hover:text-white transition-colors duration-200"
                  >
                    <path d={item.svgPath} />
                  </svg>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold leading-tight group-hover:text-white">
                      {item.name}
                    </span>
                    <span className="text-[9.5px] text-slate-400 group-hover:text-slate-300 font-mono leading-tight">
                      {item.handle}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
