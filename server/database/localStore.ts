import fs from 'fs';
import path from 'path';

import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Ignore error if directory already exists or created concurrently
  }
}

function resolveTargetFile(filename: string): { filePath: string; dir: string; baseName: string } {
  let filePath: string;
  if (path.isAbsolute(filename)) {
    filePath = filename;
  } else {
    filePath = path.join(DATA_DIR, filename);
  }
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return { filePath, dir, baseName };
}

export function readLocalJson<T>(filename: string, fallback: T): T {
  const { filePath, dir, baseName } = resolveTargetFile(filename);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw || !raw.trim()) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    }
  } catch (e: any) {
    console.warn(`[LocalStore] Detected corrupted ${baseName} (${e?.message || e}). Attempting auto-recovery...`);
    // If JSON is corrupted (e.g. truncated write), attempt intelligent auto-recovery
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8').trim();
        
        // Strategy A: Array JSON recovery (e.g. announcements.json, logs.json)
        if (raw.startsWith('[')) {
          let lastValidIdx = raw.lastIndexOf('}');
          let attempts = 0;
          const maxAttempts = 300;
          while (lastValidIdx > 0 && attempts < maxAttempts) {
            attempts++;
            const candidateSlice = raw.slice(0, lastValidIdx + 1).trim().replace(/,\s*$/, '');
            const candidate = candidateSlice + '\n]';
            try {
              const repaired = JSON.parse(candidate) as T;
              if (Array.isArray(repaired)) {
                console.log(`[LocalStore] Auto-recovered ${repaired.length} records from corrupted ${baseName}`);
                writeLocalJson(filename, repaired);
                return repaired;
              }
            } catch {
              lastValidIdx = raw.lastIndexOf('}', lastValidIdx - 1);
            }
          }
        } 
        // Strategy B: Object JSON recovery
        else if (raw.startsWith('{')) {
          let lastValidIdx = raw.lastIndexOf('}');
          let attempts = 0;
          const maxAttempts = 100;
          while (lastValidIdx > 0 && attempts < maxAttempts) {
            attempts++;
            const candidate = raw.slice(0, lastValidIdx + 1);
            try {
              const repaired = JSON.parse(candidate) as T;
              console.log(`[LocalStore] Auto-recovered object from corrupted ${baseName}`);
              writeLocalJson(filename, repaired);
              return repaired;
            } catch {
              lastValidIdx = raw.lastIndexOf('}', lastValidIdx - 1);
            }
          }
        }

        // Strategy C: If recovery failed, safely backup the corrupted file and restore clean fallback
        console.warn(`[LocalStore] Could not recover ${baseName}. Backing up corrupted file and resetting with clean fallback.`);
        const backupPath = path.join(dir, `${baseName}.corrupted.${Date.now()}.${crypto.randomUUID().slice(0, 8)}`);
        try {
          fs.renameSync(filePath, backupPath);
        } catch {
          // ignore rename error
        }
        writeLocalJson(filename, fallback);
      }
    } catch (recoveryErr) {
      console.error(`[LocalStore] Auto-recovery encountered unexpected error for ${baseName}:`, recoveryErr);
    }
  }
  return fallback;
}

export function writeLocalJson<T>(filename: string, data: T): void {
  try {
    const { filePath, dir, baseName } = resolveTargetFile(filename);
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const tmpPath = path.join(dir, `${baseName}.tmp.${Date.now()}.${uniqueId}`);
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, jsonStr, 'utf-8');
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (renameErr) {
      // Fallback in case rename fails (cross-device link or locked)
      fs.writeFileSync(filePath, jsonStr, 'utf-8');
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  } catch (e) {
    console.warn(`[LocalStore] Failed to write ${filename}:`, e);
  }
}

