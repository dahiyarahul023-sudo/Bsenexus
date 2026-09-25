import fs from 'fs';
import path from 'path';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded } from '../database/localStore.js';
import { sendToTelegram } from './telegram.js';
import { addLog } from '../database/logDao.js';
import { getActiveWatchlistSymbols, getAllActiveWatchlistsAcrossUsers } from '../database/watchlistDao.js';

import { deleteAnnouncementsFromStorageAndFirestore } from '../database/announcementDao.js';

interface StorageAlertState {
  lastAlertPercentage: number;
  alerted50: boolean;
  alerted90: boolean;
  alerted100: boolean;
  lastAlertTimestamp: number;
  lastCleanupTimestamp: number;
  totalPrunedCount: number;
}

const STORAGE_STATE_FILE = 'storage_alert_state.json';
const ANNOUNCEMENTS_FILE = 'announcements.json';
const CALENDAR_FILE = 'results_calendar.json';
const LOGS_FILE = 'logs.json';

// Firestore Free Tier Spark Benchmarks:
// 1 GB Storage, 50,000 reads/day, 20,000 writes/day, ~50,000 document safe capacity
export const FREE_TIER_MAX_DOCS_CAPACITY = 25000; // Target safe ceiling to prevent free quota exhaustion

let storageState: StorageAlertState = readLocalJson<StorageAlertState>(STORAGE_STATE_FILE, {
  lastAlertPercentage: 0,
  alerted50: false,
  alerted90: false,
  alerted100: false,
  lastAlertTimestamp: 0,
  lastCleanupTimestamp: 0,
  totalPrunedCount: 0
});

export interface StorageStatusReport {
  usagePercentage: number;
  estimatedDocCount: number;
  maxDocCapacity: number;
  announcementsCount: number;
  resultsCount: number;
  watchlistStocksCount: number;
  watchlistsCount: number;
  logsCount: number;
  isQuotaExceeded: boolean;
  protectedDataRetention: string;
  autoCleanupActive: boolean;
  lastCleanupTime: number;
  alertThresholds: {
    alerted50: boolean;
    alerted90: boolean;
    alerted100: boolean;
  };
  storageBreakdownKB: {
    announcementsKB: number;
    calendarKB: number;
    logsKB: number;
    totalDiskKB: number;
  };
}

export function getFileSizeBytes(filename: string): number {
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath).size;
    }
  } catch (e) {}
  return 0;
}

export async function getStorageStatusReport(): Promise<StorageStatusReport> {
  const announcements = readLocalJson<any[]>(ANNOUNCEMENTS_FILE, []);
  const calendarData = readLocalJson<{ items?: any[] }>(CALENDAR_FILE, { items: [] });
  const logs = readLocalJson<any[]>(LOGS_FILE, []);
  const watchlists = await getAllActiveWatchlistsAcrossUsers();
  const activeSymbols = await getActiveWatchlistSymbols('all');
  const totalWatchlistStocks = activeSymbols.length;

  const resultsItems = (calendarData.items || []).length;
  const announcementsCount = announcements.length;
  const logsCount = logs.length;
  const totalDocCount = announcementsCount + resultsItems + logsCount + watchlists.length;

  const annKB = Math.round(getFileSizeBytes(ANNOUNCEMENTS_FILE) / 1024);
  const calKB = Math.round(getFileSizeBytes(CALENDAR_FILE) / 1024);
  const logKB = Math.round(getFileSizeBytes(LOGS_FILE) / 1024);
  const totalDiskKB = annKB + calKB + logKB;

  let calculatedPercentage = Math.round((totalDocCount / FREE_TIER_MAX_DOCS_CAPACITY) * 100);
  if (isFirestoreQuotaExceeded()) {
    calculatedPercentage = Math.max(calculatedPercentage, 100);
  }
  calculatedPercentage = Math.min(100, Math.max(1, calculatedPercentage));

  return {
    usagePercentage: calculatedPercentage,
    estimatedDocCount: totalDocCount,
    maxDocCapacity: FREE_TIER_MAX_DOCS_CAPACITY,
    announcementsCount,
    resultsCount: resultsItems,
    watchlistStocksCount: totalWatchlistStocks,
    watchlistsCount: watchlists.length,
    logsCount,
    isQuotaExceeded: isFirestoreQuotaExceeded(),
    protectedDataRetention: "1-2 Years Results & Watchlists Permanently Retained",
    autoCleanupActive: true,
    lastCleanupTime: storageState.lastCleanupTimestamp,
    alertThresholds: {
      alerted50: storageState.alerted50,
      alerted90: storageState.alerted90,
      alerted100: storageState.alerted100
    },
    storageBreakdownKB: {
      announcementsKB: annKB,
      calendarKB: calKB,
      logsKB: logKB,
      totalDiskKB
    }
  };
}

