import { adminDb } from './firebase.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied } from './localStore.js';

const LOGS_FILE = 'logs.json';
const logsCache: any[] = readLocalJson<any[]>(LOGS_FILE, []);

// Redacts sensitive credentials (Item 12: Remove sensitive logs)
export function sanitizeSensitiveLog(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    // Redact Telegram Bot Tokens (e.g. 123456789:ABCdefGhIjkLmNoPqRsTuVwXyZ)
    .replace(/\b\d{8,12}:[a-zA-Z0-9_-]{35}\b/g, '[REDACTED_TELEGRAM_TOKEN]')
    // Redact Bearer tokens & JWTs
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]')
    // Redact Google / Firebase API keys (AIza...)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    // Redact bcrypt hashes ($2a$... / $2b$...)
    .replace(/\$2[aby]\$\d{2}\$[./0-9A-Za-z]{53}/g, '[REDACTED_HASH]')
    // Redact PIN / password fields in JSON or URL params
    .replace(/("?(?:pin|password|token|secret|apiKey)"?\s*[:=]\s*)"[^"]+"/gi, '$1"[REDACTED]"')
    .replace(/("?(?:pin|password|token|secret|apiKey)"?\s*[:=]\s*)[^\s,{}]+/gi, '$1[REDACTED]');
}

let saveLogsDiskTimer: NodeJS.Timeout | null = null;

export function scheduleLogsDiskSave() {
  if (saveLogsDiskTimer) return;
  saveLogsDiskTimer = setTimeout(() => {
    saveLogsDiskTimer = null;
    writeLocalJson(LOGS_FILE, logsCache);
  }, 1000);
}

export function flushLogsDiskSave() {
  if (saveLogsDiskTimer) {
    clearTimeout(saveLogsDiskTimer);
    saveLogsDiskTimer = null;
  }
  writeLocalJson(LOGS_FILE, logsCache);
}

export async function addLog(level: string, module: string, message: string) {
  const sanitizedMessage = sanitizeSensitiveLog(message);
  const item = {
    id: Date.now().toString() + Math.random().toString().substring(2, 6),
    level: level.substring(0, 45).toUpperCase(),
    module: module.substring(0, 45).toUpperCase(),
    message: sanitizedMessage.substring(0, 990),
    timestamp: Date.now()
  };

  logsCache.unshift(item);
  if (logsCache.length > 500) logsCache.pop();
  scheduleLogsDiskSave();
}

export async function addLogsBatch(entries: { level: string; module: string; message: string }[]) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const now = Date.now();
  for (const entry of entries) {
    if (!entry) continue;
    const sanitizedMessage = sanitizeSensitiveLog(entry.message || '');
    logsCache.unshift({
      id: `${now}_${Math.random().toString(36).slice(2, 6)}`,
      level: (entry.level || 'INFO').substring(0, 45).toUpperCase(),
      module: (entry.module || 'SYSTEM').substring(0, 45).toUpperCase(),
      message: sanitizedMessage.substring(0, 990),
      timestamp: now
    });
  }
  if (logsCache.length > 500) {
    logsCache.length = 500;
  }
  scheduleLogsDiskSave();
}

export async function clearLogs() {
  if (saveLogsDiskTimer) {
    clearTimeout(saveLogsDiskTimer);
    saveLogsDiskTimer = null;
  }
  logsCache.length = 0;
  writeLocalJson(LOGS_FILE, logsCache);
}

export async function getLogs(limitNum: number = 200) {
  if (logsCache.length > 0 || isFirestoreQuotaExceeded() || isAdminPermissionDenied()) {
    return logsCache.slice(0, limitNum);
  }

  try {
    const snap = await adminDb.collection('logs').orderBy('timestamp', 'desc').limit(limitNum).get();
    const loaded = snap.docs.map(doc => doc.data());
    logsCache.length = 0;
    logsCache.push(...loaded);
    writeLocalJson(LOGS_FILE, logsCache);
    return loaded;
  } catch (e: any) {
    if (isQuotaError(e)) {
      setFirestoreQuotaExceeded(true);
      console.warn("Firestore quota limit reached in getLogs. Returning local logs.");
    } else if (isPermissionDeniedError(e)) {
      setAdminPermissionDenied(true);
    } else {
      console.warn("Notice in getLogs:", e?.message || e);
    }
    return logsCache.slice(0, limitNum);
  }
}