export function getMostRecentPacificMidnight(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';

  // America/Los_Angeles midnight (00:00:00) is either 07:00 UTC (PDT) or 08:00 UTC (PST)
  const candidatePDT = Date.UTC(Number(year), Number(month) - 1, Number(day), 7, 0, 0, 0);
  const candidatePST = Date.UTC(Number(year), Number(month) - 1, Number(day), 8, 0, 0, 0);

  const hourPDT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(candidatePDT);
  const actualMidnightToday = (hourPDT === '24' || hourPDT === '0' || hourPDT === '00') ? candidatePDT : candidatePST;

  if (actualMidnightToday <= now.getTime()) {
    return actualMidnightToday;
  }
  return actualMidnightToday - 24 * 60 * 60 * 1000;
}

export function getNextPacificMidnight(now: Date = new Date()): number {
  const recent = getMostRecentPacificMidnight(now);
  return recent + 24 * 60 * 60 * 1000;
}

export function hasPassedPacificMidnight(markedAt: number): boolean {
  if (!markedAt || markedAt <= 0) return true;
  const recentMidnight = getMostRecentPacificMidnight();
  return markedAt < recentMidnight;
}

let firestoreQuotaExceeded = false;
let manualStorageMode: 'AUTO' | 'FORCE_LOCAL' | 'FORCE_FIRESTORE' = 'AUTO';

const STORAGE_MODE_FILE = 'storage_mode.json';
const QUOTA_STATE_FILE = 'quota_state.json';

try {
  const savedMode = readLocalJson<{ mode: 'AUTO' | 'FORCE_LOCAL' | 'FORCE_FIRESTORE' }>(STORAGE_MODE_FILE, { mode: 'AUTO' });
  if (savedMode && savedMode.mode) {
    manualStorageMode = savedMode.mode;
  }
  const savedQuota = readLocalJson<{ quotaExceeded: boolean; markedAt: number }>(QUOTA_STATE_FILE, { quotaExceeded: false, markedAt: 0 });
  // Quota resets at Midnight US Pacific Time (12:30 PM / 1:30 PM IST).
  // If the quota was marked before the most recent Pacific midnight, it is expired and reset.
  if (savedQuota && savedQuota.quotaExceeded) {
    if (hasPassedPacificMidnight(savedQuota.markedAt || 0)) {
      firestoreQuotaExceeded = false;
      writeLocalJson(QUOTA_STATE_FILE, { quotaExceeded: false, markedAt: 0 });
    } else {
      firestoreQuotaExceeded = true;
    }
  }
} catch (e) {
  // Ignore error
}

export function getManualStorageMode(): 'AUTO' | 'FORCE_LOCAL' | 'FORCE_FIRESTORE' {
  return manualStorageMode;
}

export function setManualStorageMode(mode: 'AUTO' | 'FORCE_LOCAL' | 'FORCE_FIRESTORE'): void {
  manualStorageMode = mode;
  writeLocalJson(STORAGE_MODE_FILE, { mode });
  if (mode === 'FORCE_FIRESTORE' || mode === 'AUTO') {
    firestoreQuotaExceeded = false;
    resetAdminPermissionDenied();
    writeLocalJson(QUOTA_STATE_FILE, { quotaExceeded: false, markedAt: 0 });
  }
}

export function resetQuotaExceededFlag(): void {
  firestoreQuotaExceeded = false;
  resetAdminPermissionDenied();
  writeLocalJson(QUOTA_STATE_FILE, { quotaExceeded: false, markedAt: 0 });
}

export function setFirestoreQuotaExceeded(exceeded: boolean = true) {
  firestoreQuotaExceeded = exceeded;
  writeLocalJson(QUOTA_STATE_FILE, { quotaExceeded: exceeded, markedAt: exceeded ? Date.now() : 0 });
}

