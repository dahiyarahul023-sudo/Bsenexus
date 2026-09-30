import type { CSSProperties, JSX } from 'react';
import './noteIcons.css';

/**
 * Reel-style note icons — 12 ORIGINAL icons as real liquid glass.
 *
 * Visual model follows Apple's Liquid Glass material (developer.apple.com
 * "Adopting Liquid Glass" / HIG Materials): the tile is a genuine optical
 * surface — backdrop blur + saturation refracts what's behind it, the
 * pastel tint is a separate layer, specular highlights ride the edges,
 * and the glyph sits ON the glass as a plain white fill fused to the
 * material (never glass-on-glass). Every glyph path is drawn fresh for
 * BSE Nexus — not copies of the reel's artwork files (never published).
 */

export interface NoteIconDef {
  label: string;
  Icon: (props: { className?: string }) => JSX.Element;
}

interface TileProps {
  className?: string;
  tint: string;
  children: React.ReactNode;
}

function Tile({ className, tint, children }: TileProps) {
  return (
    <div className={`ng-root ${className ?? ''}`}>
      <div className="ng-disc">
        <div className="ng-glass" style={{ '--tint': tint } as CSSProperties}>
          <svg
            viewBox="0 0 64 64"
            className="ng-glyph"
            aria-hidden="true"
            focusable="false"
          >
            {children}
          </svg>
        </div>
      </div>
    </div>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <g
      fill="none"
      stroke="#ffffff"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

const cls = (className?: string) => ({ className });

export const NOTE_ICONS: NoteIconDef[] = [
  {
    label: 'Note',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...cls(className)} tint="#FCD34D">
        <Glyph>
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
      <Tile {...cls(className)} tint="#34D399">
        <Glyph>
          <path d="M17 43 L26 32 L33 38 L47 22" />
          <path d="M39 22 H47 V30" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'News',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...cls(className)} tint="#38BDF8">
        <Glyph>
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
      <Tile {...cls(className)} tint="#A78BFA">
        <Glyph>
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
      <Tile {...cls(className)} tint="#FACC15">
        <Glyph>
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
      <Tile {...cls(className)} tint="#FB923C">
        <path
          d="M32 14l5.1 10.3 11.4 1.7-8.2 8 1.9 11.4L32 40.1l-10.2 5.3 1.9-11.4-8.2-8 11.4-1.7z"
          fill="#ffffff"
        />
        <path
          d="M32 22l2.2 4.5 5 0.7-3.6 3.5 0.9 5-4.5-2.4-4.5 2.4 0.9-5-3.6-3.5 5-0.7z"
          fill="#ffffff"
          opacity={0.45}
        />
      </Tile>
    ),
  },
  {
    label: 'Alert',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...cls(className)} tint="#FB7185">
        <Glyph>
          <path d="M32 14c-7.5 0-11.5 5.5-11.5 13v5.5L16 39h32l-4.5-6.5V27c0-7.5-4-13-11.5-13z" />
        </Glyph>
        <circle cx="32" cy="10.5" r="2.6" fill="#ffffff" />
        <circle cx="32" cy="45" r="3.4" fill="#ffffff" />
      </Tile>
    ),
  },
  {
    label: 'Done',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...cls(className)} tint="#2DD4BF">
        <Glyph>
          <circle cx="32" cy="32" r="14" />
          <path d="M25.5 32.5l4.5 4.5 9-11" />
        </Glyph>
      </Tile>
    ),
  },
  {
    label: 'Target',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...cls(className)} tint="#F87171">
        <Glyph>
          <circle cx="32" cy="32" r="14" />
          <circle cx="32" cy="32" r="8.5" />
        </Glyph>
        <circle cx="32" cy="32" r="2.8" fill="#ffffff" />
      </Tile>
    ),
  },
  {
    label: 'Money',
    Icon: ({ className }: { className?: string }) => (
      <Tile {...cls(className)} tint="#A3E635">
        <Glyph>
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
      <Tile {...cls(className)} tint="#818CF8">
        <Glyph>
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
      <Tile {...cls(className)} tint="#F472B6">
        <Glyph>
          <path d="M32 12c-6.5 0-11 4.8-11 11 0 7.5 11 19 11 19s11-11.5 11-19c0-6.2-4.5-11-11-11z" />
        </Glyph>
        <circle cx="32" cy="23" r="4" fill="#ffffff" fillOpacity={0.5} />
      </Tile>
    ),
  },
];

export function noteIconAt(i: number): NoteIconDef {
  return NOTE_ICONS[i] ?? NOTE_ICONS[0];
}