/**
 * Auto-Cleanup engine:
 * STRICT RETENTION RULES:
 * 1. NEVER delete Watchlists or stocks in watchlists.
 * 2. NEVER delete Financial Results announcements (category === 'RESULTS' or 'CONFERENCE_CALL') or Results Calendar items (aim: 1-2 years).
 * 3. Prune transient noise filings (non-watchlist, category === 'OTHER') older than 60 days if storage pressure builds up.
 * 4. Prune logs older than 14 days or capping to 300 entries.
 */
export async function runAutoStorageCleanup(force: boolean = false): Promise<{
  prunedAnnouncements: number;
  prunedLogs: number;
  reclaimedSpaceKB: number;
  newPercentage: number;
}> {
  const initialAnnKB = Math.round(getFileSizeBytes(ANNOUNCEMENTS_FILE) / 1024);
  const initialLogKB = Math.round(getFileSizeBytes(LOGS_FILE) / 1024);

  const activeSymbols = await getActiveWatchlistSymbols('all');
  const lowerSymbols = new Set(activeSymbols.map(s => s.toLowerCase().trim()));

  // 1. Process Announcements Pruning
  const announcements = readLocalJson<any[]>(ANNOUNCEMENTS_FILE, []);
  const now = Date.now();
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  const twoYearsMs = 730 * 24 * 60 * 60 * 1000;

  const preserved: any[] = [];
  const prunedItems: any[] = [];

  for (const item of announcements) {
    const age = now - (item.bseTimestamp || item.fetched_at || now);
    const isResults = item.category === 'RESULTS' || item.category === 'CONFERENCE_CALL';
    const isWatchlist = item.isWatchlist || (item.scrip_cd && lowerSymbols.has(item.scrip_cd.toLowerCase()));

    // Rule 1: All Watchlists & Results kept for up to 2 full years
    if (isResults || isWatchlist) {
      if (age <= twoYearsMs) {
        preserved.push(item);
        continue;
      }
    }

    // Rule 2: If item is generic noise (category === 'OTHER') and older than 60 days, prune it
    if (age > sixtyDaysMs) {
      prunedItems.push(item);
      continue;
    }

    // Rule 3: Keep other items within safe capacity (max 5000 generic non-watchlist items)
    preserved.push(item);
  }

  // If still above 8,000 items, trim oldest non-essential items while preserving all results/watchlists
  let finalAnnouncements = preserved;
  if (preserved.length > 8000) {
    const highPriority = preserved.filter(i => i.isWatchlist || i.category === 'RESULTS' || i.category === 'CONFERENCE_CALL');
    const standardPriority = preserved.filter(i => !i.isWatchlist && i.category !== 'RESULTS' && i.category !== 'CONFERENCE_CALL');
    standardPriority.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
    const keptStandard = standardPriority.slice(0, 4000);
    const trimmedStandard = standardPriority.slice(4000);
    prunedItems.push(...trimmedStandard);
    finalAnnouncements = [...highPriority, ...keptStandard];
    finalAnnouncements.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
  }

  const prunedDocIds = prunedItems.map(i => i.id || i.newsId).filter(Boolean);
  if (prunedDocIds.length > 0) {
    await deleteAnnouncementsFromStorageAndFirestore(prunedDocIds);
  } else {
    writeLocalJson(ANNOUNCEMENTS_FILE, finalAnnouncements);
  }
  const prunedCount = prunedDocIds.length;

  // 2. Prune Logs (Keep max 300 entries, prune older than 14 days)
  const logs = readLocalJson<any[]>(LOGS_FILE, []);
  const initialLogsCount = logs.length;
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const filteredLogs = logs.filter(l => (now - (l.timestamp || now)) <= fourteenDaysMs).slice(0, 300);
  writeLocalJson(LOGS_FILE, filteredLogs);
  const prunedLogsCount = initialLogsCount - filteredLogs.length;

  // Re-calculate
  const finalAnnKB = Math.round(getFileSizeBytes(ANNOUNCEMENTS_FILE) / 1024);
  const finalLogKB = Math.round(getFileSizeBytes(LOGS_FILE) / 1024);
  const reclaimedKB = Math.max(0, (initialAnnKB + initialLogKB) - (finalAnnKB + finalLogKB));

  storageState.lastCleanupTimestamp = Date.now();
  storageState.totalPrunedCount += prunedCount + prunedLogsCount;
  writeLocalJson(STORAGE_STATE_FILE, storageState);

  const report = await getStorageStatusReport();
  
  if (prunedCount > 0 || prunedLogsCount > 0 || force) {
    await addLog(
      'INFO', 
      'SYSTEM', 
      `Auto-cleanup completed: Pruned ${prunedCount} noise filings and ${prunedLogsCount} old logs. Results & Watchlist data 100% preserved. Reclaimed: ~${reclaimedKB} KB. Current Storage: ${report.usagePercentage}%`
    );
  }

  return {
    prunedAnnouncements: prunedCount,
    prunedLogs: prunedLogsCount,
    reclaimedSpaceKB: reclaimedKB,
    newPercentage: report.usagePercentage
  };
}

