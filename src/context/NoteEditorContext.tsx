import React, { createContext, useContext, useState, useCallback } from 'react';
import type { UserNote, NoteLink } from '../types';

export interface OpenNoteEditorOpts {
  /** Prefilled link (auto-attached when saving from a section; user can remove it). */
  link?: NoteLink | null;
  /** When editing an existing note. */
  note?: UserNote | null;
}

interface NoteEditorContextType {
  isOpen: boolean;
  initialLink: NoteLink | null;
  editingNote: UserNote | null;
  /** Token that changes every open — lets the editor reset its state. */
  openToken: number;
  openNoteEditor: (opts?: OpenNoteEditorOpts) => void;
  closeNoteEditor: () => void;
}

const NoteEditorContext = createContext<NoteEditorContextType | undefined>(undefined);

export function NoteEditorProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialLink, setInitialLink] = useState<NoteLink | null>(null);
  const [editingNote, setEditingNote] = useState<UserNote | null>(null);
  const [openToken, setOpenToken] = useState(0);

  const openNoteEditor = useCallback((opts?: OpenNoteEditorOpts) => {
    setInitialLink(opts?.link ?? null);
    setEditingNote(opts?.note ?? null);
    setOpenToken(t => t + 1);
    setIsOpen(true);
  }, []);

  const closeNoteEditor = useCallback(() => setIsOpen(false), []);

  return (
    <NoteEditorContext.Provider value={{ isOpen, initialLink, editingNote, openToken, openNoteEditor, closeNoteEditor }}>
      {children}
    </NoteEditorContext.Provider>
  );
}

export function useNoteEditor() {
  const ctx = useContext(NoteEditorContext);
  if (!ctx) throw new Error('useNoteEditor must be used within a NoteEditorProvider');
  return ctx;
}
