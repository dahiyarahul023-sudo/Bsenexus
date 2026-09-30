import React from 'react';
import { motion } from 'framer-motion';
import { StickyNote } from 'lucide-react';
import { useNoteEditor } from '../../context/NoteEditorContext';
import type { NoteLink } from '../../types';
import { cn } from '../../lib/utils';

/**
 * One-tap "save a note" trigger. Used inside stock modals, news articles,
 * results cards and watchlist rows — opens the global editor with the link
 * prefilled (the user can remove it to make a personal note).
 */
export function SaveNoteButton({
  link, label = 'Save note', variant = 'icon', className,
}: {
  link: NoteLink;
  label?: string;
  variant?: 'icon' | 'pill';
  className?: string;
}) {
  const { openNoteEditor } = useNoteEditor();

  if (variant === 'pill') {
    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => openNoteEditor({ link })}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold',
          'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/25',
          'hover:bg-orange-500/20 transition-colors cursor-pointer',
          className
        )}
      >
        <StickyNote size={13} />
        {label}
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={() => openNoteEditor({ link })}
      aria-label={label}
      title={label}
      className={cn(
        'p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 transition-colors cursor-pointer',
        className
      )}
    >
      <StickyNote size={16} />
    </motion.button>
  );
}
