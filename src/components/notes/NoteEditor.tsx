import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X, Check, ArrowRight, ArrowLeft, Loader2, Tag,
  TrendingUp, Newspaper, CalendarDays, FileText, LogIn,
} from 'lucide-react';
import { useNoteEditor } from '../../context/NoteEditorContext';
import { useAuth } from '../../context/AuthContext';
import { createNoteApi, updateNoteApi } from '../../api/notesApi';
import { NOTE_ICONS, noteIconAt } from './noteIcons';
import type { UserNote, NoteLink, NoteLinkType } from '../../types';
import { cn } from '../../lib/utils';

const LINK_META: Record<NoteLinkType, { icon: any; tint: string }> = {
  stock: { icon: TrendingUp, tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  news: { icon: Newspaper, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  result: { icon: CalendarDays, tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  filing: { icon: FileText, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
};

/** Black circular button with the reel's orange progress ring. */
function RingButton({
  onClick, disabled, saving, progress, ariaLabel,
}: {
  onClick: () => void; disabled?: boolean; saving?: boolean; progress: number; ariaLabel: string;
}) {
  const R = 27;
  const C = 2 * Math.PI * R;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || saving}
      whileTap={disabled || saving ? undefined : { scale: 0.9 }}
      aria-label={ariaLabel}
      className={cn(
        'relative w-[68px] h-[68px] rounded-full shrink-0 grid place-items-center transition-opacity',
        'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950',
        'shadow-[0_10px_30px_rgba(0,0,0,0.35)]',
        (disabled || saving) && 'opacity-60'
      )}
    >
      <svg viewBox="0 0 68 68" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
        <circle cx="34" cy="34" r={R} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3.5" />
        <circle
          cx="34" cy="34" r={R} fill="none" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, progress)))}
          style={{ transition: 'stroke-dashoffset 0.25s ease' }}
        />
      </svg>
      {saving
        ? <Loader2 size={26} className="animate-spin" />
        : <ArrowRight size={26} strokeWidth={2.5} />}
    </motion.button>
  );
}

function LinkChip({ link, onRemove }: { link: NoteLink; onRemove: () => void }) {
  const meta = LINK_META[link.type];
  const Icon = meta.icon;
  return (
    <div className="inline-flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-full bg-slate-100 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] max-w-full">
      <span className={cn('w-6 h-6 rounded-full grid place-items-center shrink-0', meta.tint)}>
        <Icon size={13} />
      </span>
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{link.label}</span>
      <button
        type="button" onClick={onRemove} aria-label="Remove link"
        className="w-6 h-6 rounded-full grid place-items-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {[0, 1].map(i => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === step ? 'w-6 bg-neutral-900 dark:bg-white' : 'w-1.5 bg-slate-300 dark:bg-slate-600'
          )}
        />
      ))}
    </div>
  );
}

