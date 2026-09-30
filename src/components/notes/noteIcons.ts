/**
 * Reel-style note icons — 12 original pastel rounded-square icons.
 * Same visual language as the reference (soft pastel tiles, playful glyphs),
 * drawn fresh for BSE Nexus; not copies of the reel's artwork files.
 */
export interface NoteIconDef {
  emoji: string;
  /** pastel tile background (light mode) */
  bg: string;
  /** pastel tile background (dark mode) */
  darkBg: string;
  label: string;
}

export const NOTE_ICONS: NoteIconDef[] = [
  { emoji: '📝', bg: 'bg-amber-100', darkBg: 'dark:bg-amber-500/20', label: 'Note' },
  { emoji: '📈', bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-500/20', label: 'Stocks' },
  { emoji: '📰', bg: 'bg-sky-100', darkBg: 'dark:bg-sky-500/20', label: 'News' },
  { emoji: '📅', bg: 'bg-violet-100', darkBg: 'dark:bg-violet-500/20', label: 'Results' },
  { emoji: '💡', bg: 'bg-yellow-100', darkBg: 'dark:bg-yellow-500/20', label: 'Idea' },
  { emoji: '⭐', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-500/20', label: 'Watch' },
  { emoji: '🔔', bg: 'bg-rose-100', darkBg: 'dark:bg-rose-500/20', label: 'Alert' },
  { emoji: '✅', bg: 'bg-teal-100', darkBg: 'dark:bg-teal-500/20', label: 'Done' },
  { emoji: '🎯', bg: 'bg-red-100', darkBg: 'dark:bg-red-500/20', label: 'Target' },
  { emoji: '💰', bg: 'bg-lime-100', darkBg: 'dark:bg-lime-500/20', label: 'Money' },
  { emoji: '📊', bg: 'bg-indigo-100', darkBg: 'dark:bg-indigo-500/20', label: 'Stats' },
  { emoji: '📌', bg: 'bg-pink-100', darkBg: 'dark:bg-pink-500/20', label: 'Pin' },
];

export function noteIconAt(i: number): NoteIconDef {
  return NOTE_ICONS[i] ?? NOTE_ICONS[0];
}