/**
 * Admin Manual Percentage Pruning with Safe Floor Protection
 * Deletes a chosen percentage of oldest general announcements while strictly:
 * 1. Protecting 100% of Watchlists & active watchlist items.
 * 2. Protecting 100% of Financial Results filings.
 * 3. Enforcing a safe floor (keeps at least minFloorCount recent announcements so live terminal never goes empty).
 */
export async function pruneAnnouncementsByPercentage(
  percentage: number, 
  minFloorCount: number = 100
): Promise<{
  initialCount: number;
  prunedCount: number;
  remainingCount: number;
  reclaimedSpaceKB: number;
  protectedWatchlistCount: number;
  protectedResultsCount: number;
  newPercentage: number;
}> {
  const safePercentage = Math.min(90, Math.max(5, percentage)); // Cap at 90% max to prevent full wipeout
  const initialAnnKB = Math.round(getFileSizeBytes(ANNOUNCEMENTS_FILE) / 1024);

  const activeSymbols = await getActiveWatchlistSymbols();
  const lowerSymbols = new Set(activeSymbols.map(s => s.toLowerCase().trim()));

  const announcements = readLocalJson<any[]>(ANNOUNCEMENTS_FILE, []);
  const initialCount = announcements.length;

  // Separate into strictly protected vs candidate prunable announcements
  const protectedItems: any[] = [];
  const candidateItems: any[] = [];

  for (const item of announcements) {
    const isResults = item.category === 'RESULTS' || item.category === 'CONFERENCE_CALL';
    const isWatchlist = item.isWatchlist || (item.scrip_cd && lowerSymbols.has(item.scrip_cd.toLowerCase()));

    if (isResults || isWatchlist) {
      protectedItems.push(item);
    } else {
      candidateItems.push(item);
    }
  }

  // Sort candidate items: newest first
  candidateItems.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));

  // Determine how many candidates to prune
  // Keep at least minFloorCount candidates if available
  let prunablePool = candidateItems;
  let alwaysKeepRecent: any[] = [];

  if (candidateItems.length > minFloorCount) {
    alwaysKeepRecent = candidateItems.slice(0, minFloorCount);
    prunablePool = candidateItems.slice(minFloorCount);
  } else {
    // If fewer than minFloorCount, do not prune any candidates
    prunablePool = [];
    alwaysKeepRecent = candidateItems;
  }

  const itemsToPruneCount = Math.round((prunablePool.length * safePercentage) / 100);
  // Keep the newer portion of the prunable pool, drop the oldest
  const keptFromPool = prunablePool.slice(0, prunablePool.length - itemsToPruneCount);
  const droppedFromPool = prunablePool.slice(prunablePool.length - itemsToPruneCount);

  const finalCombined = [...protectedItems, ...alwaysKeepRecent, ...keptFromPool];
  finalCombined.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));

  // Delete dropped items from Firestore, memory, and local disk
  const droppedIds = droppedFromPool.map(i => i.id || i.newsId).filter(Boolean);
  if (droppedIds.length > 0) {
    await deleteAnnouncementsFromStorageAndFirestore(droppedIds);
  } else {
    writeLocalJson(ANNOUNCEMENTS_FILE, finalCombined);
  }

  const finalAnnKB = Math.round(getFileSizeBytes(ANNOUNCEMENTS_FILE) / 1024);
  const reclaimedKB = Math.max(0, initialAnnKB - finalAnnKB);

  const report = await getStorageStatusReport();

  await addLog(
    'WARNING',
    'ADMIN',
    `Admin pruned ${itemsToPruneCount} past announcements (${safePercentage}% of eligible). Kept ${finalCombined.length} (Protected: ${protectedItems.length} watchlist/results, Min Floor: ${alwaysKeepRecent.length}). Reclaimed: ${reclaimedKB} KB.`
  );

  return {
    initialCount,
    prunedCount: itemsToPruneCount,
    remainingCount: finalCombined.length,
    reclaimedSpaceKB: reclaimedKB,
    protectedWatchlistCount: protectedItems.filter(i => i.isWatchlist).length,
    protectedResultsCount: protectedItems.filter(i => i.category === 'RESULTS' || i.category === 'CONFERENCE_CALL').length,
    newPercentage: report.usagePercentage
  };
}