function NoteEditorSheet({
  initialLink, editingNote, openToken, onClose,
}: {
  initialLink: NoteLink | null;
  editingNote: UserNote | null;
  openToken: number;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isEdit = !!editingNote;
  const [step, setStep] = useState(isEdit ? 1 : 0);
  const [iconIdx, setIconIdx] = useState(editingNote?.icon ?? 0);
  const [text, setText] = useState(editingNote?.text ?? '');
  const [tags, setTags] = useState<string[]>(editingNote?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [link, setLink] = useState<NoteLink | null>(editingNote?.link ?? initialLink);
  const [saving, setSaving] = useState(false);
  const [folding, setFolding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset whenever the editor is opened fresh.
  useEffect(() => {
    setStep(isEdit ? 1 : 0);
    setIconIdx(editingNote?.icon ?? 0);
    setText(editingNote?.text ?? '');
    setTags(editingNote?.tags ?? []);
    setTagInput('');
    setLink(editingNote?.link ?? initialLink);
    setSaving(false);
    setFolding(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openToken]);

  useEffect(() => {
    if (step === 1) {
      const t = setTimeout(() => textareaRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [step]);

  const commitTag = () => {
    const clean = tagInput.trim().replace(/^#+/, '').toLowerCase().slice(0, 24);
    if (clean && !tags.includes(clean) && tags.length < 8) setTags([...tags, clean]);
    setTagInput('');
  };

  const canSave = text.trim().length > 0 && !saving && !folding;
  // Orange ring fills as the note takes shape — full when ready to save.
  const ringProgress = saving || folding ? 1 : Math.min(1, text.trim().length / 24);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { text: text.trim(), icon: iconIdx, tags, link };
      const res = isEdit && editingNote
        ? await updateNoteApi(editingNote.id, payload)
        : await createNoteApi(payload);
      if (!res.success || !res.note) {
        // Storage unreachable: LOUD failure, draft stays put for retry.
        setError(res.storageUnavailable
          ? 'Could not reach secure storage. Your note is safe here — please retry.'
          : (res.error || 'Could not save the note. Please try again.'));
        setSaving(false);
        return;
      }
      window.dispatchEvent(new CustomEvent('notes-changed', { detail: { note: res.note } }));
      if (reduceMotion) {
        onClose();
        return;
      }
      setFolding(true);
      setTimeout(onClose, 480);
    } catch {
      setError('Could not save the note. Please try again.');
      setSaving(false);
    }
  };

  const icon = noteIconAt(iconIdx);

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit note' : 'New note'}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => !saving && !folding && onClose()} />
      {/* The folding card — rotateX fold-away on save, like the reel. */}
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={folding
          ? { rotateX: -72, opacity: 0, y: 90, scale: 0.94 }
          : { y: 0, opacity: 1, scale: 1, rotateX: 0 }}
        exit={{ y: 60, opacity: 0, scale: 0.98 }}
        transition={folding
          ? { duration: 0.45, ease: [0.5, 0, 0.75, 0] }
          : { type: 'spring', stiffness: 380, damping: 34 }}
        style={{ transformPerspective: 900, transformOrigin: '50% 0%' }}
        className={cn(
          'relative w-full sm:max-w-md bg-white dark:bg-[#171522]',
          'rounded-t-[28px] sm:rounded-[28px] border border-slate-200/80 dark:border-[#2D283E]',
          'shadow-[0_-12px_60px_rgba(0,0,0,0.35)] max-h-[92dvh] flex flex-col overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            {step === 1 && !isEdit && (
              <button
                type="button" onClick={() => setStep(0)} aria-label="Back to icon picker"
                className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {isEdit ? 'Edit note' : `Step ${step + 1} of 2`}
              </p>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                {step === 0 ? 'Pick an icon' : (isEdit ? 'Update your note' : 'Write your note')}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StepDots step={step} />
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {step === 0 ? (
            /* ---------- STEP 1: icon grid (reel's pastel grid) ---------- */
            <div className="pt-1 pb-2">
              <div className="grid grid-cols-4 gap-3">
                {NOTE_ICONS.map((ic, i) => {
                  const selected = i === iconIdx;
                  return (
                    <motion.button
                      key={ic.label}
                      type="button"
                      onClick={() => { setIconIdx(i); }}
                      onDoubleClick={() => setStep(1)}
                      whileTap={{ scale: 0.88 }}
                      aria-label={ic.label}
                      aria-pressed={selected}
                      className={cn(
                        'aspect-square rounded-[22px] grid place-items-center transition-all cursor-pointer overflow-hidden',
                        selected
                          ? 'ring-[3px] ring-[#0a84ff] ring-offset-2 ring-offset-white dark:ring-offset-[#171522] scale-[1.04]'
                          : 'hover:scale-105 ring-1 ring-black/5 dark:ring-white/10'
                      )}
                    >
                      <ic.Icon className="w-full h-full" />
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-center text-xs text-slate-400 mt-4">
                Tap an icon to select it{!isEdit ? ', then continue' : ''} · double-tap to skip ahead
              </p>
            </div>
          ) : (
            /* ---------- STEP 2: write + tags + link ---------- */
            <div className="pt-1 space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button" onClick={() => setStep(0)} aria-label="Change icon"
                  className="w-12 h-12 shrink-0 cursor-pointer hover:scale-105 transition-transform overflow-hidden rounded-2xl ring-1 ring-black/5 dark:ring-white/10"
                >
                  <icon.Icon className="w-full h-full" />
                </button>
                <div className="min-w-0 flex-1">
                  {link ? (
                    <LinkChip link={link} onRemove={() => setLink(null)} />
                  ) : (
                    <p className="text-xs text-slate-400">Personal note — no link attached</p>
                  )}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Write your note..."
                rows={5}
                maxLength={2000}
                className="w-full bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
              />

              {/* Tags */}
              <div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-700 dark:text-orange-300 text-xs font-semibold"
                    >
                      #{t}
                      <button
                        type="button" onClick={() => setTags(tags.filter(x => x !== t))} aria-label={`Remove tag ${t}`}
                        className="w-5 h-5 rounded-full grid place-items-center hover:bg-orange-500/20 cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-xl px-3 py-2">
                  <Tag size={14} className="text-slate-400 shrink-0" />
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(); } }}
                    onBlur={commitTag}
                    placeholder="Add a tag, e.g. daily"
                    maxLength={24}
                    className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-w-0"
                  />
                  {tagInput.trim() && (
                    <button
                      type="button" onClick={commitTag} aria-label="Add tag"
                      className="p-1 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors cursor-pointer"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium animate-in fade-in">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: the reel's black circular button with orange ring */}
        <div className="flex items-center justify-between px-5 pb-6 pt-1 shrink-0">
          <p className="text-[11px] text-slate-400 max-w-[60%]">
            {step === 0
              ? 'Your icon leads every note in the list.'
              : (link ? 'Tap the × on the link chip to make this a personal note.' : 'Saved notes sync to your account.')}
          </p>
          <RingButton
            onClick={() => (step === 0 ? setStep(1) : handleSave())}
            saving={saving}
            progress={step === 0 ? 1 : ringProgress}
            ariaLabel={step === 0 ? 'Continue to writing' : (isEdit ? 'Save changes' : 'Save note')}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoginPromptSheet({ onClose }: { onClose: () => void }) {
  const { setIsAuthModalOpen } = useAuth();
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label="Sign in required"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full sm:max-w-sm bg-white dark:bg-[#171522] rounded-t-[28px] sm:rounded-[28px] border border-slate-200/80 dark:border-[#2D283E] p-6 text-center shadow-xl"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/15 grid place-items-center text-2xl mb-3">📝</div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">Sign in to save notes</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          Notes are saved permanently to your account and sync across devices — even after app updates.
        </p>
        <button
          type="button"
          onClick={() => { onClose(); setIsAuthModalOpen(true); }}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
        >
          <LogIn size={16} /> Sign in
        </button>
        <button
          type="button" onClick={onClose}
          className="mt-2 w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          Not now
        </button>
      </motion.div>
    </motion.div>
  );
}

/** Mount once (e.g. in Layout) — renders the global note editor. */
export function NoteEditorHost() {
  const { isOpen, initialLink, editingNote, openToken, closeNoteEditor } = useNoteEditor();
  const { user } = useAuth();
  const isGuest = !user || (user as any).isAnonymous === true;

  return (
    <AnimatePresence>
      {isOpen && (isGuest
        ? <LoginPromptSheet key="login" onClose={closeNoteEditor} />
        : (
          <NoteEditorSheet
            key={`editor-${openToken}`}
            initialLink={initialLink}
            editingNote={editingNote}
            openToken={openToken}
            onClose={closeNoteEditor}
          />
        ))}
    </AnimatePresence>
  );
}
