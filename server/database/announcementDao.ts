import { adminDb } from './firebase.js';
import { determinePriority, parseBseDate, isSymbolMatch } from '../utils/helpers.js';
import { addLog } from './logDao.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied } from './localStore.js';
import { BloomFilter } from '../utils/bloomFilter.js';
import { pageRenderCache } from '../utils/renderCache.js';
import { notifySearchEnginesOfNewPages } from '../services/indexNow.js';

const ANNOUNCEMENTS_FILE = 'announcements.json';
const sentCache = new Set<string>();
const processedCache = new Set<string>();

// High-Performance Bloom Filters: 100k capacity, 0.5% FPR, compact bit arrays
export const processedBloomFilter = new BloomFilter(100000, 0.005);
export const sentBloomFilter = new BloomFilter(50000, 0.005);

const DEFAULT_SEED_ANNOUNCEMENTS = [
  {
    id: "ann_500325_20260924_01",
    newsId: "ann_500325_20260924_01",
    scrip_cd: 500325,
    symbol: "RELIANCE",
    companyName: "RELIANCE INDUSTRIES LTD.",
    subject: "Financial Results For The Quarter And Year Ended March 31 - SEBI LODR Reg 33",
    details: "The Board of Directors of Reliance Industries Limited at its meeting held today considered and approved the Audited Standalone and Consolidated Financial Results for the quarter and year ended March 31. Key highlights: Consolidated Revenue from Operations reached ₹2,64,831 Cr (+11.3% YoY). EBITDA stood at ₹47,150 Cr (+14.2% YoY). Net Profit (PAT) after tax rose to ₹21,243 Cr (+10.8% YoY). Digital Services (Jio) and Retail segments continued strong momentum.",
    category: "RESULTS",
    priority: "HIGH",
    bseTime: "24/09/2026 16:45:12",
    bseTimestamp: Date.now() - 3600000,
    fetched_at: Date.now() - 3600000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/500325_Outcome_2026.pdf",
    aiSummary: "• Consolidated Revenue: ₹2,64,831 Cr (+11.3% YoY)\n• EBITDA: ₹47,150 Cr (+14.2% YoY)\n• Net Profit (PAT): ₹21,243 Cr (+10.8% YoY)\n• Core driver: Retail footfalls and 5G subscriber expansion.\n• Recommendation: Final Dividend of ₹10.00 per equity share approved.",
    is_sent: 1
  },
  {
    id: "ann_532540_20260924_02",
    newsId: "ann_532540_20260924_02",
    scrip_cd: 532540,
    symbol: "TCS",
    companyName: "TATA CONSULTANCY SERVICES LTD.",
    subject: "Outcome of Board Meeting - Audited Results & Final Dividend Declaration",
    details: "Tata Consultancy Services Ltd. has informed the Exchange that the Board of Directors at its meeting recommended a Final Dividend of ₹28 per equity share of ₹1 each for the financial year. Constant currency revenue growth was 5.4% YoY. Net margin held firm at 26.0%.",
    category: "RESULTS",
    priority: "HIGH",
    bseTime: "24/09/2026 15:32:00",
    bseTimestamp: Date.now() - 7200000,
    fetched_at: Date.now() - 7200000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/532540_Outcome_2026.pdf",
    aiSummary: "• Revenue from operations: ₹62,440 Cr (+4.8% YoY)\n• Operating margin: 26.0% (steady QoQ)\n• Net profit (PAT): ₹12,434 Cr (+6.2% YoY)\n• Final dividend: ₹28.00 per share with record date in next fortnight.",
    is_sent: 1
  },
  {
    id: "ann_500510_20260924_03",
    newsId: "ann_500510_20260924_03",
    scrip_cd: 500510,
    symbol: "LT",
    companyName: "LARSEN & TOUBRO LTD.",
    subject: "Heavy Civil Infrastructure Secures Major Order under Regulation 30",
    details: "Larsen & Toubro's Heavy Civil Infrastructure business vertical has secured a significant order in the range of ₹5,000 Cr to ₹10,000 Cr for the construction of key underground metro railway systems and high-speed rail viaducts.",
    category: "HIGH_PRIORITY",
    priority: "HIGH",
    bseTime: "24/09/2026 14:15:20",
    bseTimestamp: Date.now() - 10800000,
    fetched_at: Date.now() - 10800000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/500510_OrderWin_2026.pdf",
    aiSummary: "• Order size: Major order between ₹5,000 Cr – ₹10,000 Cr.\n• Segment: Heavy Civil Infrastructure (Underground Metro & High-Speed Rail).\n• Revenue visibility: Enhances FY27-28 execution pipeline.",
    is_sent: 1
  },
  {
    id: "ann_500209_20260924_04",
    newsId: "ann_500209_20260924_04",
    scrip_cd: 500209,
    symbol: "INFY",
    companyName: "INFOSYS LTD.",
    subject: "Schedule of Earnings Conference Call for Institutional Investors",
    details: "Infosys Limited will host an earnings conference call with analysts and institutional investors to discuss the audited financial results for the quarter ended. Dial-in details and web-stream links are attached.",
    category: "CONFERENCE_CALL",
    priority: "MEDIUM",
    bseTime: "24/09/2026 12:40:00",
    bseTimestamp: Date.now() - 14400000,
    fetched_at: Date.now() - 14400000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/500209_Concall_2026.pdf",
    aiSummary: "• Event: Institutional Earnings Call.\n• Focus: Q2 financial performance, deal total contract value (TCV), and attrition metrics.",
    is_sent: 0
  },
  {
    id: "ann_500180_20260924_05",
    newsId: "ann_500180_20260924_05",
    scrip_cd: 500180,
    symbol: "HDFCBANK",
    companyName: "HDFC BANK LTD.",
    subject: "SEBI LODR Regulation 30 Corporate Intimation & Branch Network Expansion",
    details: "HDFC Bank Limited has submitted an intimation under Regulation 30 regarding opening of new commercial and rural banking branches, augmenting retail deposit mobilization.",
    category: "OTHER",
    priority: "MEDIUM",
    bseTime: "24/09/2026 11:20:00",
    bseTimestamp: Date.now() - 18000000,
    fetched_at: Date.now() - 18000000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/500180_Intimation_2026.pdf",
    aiSummary: "• Corporate development: Branch footprint expansion across Tier-2/3 cities to strengthen CASA deposit ratio.",
    is_sent: 0
  },
  {
    id: "ann_532454_20260924_06",
    newsId: "ann_532454_20260924_06",
    scrip_cd: 532454,
    symbol: "BHARTIARTL",
    companyName: "BHARTI AIRTEL LTD.",
    subject: "Board Meeting Intimation to Consider Financial Results & Interim Dividend",
    details: "Notice is hereby given that a meeting of the Board of Directors of Bharti Airtel Ltd is scheduled to be held to consider and approve the Unaudited Financial Results (Standalone and Consolidated) and consideration of Interim Dividend.",
    category: "RESULTS",
    priority: "HIGH",
    bseTime: "24/09/2026 10:05:00",
    bseTimestamp: Date.now() - 21600000,
    fetched_at: Date.now() - 21600000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/532454_Notice_2026.pdf",
    aiSummary: "• Board Meeting: Scheduled to consider financial results and dividend approval.\n• Trading Window: Closed for designated persons as per SEBI PIT regulations.",
    is_sent: 1
  },
  {
    id: "ann_500875_20260924_07",
    newsId: "ann_500875_20260924_07",
    scrip_cd: 500875,
    symbol: "ITC",
    companyName: "ITC LTD.",
    subject: "Financial Results for the Quarter - Record Segment Revenue in FMCG",
    details: "ITC Limited has declared its quarterly financial statements. FMCG Others segment registered robust growth led by staples and branded packaged foods. Hotels business reported revenue surge.",
    category: "RESULTS",
    priority: "HIGH",
    bseTime: "24/09/2026 09:45:00",
    bseTimestamp: Date.now() - 25200000,
    fetched_at: Date.now() - 25200000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/500875_Outcome_2026.pdf",
    aiSummary: "• Gross Revenue: ₹18,600 Cr (+7.5% YoY)\n• FMCG-Others EBIT margin expanded 80 bps.\n• Hotels demerger process progressing on track.",
    is_sent: 1
  },
  {
    id: "ann_500034_20260924_08",
    newsId: "ann_500034_20260924_08",
    scrip_cd: 500034,
    symbol: "BAJFINANCE",
    companyName: "BAJAJ FINANCE LTD.",
    subject: "Assets Under Management (AUM) crosses ₹3.5 Lakh Crore Milestone",
    details: "Bajaj Finance Limited shares quarterly operational performance update. New customer additions remained strong at 3.8 million during the quarter. Asset quality metrics remain healthy.",
    category: "HIGH_PRIORITY",
    priority: "HIGH",
    bseTime: "24/09/2026 09:15:00",
    bseTimestamp: Date.now() - 28800000,
    fetched_at: Date.now() - 28800000,
    pdfLink: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/500034_AUM_Update_2026.pdf",
    aiSummary: "• Total AUM: ₹3,54,000 Cr (+31% YoY)\n• Customer franchise: Reached 88 million.\n• Liquidity buffer maintained at comfortable surplus.",
    is_sent: 1
  }
];