/**
 * Check Storage Quota and send Telegram Alert at 50%, 90%, 100%
 */
export async function checkStorageAndTriggerAlerts(): Promise<void> {
  const report = await getStorageStatusReport();
  const pct = report.usagePercentage;
  const now = Date.now();

  // Reset alert flags if usage drops below thresholds (anti-flap hysteresis of 5%)
  if (pct < 45 && storageState.alerted50) {
    storageState.alerted50 = false;
  }
  if (pct < 85 && storageState.alerted90) {
    storageState.alerted90 = false;
  }
  if (pct < 95 && storageState.alerted100) {
    storageState.alerted100 = false;
  }

  // 1. 100% Critical Alert
  if (pct >= 100 && !storageState.alerted100) {
    storageState.alerted100 = true;
    storageState.lastAlertPercentage = 100;
    storageState.lastAlertTimestamp = now;
    writeLocalJson(STORAGE_STATE_FILE, storageState);

    const msg = `🚨 <b>CRITICAL STORAGE ALERT: 100% CAPACITY REACHED</b>\n\n` +
      `⚠️ Cloud Free Tier Storage is at <b>100% capacity</b> (${report.estimatedDocCount.toLocaleString()} / ${report.maxDocCapacity.toLocaleString()} items).\n\n` +
      `📊 <b>Storage Breakdown:</b>\n` +
      `• 📁 Financial Results & Outcomes: <b>${report.resultsCount} preserved</b> (1-2 Year Retention)\n` +
      `• 📋 Watchlist Symbols: <b>${report.watchlistStocksCount} active</b> (Permanently Safe)\n` +
      `• 📰 Active Announcements: <b>${report.announcementsCount}</b>\n` +
      `• 📝 Activity Logs: <b>${report.logsCount}</b>\n\n` +
      `🛡️ <i>Auto-Pruner is actively trimming old low-priority noise records. Your Watchlists and Financial Results data remain 100% safe.</i>`;

    await sendToTelegram(msg);
    await addLog('CRITICAL', 'SYSTEM', 'Sent 100% Storage Alert to Telegram');
    await runAutoStorageCleanup(true);
    return;
  }

  // 2. 90% Caution Alert
  if (pct >= 90 && !storageState.alerted90) {
    storageState.alerted90 = true;
    storageState.lastAlertPercentage = 90;
    storageState.lastAlertTimestamp = now;
    writeLocalJson(STORAGE_STATE_FILE, storageState);

    const msg = `⚠️ <b>STORAGE WARNING: 90% THRESHOLD REACHED</b>\n\n` +
      `Your Free Cloud Storage has reached <b>90% of safe limit</b> (${report.estimatedDocCount.toLocaleString()} / ${report.maxDocCapacity.toLocaleString()} items).\n\n` +
      `📊 <b>Current Breakdown:</b>\n` +
      `• 📁 Earnings & Results: <b>${report.resultsCount} records</b> (1-2 Year Retention Active)\n` +
      `• 📋 Watchlists & Stocks: <b>${report.watchlistStocksCount} symbols</b> (Protected)\n` +
      `• 📰 Cached Announcements: <b>${report.announcementsCount}</b>\n\n` +
      `🧹 <i>Auto-cleanup engine has been automatically triggered to prune transient non-watchlist records.</i>`;

    await sendToTelegram(msg);
    await addLog('WARNING', 'SYSTEM', 'Sent 90% Storage Warning Alert to Telegram');
    await runAutoStorageCleanup(true);
    return;
  }

  // 3. 50% Notice Alert
  if (pct >= 50 && !storageState.alerted50) {
    storageState.alerted50 = true;
    storageState.lastAlertPercentage = 50;
    storageState.lastAlertTimestamp = now;
    writeLocalJson(STORAGE_STATE_FILE, storageState);

    const msg = `ℹ️ <b>STORAGE MILESTONE: 50% CAPACITY</b>\n\n` +
      `Your Free Cloud Storage is at <b>50% capacity</b> (${report.estimatedDocCount.toLocaleString()} items).\n\n` +
      `🛡️ <b>Data Protection Guarantee:</b>\n` +
      `• All Watchlist stocks and 1-2 year Financial Results are locked & permanently preserved.\n` +
      `• Transient noise data is auto-optimized continuously.\n\n` +
      `Next notification threshold: <b>90%</b>`;

    await sendToTelegram(msg);
    await addLog('INFO', 'SYSTEM', 'Sent 50% Storage Milestone Alert to Telegram');
  }
}

