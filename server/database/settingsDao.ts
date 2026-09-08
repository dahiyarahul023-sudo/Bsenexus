import { adminDb } from './firebase.js';
import { isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied, readLocalJson, writeLocalJson } from './localStore.js';
import path from 'path';

export interface AppSettings {
  botToken: string;
  chatId: string;
  isRunning: boolean;
  isFilterEnabled: boolean;
  appPinHash?: string;
  excludeKeywords?: string;
  telegramAlertPriority?: 'HIGH_ONLY' | 'HIGH_MEDIUM' | 'ALL';
  telegramAlertCategory?: 'ALL' | 'RESULTS_ONLY' | 'RESULTS_AND_CONCALLS' | 'RESULTS_AND_MATERIAL';
  telegramWatchlistOnly?: boolean;
  autoTelegramCalendar?: boolean;
  autoTelegramNews?: boolean;
  telegramNewsSources?: string[];
  telegramNewsCategories?: string[];
  muteCrashAlerts?: boolean;
  muteInAppNotifications?: boolean;
}

const SETTINGS_ID = 'global';
const SETTINGS_FILE = 'settings.json';

const defaultSettings: AppSettings = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  isRunning: false,
  isFilterEnabled: true,
  appPinHash: '',
  excludeKeywords: '',
  telegramAlertPriority: 'HIGH_MEDIUM',
  telegramAlertCategory: 'RESULTS_AND_MATERIAL',
  telegramWatchlistOnly: true,
  autoTelegramCalendar: true,
  autoTelegramNews: true,
  telegramNewsSources: ['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard'],
  telegramNewsCategories: ['all'],
  muteCrashAlerts: false,
  muteInAppNotifications: false
};

let cachedSettings: AppSettings | null = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL_MS = 15000; // 15 seconds TTL for multi-instance sync

export async function getSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsFetchTime < SETTINGS_CACHE_TTL_MS)) {
    return { ...cachedSettings };
  }

  // Check local disk storage first
  const diskSettings = readLocalJson<AppSettings | null>(SETTINGS_FILE, null);
  if (diskSettings && typeof diskSettings === 'object' && diskSettings.botToken !== undefined) {
    cachedSettings = { ...defaultSettings, ...diskSettings };
    lastSettingsFetchTime = Date.now();
    return { ...cachedSettings };
  }

  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) {
    return cachedSettings ? { ...cachedSettings } : { ...defaultSettings };
  }
  
  try {
    const snap = await adminDb.collection('settings').doc(SETTINGS_ID).get();
    if (snap.exists) {
      const data = snap.data() as AppSettings;
      cachedSettings = { ...defaultSettings, ...data };
      writeLocalJson(SETTINGS_FILE, cachedSettings);
      lastSettingsFetchTime = Date.now();
      return { ...cachedSettings };
    }
    
    cachedSettings = { ...defaultSettings };
    writeLocalJson(SETTINGS_FILE, defaultSettings);
    lastSettingsFetchTime = Date.now();
    return { ...defaultSettings };
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
    return cachedSettings ? { ...cachedSettings } : { ...defaultSettings };
  }
}

export async function saveSettings(settings: Partial<AppSettings>) {
  // Invalidate in-memory cache to prevent race condition across instances
  cachedSettings = null;
  lastSettingsFetchTime = 0;

  // Read current local disk settings
  const diskSettings = readLocalJson<AppSettings | null>(SETTINGS_FILE, null) || defaultSettings;
  const updated = { ...defaultSettings, ...diskSettings, ...settings };
  
  // Save merged state to local disk immediately
  writeLocalJson(SETTINGS_FILE, updated);
  cachedSettings = updated;
  lastSettingsFetchTime = Date.now();

  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) return;

  try {
    await adminDb.collection('settings').doc(SETTINGS_ID).set(settings, { merge: true });
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
  }
}