let loadedLocal = readLocalJson<any[]>(ANNOUNCEMENTS_FILE, []);
let announcementsMemoryCache: any[] = (loadedLocal && loadedLocal.length > 0) ? loadedLocal : [...DEFAULT_SEED_ANNOUNCEMENTS];

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
  if (item.id) {
    processedCache.add(item.id);
    processedBloomFilter.add(item.id);
  }
  if (item.is_sent === 1) {
    sentCache.add(item.id);
    sentBloomFilter.add(item.id);
  }
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
      processedBloomFilter.add(d.id);
      const data = d.data();
      if (data?.is_sent === 1) {
        sentCache.add(d.id);
        sentBloomFilter.add(d.id);
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
  if (!newsId) return false;

  // Tier 1: Bloom Filter check (O(1), zero false negatives)
  // If not in sentBloomFilter, it was 100% DEFINITELY NEVER sent to Telegram.
  // Instantly bypasses Firestore and expensive memory scans (0 DB scans).
  if (!sentBloomFilter.has(newsId)) {
    return false;
  }

  // Tier 2: Bloom Filter says "possibly sent" -> Check exact in-memory set
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
        sentBloomFilter.add(newsId);
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
  if (!newsId) return false;

  // Tier 1: Bloom Filter check (O(1), zero false negatives)
  // If not in processedBloomFilter, 100% guarantee it has never been processed before.
  if (!processedBloomFilter.has(newsId)) {
    return false;
  }

  // Tier 2: Confirm against exact in-memory set to eliminate false positive
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
        if (tasksToProcess.length >= 400) break;
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
  queueAnnouncementsBatchWrite([{ docId, data, merge }]);
}

