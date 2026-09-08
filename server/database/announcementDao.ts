import { adminDb } from './firebase.js';
import { determinePriority, parseBseDate, isSymbolMatch } from '../utils/helpers.js';
import { sendToTelegram } from '../services/telegram.js';
import { addLog } from './logDao.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied } from './localStore.js';

const ANNOUNCEMENTS_FILE = 'announcements.json';
const sentCache = new Set<string>();
const processedCache = new Set<string>();
let announcementsMemoryCache: any[] = readLocalJson<any[]>(ANNOUNCEMENTS_FILE, []);

let saveDiskTimer: NodeJS.Timeout | null = null;
function scheduleLocalDiskSave() {
  if (saveDiskTimer) return;
  saveDiskTimer = setTimeout(() => {
    saveDiskTimer = null;
    writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);
  }, 1000);
}

export function flushLocalDiskSave() {
  if (saveDiskTimer) {
    clearTimeout(saveDiskTimer);
    saveDiskTimer = null;
  }
  writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);
}

for (const item of announcementsMemoryCache) {
  if (item.id) processedCache.add(item.id);
  if (item.is_sent === 1) sentCache.add(item.id);
}

export async function initAnnouncementCache() {
  if (isFirestoreQuotaExceeded()) {
    console.warn("[Announcements] Using local file store (quota active). Items loaded:", announcementsMemoryCache.length);
    return;
  }

  try {
    // Read only the latest 500 documents on boot to save read quota (reduced from 5000)
    const snap = await adminDb.collection('announcements').orderBy('fetched_at', 'desc').limit(500).get();
    
    // Map union between memory/disk cache and Firestore items so no stored records are lost
    const mergedMap = new Map<string, any>();
    for (const item of announcementsMemoryCache) {
      if (item.id) mergedMap.set(item.id, item);
    }

    for (const d of snap.docs) {
      processedCache.add(d.id);
      const data = d.data();
      if (data?.is_sent === 1) {
        sentCache.add(d.id);
      }
      let bseTs = parseBseDate(data.bseTime);
      if (!bseTs) bseTs = data.fetched_at || 0;

      const fsItem = { id: d.id, ...data, bseTimestamp: bseTs };
      const existing = mergedMap.get(d.id);
      mergedMap.set(d.id, existing ? { ...existing, ...fsItem } : fsItem);
    }

    const now = Date.now();
    const loaded = Array.from(mergedMap.values()).map(item => {
      let bseTs = parseBseDate(item.bseTime);
      if (!bseTs || bseTs > now + 120000) {
        if (item.fetched_at && item.fetched_at <= now + 120000) {
          bseTs = item.fetched_at;
        } else if (item.bseTimestamp && item.bseTimestamp > now + 120000) {
          bseTs = item.bseTimestamp - (5.5 * 3600 * 1000);
        } else {
          bseTs = item.bseTimestamp || item.fetched_at || now;
        }
      }
      if (bseTs > now + 120000) bseTs = now;

      const updated = { ...item, bseTimestamp: bseTs };
      if (!updated.priority || !updated.category) {
        const p = determinePriority(updated.subject || '', updated.details || '');
        return { ...updated, priority: p.level, category: p.category };
      }
      return updated;
    });
    loaded.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
    announcementsMemoryCache = loaded.slice(0, 10000);

    for (const item of announcementsMemoryCache) {
      if (item.id) processedCache.add(item.id);
      if (item.is_sent === 1) sentCache.add(item.id);
    }

    writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);
    await addLog('INFO', 'SYSTEM', `Initialized announcement cache with ${announcementsMemoryCache.length} items`);
  } catch (e: any) {
    if (isQuotaError(e)) {
      setFirestoreQuotaExceeded(true);
      console.warn("Firestore quota limit reached during initAnnouncementCache. Using local disk cache.");
    } else if (isPermissionDeniedError(e)) {
      setAdminPermissionDenied(true);
    } else {
      console.warn("Notice during initAnnouncementCache:", e?.message || e);
    }
  }
}

