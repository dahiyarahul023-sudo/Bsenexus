import { adminDb } from './firebase.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied } from './localStore.js';

const LOGS_FILE = 'logs.json';
const logsCache: any[] = readLocalJson<any[]>(LOGS_FILE, []);

export async function addLog(level: string, module: string, message: string) {
  const item = {
    id: Date.now().toString() + Math.random().toString().substring(2, 6),
    level: level.substring(0, 45).toUpperCase(),
    module: module.substring(0, 45).toUpperCase(),
    message: message.substring(0, 990),
    timestamp: Date.now()
  };

  logsCache.unshift(item);
  if (logsCache.length > 500) logsCache.pop();
  writeLocalJson(LOGS_FILE, logsCache);
}

export async function clearLogs() {
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

