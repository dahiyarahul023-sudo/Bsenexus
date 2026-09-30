import crypto from 'node:crypto';
import { adminDb } from './firebase.js';
import { withRetry } from '../utils/retry.js';
import {
  isFirestoreQuotaExceeded, setFirestoreQuotaExceeded,
  isQuotaError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied,
  isOfflineOrNetworkError,
  readLocalJson, writeLocalJson,
} from './localStore.js';

/**
 * Saved Notes DAO — Firestore-FIRST storage.
 *
 * Durability contract (the rule the user was promised):
 *  - Writes (create/update/delete) go to Firestore FIRST. The note is only
 *    reported as saved after the Firestore write succeeds.
 *  - If Firestore is unavailable (quota exceeded, offline, permission denied),
 *    the write FAILS LOUDLY ({ ok:false, storageUnavailable:true }) and is
 *    NEVER silently persisted to the ephemeral local JSON. The client keeps
 *    the draft and shows "couldn't save — retry". A republish must never be
 *    able to wipe a note the user believes is saved.
 *  - Reads fall back to the local cache when Firestore is unreachable —
 *    a stale read is safe, a fake write is not.
 */

export type NoteLinkType = 'stock' | 'news' | 'result' | 'filing';

export interface NoteLink {
  type: NoteLinkType;
  /** Human label, e.g. "RELIANCE", "RBI policy article", "INFY Q2 results". */
  label: string;
  /** Stock symbol for tap-to-jump into the company intelligence modal. */
  symbol?: string;
  /** External URL for tap-to-jump (news articles). */
  url?: string;
}

export interface UserNote {
  id: string;
  userId: string;
  text: string;
  /** Index into the client NOTE_ICONS set (reel-style icon picker). */
  icon: number;
  tags: string[];
  link: NoteLink | null;
  createdAt: number;
  updatedAt: number;
}

export interface NoteInput {
  text: string;
  icon?: number;
  tags?: string[];
  link?: NoteLink | null;
}

const NOTES_COLLECTION = 'user_notes';
const NOTES_FILE = 'user_notes.json';

export const NOTE_LIMITS = {
  maxNotesPerUser: 200,
  maxTextLen: 2000,
  minTextLen: 1,
  maxTags: 8,
  maxTagLen: 24,
  maxLabelLen: 120,
  maxIcons: 12, // must match client NOTE_ICONS length
} as const;

export type NoteValidationError =
  | 'text_required' | 'text_too_long'
  | 'too_many_notes'
  | 'too_many_tags' | 'tag_too_long'
  | 'bad_icon' | 'bad_link';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Pure validation — unit-tested in server/tests/notes.test.ts */
export function validateNoteInput(input: NoteInput): { ok: true; note: Required<Pick<NoteInput,'text'>> & Omit<NoteInput,'text'> } | { ok: false; error: NoteValidationError } {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) return { ok: false, error: 'text_required' };
  if (text.length > NOTE_LIMITS.maxTextLen) return { ok: false, error: 'text_too_long' };

  const icon = input.icon ?? 0;
  if (!Number.isInteger(icon) || icon < 0 || icon >= NOTE_LIMITS.maxIcons) {
    return { ok: false, error: 'bad_icon' };
  }

  const rawTags = Array.isArray(input.tags) ? input.tags : [];
  const tags: string[] = [];
  for (const t of rawTags) {
    if (typeof t !== 'string') continue;
    const clean = t.trim().replace(/^#+/, '').slice(0, NOTE_LIMITS.maxTagLen);
    if (clean && !tags.includes(clean.toLowerCase())) tags.push(clean.toLowerCase());
    if (tags.length >= NOTE_LIMITS.maxTags) break;
  }

  let link: NoteLink | null = null;
  if (input.link != null) {
    const l = input.link as any;
    if (!l || typeof l !== 'object' || !['stock', 'news', 'result', 'filing'].includes(l.type) || !isNonEmptyString(l.label)) {
      return { ok: false, error: 'bad_link' };
    }
    link = {
      type: l.type as NoteLinkType,
      label: l.label.trim().slice(0, NOTE_LIMITS.maxLabelLen),
    };
    if (isNonEmptyString(l.symbol)) link.symbol = l.symbol.trim().toUpperCase().slice(0, 32);
    if (isNonEmptyString(l.url) && /^https?:\/\//i.test(l.url.trim())) link.url = l.url.trim().slice(0, 500);
  }

  return { ok: true, note: { text, icon, tags, link } };
}

export const NOTE_ERROR_MESSAGES: Record<NoteValidationError, string> = {
  text_required: 'Write something first.',
  text_too_long: `Notes are limited to ${NOTE_LIMITS.maxTextLen} characters.`,
  too_many_notes: `You can save up to ${NOTE_LIMITS.maxNotesPerUser} notes. Delete an old one to make room.`,
  too_many_tags: `A note can have up to ${NOTE_LIMITS.maxTags} tags.`,
  tag_too_long: `Tags are limited to ${NOTE_LIMITS.maxTagLen} characters.`,
  bad_icon: 'Please pick a valid icon.',
  bad_link: 'That linked item looks invalid. Try saving the note again.',
};

// ---- local read-cache (read fallback only; never a silent write target) ----

function readCache(): UserNote[] {
  return readLocalJson<UserNote[]>(NOTES_FILE, []);
}

function writeCache(notes: UserNote[]): void {
  try { writeLocalJson(NOTES_FILE, notes); } catch { /* cache must never break writes */ }
}

function upsertCache(note: UserNote): void {
  const all = readCache();
  const i = all.findIndex(n => n.id === note.id);
  if (i >= 0) all[i] = note; else all.push(note);
  writeCache(all);
}

function removeFromCache(id: string): void {
  writeCache(readCache().filter(n => n.id !== id));
}

function cloudDown(): boolean {
  return isFirestoreQuotaExceeded() || isAdminPermissionDenied();
}

function markCloudError(err: any): void {
  if (isQuotaError(err)) setFirestoreQuotaExceeded(true);
  else if (isPermissionDeniedError(err)) setAdminPermissionDenied(true);
}

export type DaoResult<T> = { ok: true; value: T; fromCache?: boolean } | { ok: false; storageUnavailable: true };

export type NoteWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; validationError: NoteValidationError }
  | { ok: false; tooMany: true }
  | { ok: false; notFound: true }
  | { ok: false; storageUnavailable: true };