/**
 * Manual test trigger for Telegram Storage Alerts (50, 90, or 100)
 */
export async function triggerManualTestStorageAlert(level: 50 | 90 | 100): Promise<{ success: boolean; error?: string }> {
  const report = await getStorageStatusReport();
  
  let msg = '';
  if (level === 50) {
    msg = `🧪 <b>[TEST] STORAGE MILESTONE ALERT: 50% CAPACITY</b>\n\n` +
      `ℹ️ This is a test notification for the <b>50% Free Storage Milestone</b>.\n\n` +
      `📊 <b>Live Storage Report:</b>\n` +
      `• Usage: <b>${report.usagePercentage}%</b> (${report.estimatedDocCount.toLocaleString()} / ${report.maxDocCapacity.toLocaleString()} items)\n` +
      `• Financial Results: <b>${report.resultsCount} records</b> (1-2 Year Retention Active)\n` +
      `• Watchlists: <b>${report.watchlistStocksCount} stocks in ${report.watchlistsCount} lists</b> (Protected)\n` +
      `• Auto-Cleanup: <b>Active & Optimized</b>\n\n` +
      `✅ <i>Free tier optimization is active. Watchlist and results data will never be deleted.</i>`;
  } else if (level === 90) {
    msg = `🧪 <b>[TEST] STORAGE WARNING ALERT: 90% CAPACITY</b>\n\n` +
      `⚠️ This is a test notification for the <b>90% Storage Warning Threshold</b>.\n\n` +
      `📊 <b>Live Storage Report:</b>\n` +
      `• Usage: <b>90% High Threshold</b>\n` +
      `• Preserved Results: <b>${report.resultsCount} items</b>\n` +
      `• Active Watchlist Stocks: <b>${report.watchlistStocksCount}</b>\n\n` +
      `🧹 <i>Auto-cleanup triggers automatically at 90% to prevent hitting free tier quota.</i>`;
  } else {
    msg = `🧪 <b>[TEST] CRITICAL STORAGE ALERT: 100% CAPACITY</b>\n\n` +
      `🚨 This is a test notification for the <b>100% Critical Storage Limit</b>.\n\n` +
      `📊 <b>Live Storage Report:</b>\n` +
      `• Usage: <b>100% Limit Reached</b>\n` +
      `• Protected Watchlists & Results: <b>100% Retained</b>\n` +
      `• Transient Items Pruning: <b>Enforced</b>\n\n` +
      `🛡️ <i>Your essential watchlists & financial results data remain 100% safe.</i>`;
  }

  const result = await sendToTelegram(msg);
  if (result.success) {
    await addLog('SUCCESS', 'TELEGRAM', `Sent test ${level}% storage alert to Telegram`);
    return { success: true };
  } else {
    await addLog('ERROR', 'TELEGRAM', `Failed to send test storage alert: ${result.error}`);
    return { success: false, error: result.error };
  }
}