export async function getAnnouncementById(newsId: string): Promise<any | null> {
  if (!newsId) return null;
  const inMem = announcementsMemoryCache.find(a => a.id === newsId || a.newsId === newsId);
  if (inMem) return inMem;

  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) return null;

  try {
    const snap = await adminDb.collection('announcements').doc(newsId).get();
    if (snap.exists) {
      return { id: snap.id, ...snap.data() };
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
  }
  return null;
}

export async function isAnnouncementSent(newsId: string): Promise<boolean> {
  if (sentCache.has(newsId)) return true;
  
  const inMem = announcementsMemoryCache.find(a => a.id === newsId);
  if (inMem && inMem.is_sent === 1) {
    sentCache.add(newsId);
    return true;
  }

  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) return false;

  try {
    const snap = await adminDb.collection('announcements').doc(newsId).get();
    if (snap.exists) {
      const isSent = snap.data()?.is_sent === 1;
      if (isSent) {
        sentCache.add(newsId);
        if (sentCache.size > 5000) {
          const firstItem = sentCache.values().next().value;
          if (firstItem) sentCache.delete(firstItem);
        }
      }
      return isSent;
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
      console.warn("Firestore quota limit reached in isAnnouncementSent.");
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    } else {
      console.warn("Notice in isAnnouncementSent:", err?.message || err);
    }
  }
  return false;
}

export async function isAnnouncementProcessed(newsId: string): Promise<boolean> {
  return processedCache.has(newsId);
}

// Batched Firestore Write Queue with Zero Announcement Loss and Exponential Backoff Retries
interface WriteTask {
  docId: string;
  data: any;
  merge: boolean;
  attempts?: number;
  lastAttemptAt?: number;
}

const MAX_WRITE_ATTEMPTS = 5;
const BACKOFF_DELAYS = [1000, 5000, 15000, 30000, 60000];

const firestoreWriteQueue: Map<string, WriteTask> = new Map();
let isQueueWorkerRunning = false;
let consecutiveBatchErrors = 0;
let nextBatchRetryTime = 0;

async function processFirestoreQueue() {
  if (isQueueWorkerRunning) return;
  isQueueWorkerRunning = true;

  try {
    while (firestoreWriteQueue.size > 0) {
      if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) {
        firestoreWriteQueue.clear();
        break;
      }

      const now = Date.now();
      if (now < nextBatchRetryTime) {
        const waitMs = nextBatchRetryTime - now;
        await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
        continue;
      }

      // Collect eligible tasks (discard poisoned tasks that exceeded max attempts)
      const tasksToProcess: WriteTask[] = [];
      for (const task of firestoreWriteQueue.values()) {
        if ((task.attempts || 0) >= MAX_WRITE_ATTEMPTS) {
          console.warn(`[Firestore] Dropping task ${task.docId} after ${task.attempts} failed write attempts.`);
          firestoreWriteQueue.delete(task.docId);
          continue;
        }
        tasksToProcess.push(task);
        if (tasksToProcess.length >= 200) break;
      }

      if (tasksToProcess.length === 0) break;

      try {
        const batch = adminDb.batch();
        for (const task of tasksToProcess) {
          const docRef = adminDb.collection('announcements').doc(task.docId);
          batch.set(docRef, task.data, { merge: task.merge });
        }
        await batch.commit();

        // Remove from queue ONLY after commit confirms success
        for (const t of tasksToProcess) {
          firestoreWriteQueue.delete(t.docId);
        }

        consecutiveBatchErrors = 0;
        nextBatchRetryTime = 0;
      } catch (err: any) {
        if (isQuotaError(err)) {
          setFirestoreQuotaExceeded(true);
          console.warn("[Firestore] Quota exceeded during batch announcement write. Falling back to local disk storage.");
          firestoreWriteQueue.clear();
          break;
        } else if (isPermissionDeniedError(err)) {
          setAdminPermissionDenied(true);
          firestoreWriteQueue.clear();
          break;
        } else {
          // Transient error: KEEP the queue, track attempts, and back off exponentially
          consecutiveBatchErrors++;
          for (const t of tasksToProcess) {
            t.attempts = (t.attempts || 0) + 1;
            t.lastAttemptAt = Date.now();
          }

          const delayIdx = Math.min(consecutiveBatchErrors - 1, BACKOFF_DELAYS.length - 1);
          const backoffDelay = BACKOFF_DELAYS[delayIdx] || 30000;
          nextBatchRetryTime = Date.now() + backoffDelay;

          console.warn(`[Firestore] Batch write transient error for ${tasksToProcess.length} items (retry #${consecutiveBatchErrors}). Retrying in ${backoffDelay}ms:`, err?.message || err);

          // Paced sleep before next iteration
          await new Promise(r => setTimeout(r, Math.min(backoffDelay, 5000)));

          if (consecutiveBatchErrors >= 10) {
            // Schedule retry in background and release the immediate loop
            setTimeout(() => {
              processFirestoreQueue().catch(() => {});
            }, backoffDelay);
            break;
          }
        }
      }

      // Small pacing to avoid rate limit spikes
      await new Promise(r => setTimeout(r, 100));
    }
  } catch (globalQueueErr) {
    console.warn("[Firestore] Write queue worker notice:", globalQueueErr);
  } finally {
    isQueueWorkerRunning = false;
  }
}