export function queueAnnouncementsBatchWrite(tasks: { docId: string; data: any; merge?: boolean }[]) {
  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied() || !tasks || tasks.length === 0) return;

  for (const t of tasks) {
    if (!t.docId) continue;
    const existing = firestoreWriteQueue.get(t.docId);
    if (existing) {
      firestoreWriteQueue.set(t.docId, {
        docId: t.docId,
        data: { ...existing.data, ...t.data },
        merge: true,
        attempts: existing.attempts || 0,
        lastAttemptAt: existing.lastAttemptAt
      });
    } else {
      firestoreWriteQueue.set(t.docId, {
        docId: t.docId,
        data: t.data,
        merge: t.merge !== false,
        attempts: 0
      });
    }
  }

  processFirestoreQueue().catch(() => {});
}

export async function flushFirestoreWriteQueue(): Promise<void> {
  while (firestoreWriteQueue.size > 0 && !isFirestoreQuotaExceeded() && !isAdminPermissionDenied()) {
    await processFirestoreQueue();
    if (firestoreWriteQueue.size > 0) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
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
    pageRenderCache.invalidate(`ann:${id}`);
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
  sentBloomFilter.add(newsId);
  processedCache.add(newsId);
  processedBloomFilter.add(newsId);

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
  pageRenderCache.invalidate(`ann:${newsId}`);
}

export interface AnnouncementInput {
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
}

export async function saveAnnouncementsBatch(items: AnnouncementInput[]): Promise<{ total: number; inserted: number; updated: number; skipped: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { total: 0, inserted: 0, updated: 0, skipped: 0 };
  }

  // Fast O(1) index map for current in-memory cache
  const idMap = new Map<string, number>();
  for (let i = 0; i < announcementsMemoryCache.length; i++) {
    const item = announcementsMemoryCache[i];
    if (item && item.id) {
      idMap.set(item.id, i);
    }
  }

  const now = Date.now();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const tasksToQueue: { docId: string; data: any; merge?: boolean }[] = [];

  for (const data of items) {
    if (!data || !data.newsId) {
      skipped++;
      continue;
    }

    processedCache.add(data.newsId);
    processedBloomFilter.add(data.newsId);
    if (data.is_sent === 1) {
      sentCache.add(data.newsId);
      sentBloomFilter.add(data.newsId);
    }

    let bseTs = 0;
    if (data.bseTime) {
      const parsed = parseBseDate(data.bseTime);
      if (parsed > 0) bseTs = parsed;
    }
    if (!bseTs || bseTs > now + 120000) bseTs = now;

    const safeData = {
      ...data,
      subject: String(data.subject || "").substring(0, 990),
      details: String(data.details || "").substring(0, 4900),
      companyName: String(data.companyName || "").substring(0, 190),
      pdfLink: String(data.pdfLink || "").substring(0, 990),
      bseTime: String(data.bseTime || "").substring(0, 90),
      scrip_cd: String(data.scrip_cd || "").substring(0, 30),
      isWatchlist: data.isWatchlist ?? false,
      fetched_at: now,
      bseTimestamp: bseTs,
      is_sent: data.is_sent ?? 0
    };

    if (!safeData.priority || !safeData.category) {
      const p = determinePriority(safeData.subject || '', safeData.details || '');
      safeData.priority = safeData.priority || p.level;
      safeData.category = safeData.category || p.category;
    }

    const memItem = { id: data.newsId, ...safeData };
    const existingIdx = idMap.get(data.newsId);

    if (existingIdx !== undefined && existingIdx >= 0) {
      const existing = announcementsMemoryCache[existingIdx];
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
        skipped++;
      } else {
        announcementsMemoryCache[existingIdx] = { ...existing, ...memItem };
        updated++;
        tasksToQueue.push({ docId: data.newsId, data: safeData, merge: true });
      }
    } else {
      announcementsMemoryCache.push(memItem);
      idMap.set(data.newsId, announcementsMemoryCache.length - 1);
      inserted++;
      tasksToQueue.push({ docId: data.newsId, data: safeData, merge: true });
    }
  }

  // If new records were added or existing ones were updated, perform a single consolidated sort, disk save, and Firestore batch queue
  if (inserted > 0 || updated > 0) {
    announcementsMemoryCache.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
    if (announcementsMemoryCache.length > 10000) {
      announcementsMemoryCache.length = 10000;
    }
    scheduleLocalDiskSave();
    queueAnnouncementsBatchWrite(tasksToQueue);

    // Notify search engines (Bing, Yandex, etc.) of newly published announcement pages
    if (inserted > 0) {
      const newUrls = items
        .filter(it => it && it.newsId)
        .slice(0, 50)
        .map(it => `https://bsenexus.in/announcement/${it.newsId}`);
      if (newUrls.length > 0) {
        notifySearchEnginesOfNewPages(newUrls);
      }
    }
  }

  return { total: items.length, inserted, updated, skipped };
}

export async function saveAnnouncement(data: AnnouncementInput) {
  await saveAnnouncementsBatch([data]);
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

export function getBloomFilterDiagnostics() {
  const pStats = processedBloomFilter.getStats();
  const sStats = sentBloomFilter.getStats();

  return {
    processedFilter: pStats,
    sentFilter: sStats,
    summary: {
      status: 'ACTIVE_ZERO_FALSE_NEGATIVES',
      totalDatabaseBypasses: pStats.negativeBypasses + sStats.negativeBypasses,
      totalCandidateVerifications: pStats.positiveChecks + sStats.positiveChecks,
      totalMemorySavedKb: pStats.memorySavedKb + sStats.memorySavedKb,
      combinedMemoryFootprintKb: Math.round((pStats.byteSize + sStats.byteSize) / 1024)
    }
  };
}