/** List the user's notes, newest first. Falls back to local cache on read. */
export async function listNotes(userId: string): Promise<DaoResult<UserNote[]>> {
  if (!cloudDown()) {
    try {
      const snap = await withRetry(async () =>
        await adminDb.collection(NOTES_COLLECTION).where('userId', '==', userId).get()
      , { maxRetries: 1 });
      const notes: UserNote[] = [];
      snap.forEach(d => {
        const n = d.data() as UserNote;
        if (n && n.id) notes.push(n);
      });
      notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      // Refresh the read cache with the cloud truth.
      const others = readCache().filter(n => n.userId !== userId);
      writeCache([...others, ...notes]);
      return { ok: true, value: notes };
    } catch (err: any) {
      markCloudError(err);
      if (!isOfflineOrNetworkError(err)) console.warn('[notesDao] list fallback to cache:', err?.message || err);
    }
  }
  const cached = readCache().filter(n => n.userId === userId)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { ok: true, value: cached, fromCache: true };
}

/** Create a note — Firestore FIRST. Loud failure, never a silent local write. */
export async function createNote(userId: string, input: NoteInput): Promise<NoteWriteResult<UserNote>> {
  const v = validateNoteInput(input);
  if (v.ok === false) return { ok: false, validationError: v.error };

  if (cloudDown()) return { ok: false, storageUnavailable: true };

  const now = Date.now();
  const note: UserNote = {
    id: crypto.randomUUID(),
    userId,
    text: v.note.text,
    icon: v.note.icon,
    tags: v.note.tags,
    link: v.note.link,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Enforce the per-user cap against cloud truth, not the cache.
    const countSnap = await withRetry(async () =>
      await adminDb.collection(NOTES_COLLECTION).where('userId', '==', userId).count().get()
    , { maxRetries: 1 });
    if ((countSnap.data().count || 0) >= NOTE_LIMITS.maxNotesPerUser) {
      return { ok: false, tooMany: true };
    }
    await withRetry(async () => {
      await adminDb.collection(NOTES_COLLECTION).doc(note.id).set(note);
    }, { maxRetries: 1 });
  } catch (err: any) {
    markCloudError(err);
    return { ok: false, storageUnavailable: true };
  }

  upsertCache(note);
  return { ok: true, value: note };
}

/** Update a note — ownership-checked, Firestore FIRST. */
export async function updateNote(userId: string, id: string, input: Partial<NoteInput>): Promise<NoteWriteResult<UserNote>> {
  if (cloudDown()) return { ok: false, storageUnavailable: true };
  try {
    const ref = adminDb.collection(NOTES_COLLECTION).doc(id);
    const snap = await withRetry(async () => await ref.get(), { maxRetries: 1 });
    if (!snap.exists) return { ok: false, notFound: true };
    const existing = snap.data() as UserNote;
    if (existing.userId !== userId) return { ok: false, notFound: true }; // no cross-user oracle

    const merged: NoteInput = {
      text: typeof input.text === 'string' ? input.text : existing.text,
      icon: typeof input.icon === 'number' ? input.icon : existing.icon,
      tags: Array.isArray(input.tags) ? input.tags : existing.tags,
      link: input.link !== undefined ? input.link : existing.link,
    };
    const v = validateNoteInput(merged);
    if (v.ok === false) return { ok: false, validationError: v.error };

    const updated: UserNote = { ...existing, text: v.note.text, icon: v.note.icon, tags: v.note.tags, link: v.note.link, updatedAt: Date.now() };
    await withRetry(async () => { await ref.set(updated, { merge: true }); }, { maxRetries: 1 });
    upsertCache(updated);
    return { ok: true, value: updated };
  } catch (err: any) {
    markCloudError(err);
    return { ok: false, storageUnavailable: true };
  }
}

/** Delete a note — ownership-checked, Firestore FIRST. */
export async function deleteNote(userId: string, id: string): Promise<{ ok: true } | { ok: false; notFound: true } | { ok: false; storageUnavailable: true }> {
  if (cloudDown()) return { ok: false, storageUnavailable: true };
  try {
    const ref = adminDb.collection(NOTES_COLLECTION).doc(id);
    const snap = await withRetry(async () => await ref.get(), { maxRetries: 1 });
    if (!snap.exists) return { ok: false, notFound: true };
    const existing = snap.data() as UserNote;
    if (existing.userId !== userId) return { ok: false, notFound: true };
    await withRetry(async () => { await ref.delete(); }, { maxRetries: 1 });
    removeFromCache(id);
    return { ok: true };
  } catch (err: any) {
    markCloudError(err);
    return { ok: false, storageUnavailable: true };
  }
}
