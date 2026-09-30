import { initializeApp } from 'firebase/app';
import { initializeFirestore, setLogLevel, disableNetwork, enableNetwork, Firestore } from 'firebase/firestore';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../security/firebaseAdmin.js';
import fs from 'fs';
import path from 'path';
import { isFirestoreQuotaExceeded, getManualStorageMode, setManualStorageMode, applyRemoteStorageMode, resetQuotaExceededFlag, resetAdminPermissionDenied, isAdminPermissionDenied } from './localStore.js';

// Suppress internal Firebase SDK debug and stream error logs
try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported
}

let config: any = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || "",
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || "(default)"
};

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      config = { ...config, ...parsed };
    }
  }
} catch (err: any) {
  console.warn('[Firebase] Notice reading firebase-applet-config.json:', err?.message || err);
}

// Client Firestore App & DB (for client-side synchronization)
let app: any;
try {
  app = initializeApp(config);
} catch (e: any) {
  console.warn('[Firebase] Client initializeApp fallback:', e?.message || e);
}

export const db: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, config.firestoreDatabaseId || '(default)');

// Trusted Server-Side Admin Firestore (Bypasses Security Rules with Firebase Admin SDK)
const adminApp = getFirebaseAdmin();
function initAdminFirestore(): AdminFirestore {
  const adminProjectId = adminApp.options.projectId;
  const configProjectId = config.projectId;

  const customDbId = process.env.FIREBASE_DATABASE_ID || 
    (adminProjectId && configProjectId && adminProjectId === configProjectId && config.firestoreDatabaseId !== '(default)' ? config.firestoreDatabaseId : undefined);

  let firestore: AdminFirestore;
  if (customDbId && customDbId !== '(default)') {
    try {
      firestore = getAdminFirestore(adminApp, customDbId);
    } catch {
      firestore = getAdminFirestore(adminApp);
    }
  } else {
    firestore = getAdminFirestore(adminApp);
  }

  try {
    firestore.settings({ ignoreUndefinedProperties: true });
    console.info('[Firestore] Admin SDK settings configured with ignoreUndefinedProperties: true');
  } catch (e: any) {
    console.warn('[Firestore] Notice configuring firestore settings:', e?.message || e);
  }

  return firestore;
}

export const adminDb: AdminFirestore = initAdminFirestore();

// Immediately disable client Firestore network stream if quota is exceeded
if (isFirestoreQuotaExceeded()) {
  disableNetwork(db).catch(() => {});
}

export async function pauseFirestoreNetwork(): Promise<void> {
  try {
    await disableNetwork(db);
  } catch {}
}

export async function resumeFirestoreNetwork(): Promise<void> {
  try {
    await enableNetwork(db);
  } catch {}
}

// --- Durable manual storage mode + quota recovery probe ---------------------
// The local JSON holding the admin's manual mode lives on the revision-local
// Cloud Run disk, so every republish silently reset the switch to AUTO.
// The mode is now mirrored to Firestore (system_config/storage_mode) and
// re-adopted at boot and on every recovery probe.
const STORAGE_MODE_DOC = () => adminDb.collection('system_config').doc('storage_mode');
const VALID_STORAGE_MODES = ['AUTO', 'FORCE_LOCAL', 'FORCE_FIRESTORE'] as const;
type StorageModeValue = (typeof VALID_STORAGE_MODES)[number];

export async function persistStorageMode(mode: StorageModeValue): Promise<void> {
  try {
    await STORAGE_MODE_DOC().set({ mode, updatedAt: Date.now() }, { merge: true });
  } catch (err: any) {
    console.warn('[Storage] Could not persist storage mode to Firestore:', err?.message || err);
  }
}

async function adoptRemoteStorageMode(): Promise<StorageModeValue | null> {
  const snap = await STORAGE_MODE_DOC().get();
  if (!snap.exists) return null;
  const mode = (snap.data() as any)?.mode as StorageModeValue;
  if (!VALID_STORAGE_MODES.includes(mode)) return null;
  return mode;
}

export async function syncStorageModeFromFirestore(): Promise<void> {
  try {
    const remote = await adoptRemoteStorageMode();
    if (!remote || remote === getManualStorageMode()) return;
    applyRemoteStorageMode(remote);
    if (remote === 'FORCE_LOCAL') {
      await pauseFirestoreNetwork();
    } else {
      await resumeFirestoreNetwork();
    }
    console.info(`[Storage] Manual storage mode '${remote}' restored from Firestore.`);
  } catch (err: any) {
    // Firestore unreachable at boot: the local copy (or AUTO) stands.
    console.warn('[Storage] Could not sync storage mode from Firestore; using local mode:', err?.message || err);
  }
}

const QUOTA_PROBE_INTERVAL_MS = 5 * 60 * 1000;
let quotaProbeTimer: ReturnType<typeof setInterval> | null = null;

/**
 * While the app sits in local fallback (AUTO), probe Firestore every few
 * minutes with one tiny read. The moment it answers, clear the flags and
 * resume — the site must never stay parked in fallback until Pacific
 * midnight just because nobody pressed the manual switch again.
 */
export async function runStorageRecoveryProbe(): Promise<void> {
  if (getManualStorageMode() !== 'AUTO') return;
  if (!isFirestoreQuotaExceeded() && !isAdminPermissionDenied()) {
    // Healthy: still re-adopt the admin's durable mode if it changed remotely.
    try {
      const remote = await adoptRemoteStorageMode();
      if (remote) applyRemoteStorageMode(remote);
    } catch { /* best-effort */ }
    return;
  }
  try {
    const remote = await adoptRemoteStorageMode(); // the probe read itself
    resetQuotaExceededFlag();
    await resumeFirestoreNetwork();
    if (remote) applyRemoteStorageMode(remote);
    console.info('[Storage] Firestore answered the recovery probe. Quota flags cleared; cloud storage resumed.');
  } catch (err: any) {
    // Still unavailable (quota or otherwise): stay in fallback, probe again later.
    console.warn('[Storage] Recovery probe failed; staying in local fallback:', err?.message || err);
  }
}

export function startStorageRecoveryProbe(): void {
  if (quotaProbeTimer || process.env.NODE_ENV === 'test') return;
  void syncStorageModeFromFirestore();
  quotaProbeTimer = setInterval(() => {
    void runStorageRecoveryProbe();
  }, QUOTA_PROBE_INTERVAL_MS);
  quotaProbeTimer.unref?.();
}





