import type { JSX } from 'react';

/**
 * Reel-style note icons — 12 ORIGINAL pastel icons drawn as vector SVGs.
 *
 * Same visual language as the reference (soft pastel rounded tiles, playful
 * dimensional glyphs), but every path here is drawn fresh for BSE Nexus —
 * not copies of the reel's artwork files (those were never published).
 *
 * One consistent geometry system: 64x64 tile, pastel vertical gradient +
 * top sheen, glyph in a deep tone of the same hue, 5px rounded strokes.
 */

export interface NoteIconDef {
  label: string;
  Icon: (props: { className?: string }) => JSX.Element;
}

interface TileProps {
  className?: string;
  gid: string;
  from: string;
  to: string;
  deep: string;
  children: React.ReactNode;
}

function Tile({ className, gid, from, to, children }: TileProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${gid}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${gid}-clip`}>
          <rect x="3" y="3" width="58" height="58" rx="17" />
        </clipPath>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="17" fill={`url(#${gid})`} />
      <g clipPath={`url(#${gid}-clip)`}>
        <rect x="3" y="3" width="58" height="30" fill={`url(#${gid}-sheen)`} />
      </g>
      {children}
    </svg>
  );
}

function Glyph({ deep, children }: { deep: string; children: React.ReactNode }) {
  return (
    <g fill="none" stroke={deep} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  );
}

const glyphProps = (className?: string) => ({ className });

export const NOTE_ICONS: NoteIconDef[] = [
  {
    label: 'Note',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-note" from="#FEF3C7" to="#FDE68A" deep="#B45309">
        <Glyph deep="#B45309">
          <rect x="21" y="12" width="22" height="40" rx="6" />
          <path d="M27 23h10" />
          <path d="M27 30h10" />
          <path d="M27 37h7" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Stocks',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-stocks" from="#D1FAE5" to="#A7F3D0" deep="#047857">
        <Glyph deep="#047857">
          <path d="M17 43 L26 32 L33 38 L47 22" />
          <path d="M39 22 H47 V30" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'News',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-news" from="#E0F2FE" to="#BAE6FD" deep="#0369A1">
        <Glyph deep="#0369A1">
          <rect x="15" y="17" width="34" height="30" rx="5" />
          <path d="M21 25h10" />
          <path d="M21 31h22" />
          <path d="M21 37h22" />
          <path d="M21 42h13" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Results',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-results" from="#EDE9FE" to="#DDD6FE" deep="#6D28D9">
        <Glyph deep="#6D28D9">
          <rect x="17" y="19" width="30" height="29" rx="6" />
          <path d="M17 28h30" />
          <path d="M24 14v6" />
          <path d="M40 14v6" />
          <path d="M26 38l4.5 4.5L39 33" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Idea',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-idea" from="#FEF9C3" to="#FDE047" deep="#A16207">
        <Glyph deep="#A16207">
          <circle cx="32" cy="26" r="10" />
          <path d="M28 40h8" />
          <path d="M29.5 44.5h5" />
          <path d="M32 7v4" />
          <path d="M15 26h4" />
          <path d="M45 26h4" />
          <path d="M19.3 13.3l2.8 2.8" />
          <path d="M44.7 13.3l-2.8 2.8" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Watch',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-watch" from="#FFEDD5" to="#FED7AA" deep="#C2410C">
        <path
          d="M32 14l5.1 10.3 11.4 1.7-8.2 8 1.9 11.4L32 40.1l-10.2 5.3 1.9-11.4-8.2-8 11.4-1.7z"
          fill="#C2410C"
          stroke="#C2410C"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d="M32 22l2.2 4.5 5 0.7-3.6 3.5 0.9 5-4.5-2.4-4.5 2.4 0.9-5-3.6-3.5 5-0.7z"
          fill="#FED7AA"
          opacity={0.55}
        />
      </Tile>
    ),
  },
  {
    label: 'Alert',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-alert" from="#FFE4E6" to="#FECDD3" deep="#BE123C">
        <Glyph deep="#BE123C">
          <path d="M32 14c-7.5 0-11.5 5.5-11.5 13v5.5L16 39h32l-4.5-6.5V27c0-7.5-4-13-11.5-13z" />
        </Glyph>
        <circle cx="32" cy="10.5" r="2.6" fill="#BE123C" />
        <circle cx="32" cy="45" r="3.4" fill="#BE123C" />
      </Tile>
    ),
  },
  {
    label: 'Done',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-done" from="#CCFBF1" to="#99F6E4" deep="#0F766E">
        <Glyph deep="#0F766E">
          <circle cx="32" cy="32" r="14" />
          <path d="M25.5 32.5l4.5 4.5 9-11" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Target',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-target" from="#FEE2E2" to="#FECACA" deep="#B91C1C">
        <Glyph deep="#B91C1C">
          <circle cx="32" cy="32" r="14" />
          <circle cx="32" cy="32" r="8.5" />
        </Glyph>
        <circle cx="32" cy="32" r="2.8" fill="#B91C1C" />
      </Tile>
    ),
  },
  {
    label: 'Money',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-money" from="#ECFCCB" to="#D9F99D" deep="#4D7C0F">
        <Glyph deep="#4D7C0F">
          <ellipse cx="32" cy="21" rx="12" ry="5.5" />
          <path d="M20 21v11c0 3 5.4 5.5 12 5.5s12-2.5 12-5.5V21" />
          <path d="M20 26.5c0 3 5.4 5.5 12 5.5s12-2.5 12-5.5" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Stats',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-stats" from="#E0E7FF" to="#C7D2FE" deep="#4338CA">
        <Glyph deep="#4338CA">
          <path d="M21 44V32" />
          <path d="M29 44V24" />
          <path d="M37 44V36" />
          <path d="M45 44V18" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Pin',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...glyphProps(className)} gid="ni-pin" from="#FCE7F3" to="#F9A8D4" deep="#BE185D">
        <Glyph deep="#BE185D">
          <path d="M32 12c-6.5 0-11 4.8-11 11 0 7.5 11 19 11 19s11-11.5 11-19c0-6.2-4.5-11-11-11z" />
        </Glyph>
        <circle cx="32" cy="23" r="4" fill="#FCE7F3" />
      </Tile>
    ),
  },
];

export function noteIconAt(i: number): NoteIconDef {
  return NOTE_ICONS[i] ?? NOTE_ICONS[0];
}