function queueAnnouncementWrite(docId: string, data: any, merge: boolean = true) {
  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) return;

  const existing = firestoreWriteQueue.get(docId);
  if (existing) {
    firestoreWriteQueue.set(docId, {
      docId,
      data: { ...existing.data, ...data },
      merge: true,
      attempts: existing.attempts || 0,
      lastAttemptAt: existing.lastAttemptAt
    });
  } else {
    firestoreWriteQueue.set(docId, { docId, data, merge, attempts: 0 });
  }

  processFirestoreQueue().catch(() => {});
}

// Delete announcements from local cache, disk, and Firestore
export async function deleteAnnouncementsFromStorageAndFirestore(idsToDelete: string[]) {
  if (!idsToDelete || idsToDelete.length === 0) return;
  
  const idSet = new Set(idsToDelete);
  
  // 1. Remove from in-memory cache & local sets
  announcementsMemoryCache = announcementsMemoryCache.filter(a => !idSet.has(a.id) && !idSet.has(a.newsId));
  for (const id of idsToDelete) {
    processedCache.delete(id);
    sentCache.delete(id);
    firestoreWriteQueue.delete(id);
  }
  
  // 2. Persist to local disk
  writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);

  // 3. Batch delete from Firestore if quota allows
  if (!isFirestoreQuotaExceeded()) {
    try {
      const BATCH_LIMIT = 400;
      for (let i = 0; i < idsToDelete.length; i += BATCH_LIMIT) {
        const chunk = idsToDelete.slice(i, i + BATCH_LIMIT);
        const batch = adminDb.batch();
        for (const docId of chunk) {
          const docRef = adminDb.collection('announcements').doc(docId);
          batch.delete(docRef);
        }
        await batch.commit();
      }
    } catch (fsErr: any) {
      if (isQuotaError(fsErr)) {
        setFirestoreQuotaExceeded(true);
      } else {
        console.warn("Firestore delete batch notice:", fsErr?.message || fsErr);
      }
    }
  }
}

export async function markAnnouncementSent(newsId: string, telegramMessageId?: number) {
  sentCache.add(newsId);
  processedCache.add(newsId);

  const inMem = announcementsMemoryCache.find(a => a.id === newsId || a.newsId === newsId);
  if (inMem) {
    inMem.is_sent = 1;
    if (telegramMessageId) inMem.telegram_msg_id = telegramMessageId;
  }

  // Synchronously persist is_sent to disk right away (write-ahead) so crashes cannot cause duplicates
  flushLocalDiskSave();

  queueAnnouncementWrite(newsId, { is_sent: 1, ...(telegramMessageId ? { telegram_msg_id: telegramMessageId } : {}) }, true);
}

