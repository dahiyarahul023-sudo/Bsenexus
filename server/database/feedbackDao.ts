import { adminDb } from './firebase.js';
import { readLocalJson, writeLocalJson, isQuotaError, isPermissionDeniedError, setFirestoreQuotaExceeded, setAdminPermissionDenied } from './localStore.js';

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

  try {
    await adminDb.collection('feedback').doc(item.id).set(item);
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
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
  adminDb.collection('feedback').doc(id).set({ status: 'read' }, { merge: true }).catch(() => {});
  return true;
}
