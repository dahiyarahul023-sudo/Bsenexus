import express from 'express';
import {
  listNotes, createNote, updateNote, deleteNote,
  NOTE_ERROR_MESSAGES, type NoteInput,
} from '../database/notesDao.js';
import { requireAuth, apiRateLimiter } from '../security/auth.js';

/**
 * Saved Notes API — login-required, Firestore-first.
 *
 *  GET    /api/notes        list my notes (newest first)
 *  POST   /api/notes        create { text, icon?, tags?, link? }
 *  PATCH  /api/notes/:id    update { text?, icon?, tags?, link? | null }
 *  DELETE /api/notes/:id    delete
 *
 * Durability contract: a write only reports success after Firestore confirms
 * it. If Firestore is unreachable the API answers 503 with
 * storageUnavailable:true and the client must NOT show "saved" — the draft
 * stays in the editor for retry. Never a silent local-only "save".
 */

export const notesRouter = express.Router();

function uidOf(req: express.Request): string | null {
  const u = (req as any).user;
  return u && typeof u.uid === 'string' && u.uid ? u.uid : null;
}

function storageDown(res: express.Response) {
  return res.status(503).json({
    success: false,
    storageUnavailable: true,
    error: 'Could not reach secure storage. Your note is kept in the editor — please retry in a moment.',
  });
}

notesRouter.get('/', requireAuth, apiRateLimiter, async (req, res) => {
  try {
    const uid = uidOf(req)!;
    const r = await listNotes(uid);
    if (!r.ok) return storageDown(res);
    return res.json({ success: true, notes: r.value, fromCache: r.fromCache === true });
  } catch {
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

notesRouter.post('/', requireAuth, apiRateLimiter, async (req, res) => {
  try {
    const uid = uidOf(req)!;
    const body = (req.body || {}) as NoteInput;
    const r = await createNote(uid, {
      text: body.text,
      icon: body.icon,
      tags: body.tags,
      link: body.link,
    });
    if (!r.ok) {
      if ('validationError' in r) {
        return res.status(400).json({ success: false, error: NOTE_ERROR_MESSAGES[r.validationError] });
      }
      if ('tooMany' in r) {
        return res.status(400).json({ success: false, error: NOTE_ERROR_MESSAGES.too_many_notes });
      }
      return storageDown(res);
    }
    return res.status(201).json({ success: true, note: r.value });
  } catch {
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

notesRouter.patch('/:id', requireAuth, apiRateLimiter, async (req, res) => {
  try {
    const uid = uidOf(req)!;
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ success: false, error: 'Missing note id.' });
    const body = (req.body || {}) as Partial<NoteInput>;
    const patch: Partial<NoteInput> = {};
    if (body.text !== undefined) patch.text = body.text;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.tags !== undefined) patch.tags = body.tags;
    if (body.link !== undefined) patch.link = body.link;
    const r = await updateNote(uid, id, patch);
    if (!r.ok) {
      if ('notFound' in r) return res.status(404).json({ success: false, error: 'Note not found.' });
      if ('validationError' in r) {
        return res.status(400).json({ success: false, error: NOTE_ERROR_MESSAGES[r.validationError] });
      }
      return storageDown(res);
    }
    return res.json({ success: true, note: r.value });
  } catch {
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

notesRouter.delete('/:id', requireAuth, apiRateLimiter, async (req, res) => {
  try {
    const uid = uidOf(req)!;
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ success: false, error: 'Missing note id.' });
    const r = await deleteNote(uid, id);
    if (!r.ok) {
      if ('notFound' in r) return res.status(404).json({ success: false, error: 'Note not found.' });
      return storageDown(res);
    }
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});