export function isFirestoreQuotaExceeded(): boolean {
  if (manualStorageMode === 'FORCE_LOCAL') return true;
  if (manualStorageMode === 'FORCE_FIRESTORE') return false;

  // Auto-clear if Pacific Midnight has passed
  if (firestoreQuotaExceeded) {
    const savedQuota = readLocalJson<{ quotaExceeded: boolean; markedAt: number }>(QUOTA_STATE_FILE, { quotaExceeded: false, markedAt: 0 });
    if (savedQuota && hasPassedPacificMidnight(savedQuota.markedAt || 0)) {
      firestoreQuotaExceeded = false;
      writeLocalJson(QUOTA_STATE_FILE, { quotaExceeded: false, markedAt: 0 });
      return false;
    }
  }

  return firestoreQuotaExceeded;
}

export function isOfflineOrNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err || '').toLowerCase();
  const codeStr = String(err.code || '').toLowerCase();
  const numCode = typeof err.code === 'number' ? err.code : undefined;
  return (
    numCode === 14 ||
    numCode === 4 ||
    msg.includes('client is offline') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('unavailable') ||
    codeStr.includes('unavailable') ||
    msg.includes('network error')
  );
}

export function isPermissionDeniedError(err: any): boolean {
  if (!err) return false;
  // If it's a quota, network, or not-found error, it is NOT a permission denial error
  if (isQuotaError(err) || isOfflineOrNetworkError(err) || isNotFoundError(err)) {
    return false;
  }
  const msg = String(err.message || err || '').toLowerCase();
  const codeStr = String(err.code || '').toLowerCase();
  const numCode = typeof err.code === 'number' ? err.code : undefined;
  return (
    numCode === 7 ||
    msg.includes('permission_denied') ||
    msg.includes('permission denied') ||
    msg.includes('missing or insufficient permissions') ||
    codeStr.includes('permission-denied') ||
    codeStr.includes('permission_denied') ||
    codeStr === '7'
  );
}

let adminPermissionDenied = false;
let adminPermissionDeniedAt = 0;
let loggedAdminWarning = false;

// Auto-retry permission checks after 10 minutes in case of temporary IAM or network issues
const PERMISSION_DENIED_RETRY_MS = 10 * 60 * 1000;

export function isAdminPermissionDenied(): boolean {
  if (manualStorageMode === 'FORCE_LOCAL') return true;
  if (manualStorageMode === 'FORCE_FIRESTORE') return false;

  // Auto-expire permission lock after 10 minutes to allow re-probing cloud storage
  if (adminPermissionDenied && adminPermissionDeniedAt > 0) {
    if (Date.now() - adminPermissionDeniedAt > PERMISSION_DENIED_RETRY_MS) {
      adminPermissionDenied = false;
      adminPermissionDeniedAt = 0;
      loggedAdminWarning = false;
      console.info('[Firestore] Permission denied temporary backoff expired (10m). Resuming Firestore connection attempts.');
      return false;
    }
  }

  return adminPermissionDenied;
}

export function resetAdminPermissionDenied(): void {
  adminPermissionDenied = false;
  adminPermissionDeniedAt = 0;
  loggedAdminWarning = false;
}

export function setAdminPermissionDenied(denied: boolean = true): void {
  adminPermissionDenied = denied;
  adminPermissionDeniedAt = denied ? Date.now() : 0;
  if (denied && !loggedAdminWarning) {
    loggedAdminWarning = true;
    console.info('[Firestore] Server Admin SDK encountered a permission denial. Using local storage fallback (auto-retries periodically).');
  }
}

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err || '').toLowerCase();
  const codeStr = String(err.code || '').toLowerCase();
  const numCode = typeof err.code === 'number' ? err.code : undefined;
  return (
    numCode === 8 ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('write stream exhausted') ||
    msg.includes('queued writes') ||
    codeStr.includes('resource-exhausted') ||
    codeStr.includes('resource_exhausted') ||
    codeStr === '8'
  );
}

export function isNotFoundError(err: any): boolean {
  if (!err) return false;
  const codeStr = String(err.code || '').toLowerCase();
  const numCode = typeof err.code === 'number' ? err.code : undefined;
  return (
    numCode === 5 ||
    codeStr === '5' ||
    codeStr === 'not-found' ||
    codeStr === 'not_found'
  );
}

