import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { readLocalJson, writeLocalJson } from './localStore.js';

export interface AppSettings {
  botToken: string;
  chatId: string;
  isRunning: boolean;
  isFilterEnabled: boolean;
  appPinHash?: string;
  excludeKeywords?: string;
  telegramAlertPriority?: 'HIGH_ONLY' | 'HIGH_MEDIUM' | 'ALL';
  telegramAlertCategory?: 'ALL' | 'RESULTS_ONLY' | 'RESULTS_AND_MATERIAL';
  telegramWatchlistOnly?: boolean;
  telegramAlertsEnabled?: boolean;
  telegramAiSummaryEnabled?: boolean;
  autoTelegramCalendar?: boolean;
  autoTelegramNews?: boolean;
  telegramNewsSources?: string[];
  telegramNewsCategories?: string[];
  muteCrashAlerts?: boolean;
  muteInAppNotifications?: boolean;
}

const SETTINGS_KEY = 'global';
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
  telegramAlertsEnabled: true,
  telegramAiSummaryEnabled: true,
  autoTelegramCalendar: true,
  autoTelegramNews: false,
  telegramNewsSources: ['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard'],
  telegramNewsCategories: ['all'],
  muteCrashAlerts: false,
  muteInAppNotifications: false
};

function sanitizeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const merged = { ...defaultSettings, ...(raw || {}) };
  // Never let an empty string or whitespace override a valid env botToken or chatId
  if (!merged.botToken?.trim() && process.env.TELEGRAM_BOT_TOKEN) {
    merged.botToken = process.env.TELEGRAM_BOT_TOKEN;
  }
  if (!merged.chatId?.trim() && process.env.TELEGRAM_CHAT_ID) {
    merged.chatId = process.env.TELEGRAM_CHAT_ID;
  }
  return merged;
}

let cachedSettings: AppSettings | null = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL_MS = 15000; // 15 seconds TTL for multi-instance sync

async function readCloudSettings(): Promise<Partial<AppSettings> | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as Partial<AppSettings>) ?? null;
}

export async function getSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsFetchTime < SETTINGS_CACHE_TTL_MS)) {
    return sanitizeSettings(cachedSettings);
  }

  // Check local disk storage first
  const diskSettings = readLocalJson<AppSettings | null>(SETTINGS_FILE, null);
  if (diskSettings && typeof diskSettings === 'object' && diskSettings.botToken !== undefined) {
    cachedSettings = sanitizeSettings(diskSettings);
    lastSettingsFetchTime = Date.now();
    return { ...cachedSettings };
  }

  if (!isSupabaseConfigured()) {
    return sanitizeSettings(cachedSettings);
  }

  try {
    const cloud = await readCloudSettings();
    cachedSettings = sanitizeSettings(cloud ?? defaultSettings);
    writeLocalJson(SETTINGS_FILE, cachedSettings);
    lastSettingsFetchTime = Date.now();
    return { ...cachedSettings };
  } catch (err: any) {
    console.warn('[Settings] Supabase read failed, using cached/local:', err?.message || err);
    return sanitizeSettings(cachedSettings);
  }
}

export async function saveSettings(settings: Partial<AppSettings>) {
  // Invalidate in-memory cache to prevent race condition across instances
  cachedSettings = null;
  lastSettingsFetchTime = 0;

  // Read current local disk settings
  const diskSettings = readLocalJson<AppSettings | null>(SETTINGS_FILE, null) || defaultSettings;

  // Guard against unsetting existing botToken / chatId if empty string passed
  const cleanSettings = { ...settings };
  if (cleanSettings.botToken !== undefined && !cleanSettings.botToken.trim()) {
    // If user passed empty string, fallback to existing disk token or env token
    cleanSettings.botToken = diskSettings.botToken?.trim() || process.env.TELEGRAM_BOT_TOKEN || '';
  }
  if (cleanSettings.chatId !== undefined && !cleanSettings.chatId.trim()) {
    cleanSettings.chatId = diskSettings.chatId?.trim() || process.env.TELEGRAM_CHAT_ID || '';
  }

  const updated = sanitizeSettings({ ...diskSettings, ...cleanSettings });

  // Save merged state to local disk immediately
  writeLocalJson(SETTINGS_FILE, updated);
  cachedSettings = updated;
  lastSettingsFetchTime = Date.now();

  if (!isSupabaseConfigured()) return;

  try {
    // Read-modify-write so partial updates merge (same semantics as the old
    // Firestore set(..., { merge: true })).
    const cloud = await readCloudSettings();
    const merged = sanitizeSettings({ ...(cloud || {}), ...cleanSettings });
    const { error } = await getSupabase()
      .from('settings')
      .upsert({ key: SETTINGS_KEY, value: merged }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err: any) {
    console.warn('[Settings] Supabase write failed (local copy kept):', err?.message || err);
  }
}
