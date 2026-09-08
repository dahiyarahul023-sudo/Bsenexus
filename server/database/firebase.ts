import { initializeApp } from 'firebase/app';
import { initializeFirestore, setLogLevel, disableNetwork, enableNetwork, Firestore } from 'firebase/firestore';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../security/firebaseAdmin.js';
import fs from 'fs';
import path from 'path';
import { isFirestoreQuotaExceeded } from './localStore.js';

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





