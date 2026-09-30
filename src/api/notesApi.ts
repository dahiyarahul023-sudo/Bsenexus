import { customFetch } from '../api';
import type { UserNote, NoteInput } from '../types';

interface NotesListResponse {
  success: boolean;
  notes?: UserNote[];
  fromCache?: boolean;
  error?: string;
}

interface NoteResponse {
  success: boolean;
  note?: UserNote;
  error?: string;
  storageUnavailable?: boolean;
}

async function parse<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' } as unknown as T;
  }
}

/** List the signed-in user's notes, newest first. */
export async function fetchNotes(): Promise<NotesListResponse> {
  const res = await customFetch('/api/notes', { method: 'GET' });
  return parse<NotesListResponse>(res);
}

/** Create a note. Resolves only after Firestore confirms the write. */
export async function createNoteApi(input: NoteInput): Promise<NoteResponse> {
  const res = await customFetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<NoteResponse>(res);
}

/** Update a note (text, icon, tags, or link — link may be null to unlink). */
export async function updateNoteApi(id: string, patch: Partial<NoteInput>): Promise<NoteResponse> {
  const res = await customFetch(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parse<NoteResponse>(res);
}

/** Delete a note. */
export async function deleteNoteApi(id: string): Promise<{ success: boolean; error?: string; storageUnavailable?: boolean }> {
  const res = await customFetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return parse(res);
}