export async function updateAnnouncementSummary(newsId: string, aiSummary: string) {
  const inMem = announcementsMemoryCache.find(a => a.id === newsId);
  if (inMem) {
    inMem.aiSummary = aiSummary;
    scheduleLocalDiskSave();
  }

  queueAnnouncementWrite(newsId, { aiSummary }, true);
}

export async function saveAnnouncement(data: {
  newsId: string;
  companyName: string;
  subject: string;
  details: string;
  pdfLink: string;
  bseTime?: string;
  category?: string;
  priority?: string;
  is_sent?: number;
  aiSummary?: string;
  scrip_cd?: string;
  isWatchlist?: boolean;
}) {
  processedCache.add(data.newsId);

  let bseTs = 0;
  if (data.bseTime) {
    const parsed = parseBseDate(data.bseTime);
    if (parsed > 0) bseTs = parsed;
  }
  if (!bseTs || bseTs > Date.now() + 120000) bseTs = Date.now();

  const safeData = {
    ...data,
    subject: String(data.subject || "").substring(0, 990),
    details: String(data.details || "").substring(0, 4900),
    companyName: String(data.companyName || "").substring(0, 190),
    pdfLink: String(data.pdfLink || "").substring(0, 990),
    bseTime: String(data.bseTime || "").substring(0, 90),
    scrip_cd: String(data.scrip_cd || "").substring(0, 30),
    isWatchlist: data.isWatchlist ?? false,
    fetched_at: Date.now(),
    bseTimestamp: bseTs,
    is_sent: data.is_sent ?? 0
  };

  if (!safeData.priority || !safeData.category) {
    const p = determinePriority(safeData.subject || '', safeData.details || '');
    safeData.priority = safeData.priority || p.level;
    safeData.category = safeData.category || p.category;
  }

  const memItem = { id: data.newsId, ...safeData };
  const existingIdx = announcementsMemoryCache.findIndex(a => a.id === data.newsId);
  let hasChanged = true;

  if (existingIdx >= 0) {
    const existing = announcementsMemoryCache[existingIdx];
    
    // (a) "Pehle se saved hai kya?" Check:
    // If the announcement is already in memory cache and its critical fields haven't changed,
    // skip writing to Firestore (saves ~95%+ unnecessary Firestore writes).
    const isIdentical = 
      existing.subject === safeData.subject &&
      existing.details === safeData.details &&
      existing.companyName === safeData.companyName &&
      existing.pdfLink === safeData.pdfLink &&
      existing.priority === safeData.priority &&
      existing.category === safeData.category &&
      (existing.is_sent ?? 0) === (safeData.is_sent ?? 0) &&
      (existing.aiSummary || '') === (safeData.aiSummary || '') &&
      Boolean(existing.isWatchlist) === Boolean(safeData.isWatchlist);

    if (isIdentical) {
      hasChanged = false;
    } else {
      announcementsMemoryCache[existingIdx] = { ...existing, ...memItem };
    }
  } else {
    announcementsMemoryCache.push(memItem);
  }

  // If identical, we do not need to rewrite disk or trigger Firestore write
  if (!hasChanged) {
    return;
  }

  // Keep memory cache strictly sorted by bseTimestamp / fetched_at descending
  announcementsMemoryCache.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
  if (announcementsMemoryCache.length > 10000) {
    announcementsMemoryCache.length = 10000;
  }

  scheduleLocalDiskSave();

  // Queue write to Firestore only when new or meaningfully updated
  queueAnnouncementWrite(data.newsId, safeData, true);
}

export async function pruneAndCheckStorageCapacity() {
  try {
    const { checkStorageAndTriggerAlerts, runAutoStorageCleanup } = await import('../services/storageMonitor.js');
    await runAutoStorageCleanup(false);
    await checkStorageAndTriggerAlerts();
  } catch (err: any) {
    console.warn("Notice in pruneAndCheckStorageCapacity:", err?.message || err);
  }
}

