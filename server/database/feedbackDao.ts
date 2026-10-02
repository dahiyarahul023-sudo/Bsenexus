import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { readLocalJson, writeLocalJson } from './localStore.js';

export interface UserFeedback {
  id: string;
  type: 'feedback' | 'bug' | 'feature';
  message: string;
  email?: string;
  userId?: string;
  timestamp: number;
  status: 'new' | 'read' | 'replied';
}

const FEEDBACK_FILE = 'feedback.json';
const feedbackCache: UserFeedback[] = readLocalJson<UserFeedback[]>(FEEDBACK_FILE, []);

let saveFeedbackDiskTimer: NodeJS.Timeout | null = null;
function scheduleFeedbackDiskSave() {
  if (saveFeedbackDiskTimer) return;
  saveFeedbackDiskTimer = setTimeout(() => {
    saveFeedbackDiskTimer = null;
    writeLocalJson(FEEDBACK_FILE, feedbackCache);
  }, 1000);
}

export async function saveFeedback(entry: {
  type: 'feedback' | 'bug' | 'feature';
  message: string;
  email?: string;
  userId?: string;
}): Promise<UserFeedback> {
  const item: UserFeedback = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: entry.type,
    message: entry.message,
    email: entry.email,
    userId: entry.userId,
    timestamp: Date.now(),
    status: 'new',
  };
  feedbackCache.unshift(item);
  if (feedbackCache.length > 1000) feedbackCache.length = 1000;
  scheduleFeedbackDiskSave();

  // Supabase sync runs in the background — NEVER block the API response on it.
  // A slow or unreachable Supabase must not keep the user staring at "sending".
  // The item is already in the memory cache + scheduled for local disk write,
  // and the admin Telegram notification is fire-and-forget in the route.
  if (isSupabaseConfigured()) {
    getSupabase()
      .from('feedback')
      .upsert({ id: item.id, data: item }, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) console.warn('[feedbackDao] cloud sync notice:', error.message);
      });
  }
  return item;
}

export function getAllFeedback(limit: number = 100): UserFeedback[] {
  return feedbackCache.slice(0, Math.max(1, Math.min(500, limit)));
}

export function markFeedbackRead(id: string): boolean {
  const item = feedbackCache.find(f => f.id === id);
  if (!item) return false;
  item.status = 'read';
  scheduleFeedbackDiskSave();
  if (isSupabaseConfigured()) {
    // Best-effort read-modify-write so the stored document keeps all fields.
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('feedback')
          .select('data')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        const merged = { ...((data as any)?.data || {}), status: 'read' };
        const { error: upsertError } = await getSupabase()
          .from('feedback')
          .upsert({ id, data: merged }, { onConflict: 'id' });
        if (upsertError) throw upsertError;
      } catch { /* best-effort */ }
    })();
  }
  return true;
}