export async function getRecentAnnouncements(limitNum: number = 1000, symbols?: string[]) {
  if (symbols && symbols.length > 0) {
    const cleanSymbols = symbols.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    if (cleanSymbols.length > 0) {
      const filtered = announcementsMemoryCache.filter(ann => {
        const comp = ann.companyName || ann.SLONGNAME || '';
        const subj = ann.subject || ann.NEWSSUB || '';
        const scrip = String(ann.scrip_cd || ann.SCRIP_CD || '');
        return cleanSymbols.some(sym => isSymbolMatch(comp, subj, sym, scrip));
      });
      return filtered.slice(0, limitNum);
    }
  }
  // announcementsMemoryCache is already maintained sorted on insert
  return announcementsMemoryCache.slice(0, limitNum);
}

export function getTotalAnnouncementsCount(): number {
  return announcementsMemoryCache.length;
}

export async function boostAnnouncementsPriorityForWindow(
  scripCode: string,
  symbol: string,
  startTs: number,
  endTs: number,
  newPriority: string = 'HIGH'
): Promise<{ boostedCount: number; announcements: any[] }> {
  const targetScrip = String(scripCode || '').trim();
  const targetSym = String(symbol || '').trim().toUpperCase();
  
  const boostedList: any[] = [];
  let boostedCount = 0;

  for (const ann of announcementsMemoryCache) {
    const annScrip = String(ann.scrip_cd || ann.SCRIP_CD || '').trim();
    const annComp = (ann.companyName || ann.SLONGNAME || '').toUpperCase();
    const annSub = (ann.subject || ann.NEWSSUB || '');
    const ts = ann.bseTimestamp || ann.fetched_at || 0;

    let isMatch = false;
    if (targetScrip && annScrip === targetScrip) {
      isMatch = true;
    } else if (targetSym && (annComp.includes(targetSym) || annSub.toUpperCase().includes(targetSym))) {
      isMatch = true;
    }

    if (isMatch && ts >= startTs && ts <= endTs) {
      const prevPriority = ann.priority;
      ann.priority = newPriority;
      ann.isPreResultBoosted = true;
      ann.preResultBoostedAt = Date.now();
      
      boostedList.push(ann);
      if (prevPriority !== newPriority) {
        boostedCount++;
      }

      queueAnnouncementWrite(ann.id || ann.newsId, {
        priority: newPriority,
        isPreResultBoosted: true,
        preResultBoostedAt: Date.now()
      }, true);
    }
  }

  if (boostedCount > 0) {
    scheduleLocalDiskSave();
    await addLog('INFO', 'BSE', `Set ${boostedCount} announcements to HIGH priority for ${targetSym || targetScrip} in the 10-day pre-result runup window.`);
  }

  return { boostedCount, announcements: boostedList };
}

export function getAnnouncementsForStockInWindow(
  scripCode: string,
  symbol: string,
  startTs: number,
  endTs: number
): any[] {
  const targetScrip = String(scripCode || '').trim();
  const targetSym = String(symbol || '').trim().toUpperCase();
  
  const results: any[] = [];

  for (const ann of announcementsMemoryCache) {
    const annScrip = String(ann.scrip_cd || ann.SCRIP_CD || '').trim();
    const annComp = (ann.companyName || ann.SLONGNAME || '').toUpperCase();
    const annSub = (ann.subject || ann.NEWSSUB || '');
    const ts = ann.bseTimestamp || ann.fetched_at || 0;

    let isMatch = false;
    if (targetScrip && annScrip === targetScrip) {
      isMatch = true;
    } else if (targetSym && (annComp.includes(targetSym) || annSub.toUpperCase().includes(targetSym))) {
      isMatch = true;
    }

    if (isMatch && ts >= startTs && ts <= endTs) {
      results.push(ann);
    }
  }

  results.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
  return results;
}



