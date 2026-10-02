import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { readLocalJson, writeLocalJson, isOfflineOrNetworkError } from './localStore.js';
import { resolveStockDetailsSync } from '../utils/stockResolver.js';
import { withRetry } from '../utils/retry.js';
import { addLog } from './logDao.js';

const WATCHLISTS_TABLE = 'user_watchlists';

/** Best-effort cloud write; never throws (background syncs only). */
async function upsertWatchlistsQuiet(uid: string, lists: any[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { error } = await getSupabase()
      .from(WATCHLISTS_TABLE)
      .upsert({ uid, lists, updated_at: new Date().toISOString() }, { onConflict: 'uid' });
    if (error) throw error;
  } catch { /* background sync is best-effort */ }
}

/** Read one user's lists from Supabase; null when no row / no lists. */
async function readWatchlistsRow(uid: string): Promise<any[] | null> {
  const { data, error } = await getSupabase()
    .from(WATCHLISTS_TABLE)
    .select('lists')
    .eq('uid', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return Array.isArray(data.lists) ? data.lists : null;
}

export interface WatchlistStockItemDao {
  symbol: string;
  scripCode?: string;
  companyName?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category?: string;
  notes?: string;
}

export function extractSymbol(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item.trim().toUpperCase();
  if (typeof item === 'object' && item.symbol) return String(item.symbol).trim().toUpperCase();
  return '';
}

export function extractPriority(item: any): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (typeof item === 'object' && item.priority) {
    const p = String(item.priority).toUpperCase();
    if (p === 'MEDIUM' || p === 'MED') return 'MEDIUM';
    if (p === 'LOW') return 'LOW';
    return 'HIGH';
  }
  return 'HIGH';
}

export function extractCategory(item: any): string | undefined {
  if (typeof item === 'object' && item.category) {
    return String(item.category).trim();
  }
  return undefined;
}

export function sanitizeUserId(userId?: string): string {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return 'guest';
  }
  const clean = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean || 'guest';
}

function getWatchlistFilename(userId?: string): string {
  const uid = sanitizeUserId(userId);
  return `watchlists_${uid}.json`;
}

export const FO_TOP25_STOCKS: WatchlistStockItemDao[] = [
  { symbol: "RELIANCE", priority: "HIGH", category: "Conglomerate / Energy" },
  { symbol: "BHARTIARTL", priority: "HIGH", category: "Telecom Bluechip" },
  { symbol: "HDFCBANK", priority: "HIGH", category: "Private Banking Leader" },
  { symbol: "ICICIBANK", priority: "HIGH", category: "Private Banking Leader" },
  { symbol: "SBIN", priority: "HIGH", category: "PSU Banking Leader" },
  { symbol: "TCS", priority: "HIGH", category: "IT Major" },
  { symbol: "BAJFINANCE", priority: "HIGH", category: "NBFC Leader" },
  { symbol: "LT", priority: "HIGH", category: "Infra & Engineering" },
  { symbol: "LICI", priority: "HIGH", category: "Insurance Bluechip" },
  { symbol: "HINDUNILVR", priority: "HIGH", category: "FMCG Bluechip" },
  { symbol: "INFY", priority: "HIGH", category: "IT Major" },
  { symbol: "SUNPHARMA", priority: "HIGH", category: "Pharma Leader" },
  { symbol: "TITAN", priority: "HIGH", category: "Consumer Luxury" },
  { symbol: "MARUTI", priority: "HIGH", category: "Automotive Leader" },
  { symbol: "M&M", priority: "HIGH", category: "Auto & Tractor" },
  { symbol: "ADANIPOWER", priority: "HIGH", category: "Power & Energy" },
  { symbol: "ADANIENT", priority: "HIGH", category: "Adani Flagship" },
  { symbol: "ADANIPORTS", priority: "HIGH", category: "Ports & Logistics" },
  { symbol: "KOTAKBANK", priority: "HIGH", category: "Private Bank" },
  { symbol: "AXISBANK", priority: "HIGH", category: "Private Bank" },
  { symbol: "HCLTECH", priority: "HIGH", category: "IT Major" },
  { symbol: "ITC", priority: "HIGH", category: "FMCG / Cigarettes" },
  { symbol: "ULTRACEMCO", priority: "HIGH", category: "Cement Leader" },
  { symbol: "HAL", priority: "HIGH", category: "Defense Aviation" },
  { symbol: "NTPC", priority: "HIGH", category: "Power Generation" },
];


function sanitizeStockItem(it: any): WatchlistStockItemDao {
  let sym = extractSymbol(it);
  // Auto-correct common stock name mistakes / legacy renames
  if (sym === 'ETERNAL') sym = 'ZOMATO';
  if (sym === 'M & M' || sym === 'M_AND_M') sym = 'M&M';
  if (sym === 'L & T' || sym === 'L_AND_T') sym = 'LT';
  if (sym === 'TATACONSULTANCY' || sym === 'TATACONSULTANCYSERVICES') sym = 'TCS';
  if (sym === 'RELIANCEINDUSTRIES') sym = 'RELIANCE';
  if (sym === 'BHARTIAIRTEL') sym = 'BHARTIARTL';
  if (sym === 'MARUTISUZUKI') sym = 'MARUTI';
  if (sym === 'HINDUSTANUNILEVER') sym = 'HINDUNILVR';
  if (sym === 'SUNPHARMACEUTICAL') sym = 'SUNPHARMA';
  if (sym === 'HCLTECHNOLOGIES') sym = 'HCLTECH';
  if (sym === 'ULTRATECHCEMENT') sym = 'ULTRACEMCO';
  if (sym === 'HINDUSTANAERONAUTICS') sym = 'HAL';
  if (sym === 'STATEBANKOFINDIA') sym = 'SBIN';
  if (sym === 'LICOFINDIA') sym = 'LICI';

  const resolved = resolveStockDetailsSync(sym);

  return {
    symbol: resolved?.symbol || sym,
    scripCode: resolved?.scripCode || (typeof it === 'object' && it.scripCode ? String(it.scripCode) : undefined),
    companyName: resolved?.name || (typeof it === 'object' && it.companyName ? String(it.companyName) : undefined),
    priority: extractPriority(it),
    category: extractCategory(it) || (it.category ? String(it.category) : undefined),
    notes: it.notes
  };
}

function sanitizeWatchlistArray(lists: any[]): any[] {
  if (!Array.isArray(lists)) return [];
  return lists.map(l => ({
    ...l,
    items: Array.isArray(l.items) ? l.items.map(sanitizeStockItem).filter(i => i.symbol) : []
  }));
}

/** Single default watchlist for every user: the 25 F&O stocks.
 *  (30 Sep 2026: the old 52-stock "Default" list was retired — every user sees
 *  only this one starter list.) */
function createDefaultWatchlists() {
  return [
    {
      id: 'dhan-fo-top25',
      name: 'Futures & Options',
      is_active: 1,
      items: JSON.parse(JSON.stringify(FO_TOP25_STOCKS))
    }
  ];
}

const LEGACY_DEFAULT_LIST_ID = 'default-1';
const LEGACY_FO_LIST_ID = 'dhan-fo-top25';
const LEGACY_FO_LIST_NAME = 'Dhan - Futures & Options (Top 25)';
const FO_LIST_NAME = 'Futures & Options';

/**
 * One-time migration for users who already have saved watchlists:
 * - renames the old "Dhan - Futures & Options (Top 25)" list to "Futures & Options"
 *   (only when the user never renamed it themselves),
 * - removes the retired 52-stock "Default" list (id 'default-1').
 * User-created lists are never touched. Never leaves the user with zero lists.
 */
function migrateToSingleFoDefault(lists: any[]): { lists: any[]; changed: boolean } {
  const input = Array.isArray(lists) ? lists : [];
  let changed = false;
  const renamed = input.map((l: any) => {
    if (l && l.id === LEGACY_FO_LIST_ID && l.name === LEGACY_FO_LIST_NAME) {
      changed = true;
      return { ...l, name: FO_LIST_NAME };
    }
    return l;
  });
  const out = renamed.filter((l: any) => !(l && l.id === LEGACY_DEFAULT_LIST_ID));
  if (out.length !== renamed.length) changed = true;
  if (out.length === 0 && renamed.length > 0) {
    // The retired list was their ONLY list — don't leave them with nothing.
    return { lists: createDefaultWatchlists(), changed: true };
  }
  // Deliberately empty (user deleted everything) stays empty.
  return { lists: out, changed };
}

/**
 * Applies the single-F&O-default migration to an existing user's lists and
 * persists the result (local JSON always; Supabase when available).
 * Read-only alert scans (noCreate) never mutate.
 */
async function migrateExistingUserWatchlists(uid: string, lists: any[], noCreate: boolean): Promise<any[]> {
  if (noCreate) return lists;
  const { lists: migrated, changed } = migrateToSingleFoDefault(lists);
  if (!changed) return lists;
  userWatchlistsCache[uid] = { lists: migrated, fetchedAt: Date.now() };
  userWatchlistsDirty[uid] = false;
  writeLocalJson(getWatchlistFilename(uid), migrated);
  if (uid !== 'guest') {
    await upsertWatchlistsQuiet(uid, migrated);
  }
  console.log(`[WatchlistDao] Migrated to single "Futures & Options" default for UID: ${uid}`);
  return migrated;
}

// In-memory cache keyed by sanitized userId with TTL for multi-instance sync
const userWatchlistsCache: Record<string, { lists: any[]; fetchedAt: number }> = {};
// Quota-bachao (1 Oct): 2s TTL meant every monitor poll cycle re-read every
// user's watchlist doc from Firestore. Mutations are write-through
// (persistUserWatchlists refreshes this cache entry + clears dirty), so a
// longer TTL never serves stale data after a change made on this instance.
const WATCHLISTS_CACHE_TTL_MS = 60 * 1000;
const userWatchlistsDirty: Record<string, boolean> = {};

// Per-UID async mutex lock to prevent read-modify-write race conditions
const uidLocks: Record<string, Promise<void>> = {};

export async function withUidLock<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const prev = uidLocks[uid] || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  uidLocks[uid] = prev.then(() => next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (uidLocks[uid] === next) {
      delete uidLocks[uid];
    }
  }
}

export function invalidateUserWatchlistCache(userId?: string) {
  const uid = sanitizeUserId(userId);
  delete userWatchlistsCache[uid];
  userWatchlistsDirty[uid] = true;
}

export async function migrateLegacyAdminWatchlists(targetRealUid: string): Promise<void> {
  if (!targetRealUid || targetRealUid === 'admin' || targetRealUid === 'guest') return;
  
  try {
    const legacyFile = getWatchlistFilename('admin');
    const legacyDisk = readLocalJson<any[] | null>(legacyFile, null);
    
    let legacyLists: any[] | null = null;
    if (legacyDisk && Array.isArray(legacyDisk) && legacyDisk.length > 0) {
      const hasStocks = legacyDisk.some(l => Array.isArray(l.items) && l.items.length > 0);
      if (hasStocks) {
        legacyLists = legacyDisk;
      }
    }
    
    if (!legacyLists && isSupabaseConfigured()) {
      try {
        legacyLists = await readWatchlistsRow('admin');
        if (legacyLists && !legacyLists.some((l: any) => l.items?.length > 0)) {
          legacyLists = null;
        }
      } catch {}
    }
    
    if (legacyLists && legacyLists.length > 0) {
      const targetFile = getWatchlistFilename(targetRealUid);
      const targetDisk = readLocalJson<any[] | null>(targetFile, null);
      
      if (!targetDisk || !Array.isArray(targetDisk) || targetDisk.length === 0) {
        const sanitized = sanitizeWatchlistArray(legacyLists);
        console.log(`[WatchlistDao] Migrating legacy admin watchlist (${sanitized.length} lists) to real UID: ${targetRealUid}`);
        await persistUserWatchlists(targetRealUid, sanitized);
        addLog('INFO', 'MIGRATION', `Copied legacy admin watchlist (${sanitized.reduce((acc, l) => acc + (l.items?.length || 0), 0)} stocks) into real UID: ${targetRealUid}`);
      } else {
        // Merge missing watchlists (e.g. Dhan F&O) and missing items into target
        let modified = false;
        const mergedLists = [...targetDisk];

        for (const legacyList of legacyLists) {
          const existingListIdx = mergedLists.findIndex(l => l.id === legacyList.id || l.name?.toLowerCase() === legacyList.name?.toLowerCase());
          if (existingListIdx === -1) {
            // Whole list missing in target (e.g. Dhan F&O)
            mergedLists.push(legacyList);
            modified = true;
          } else {
            // Check if any items in legacy are missing in existing list
            const existingList = mergedLists[existingListIdx];
            const existingSymbols = new Set((existingList.items || []).map((i: any) => String(i.symbol || i.scripCode || '').toUpperCase()));
            const missingItems = (legacyList.items || []).filter((i: any) => !existingSymbols.has(String(i.symbol || i.scripCode || '').toUpperCase()));
            if (missingItems.length > 0) {
              existingList.items = [...(existingList.items || []), ...missingItems];
              modified = true;
            }
          }
        }

        if (modified) {
          const sanitized = sanitizeWatchlistArray(mergedLists);
          console.log(`[WatchlistDao] Merged missing legacy admin watchlists/stocks into real UID: ${targetRealUid}`);
          await persistUserWatchlists(targetRealUid, sanitized);
          addLog('INFO', 'MIGRATION', `Merged missing legacy admin watchlists/stocks into real UID: ${targetRealUid}`);
        }
      }
    }
  } catch (err: any) {
    console.warn('[WatchlistDao] Legacy admin migration notice:', err?.message || err);
  }
}

async function persistUserWatchlists(uid: string, lists: any[]): Promise<void> {
  // Defensive: the retired 52-stock "Default" list must never be re-persisted
  // through any path (e.g. legacy admin merge). Idempotent for current data.
  const sanitized = sanitizeWatchlistArray(migrateToSingleFoDefault(lists).lists);
  userWatchlistsCache[uid] = { lists: sanitized, fetchedAt: Date.now() };
  userWatchlistsDirty[uid] = false;
  writeLocalJson(getWatchlistFilename(uid), sanitized);

  if (!isSupabaseConfigured()) return;

  try {
    await withRetry(async () => {
      const { error } = await getSupabase()
        .from(WATCHLISTS_TABLE)
        .upsert({ uid, lists: sanitized, updated_at: new Date().toISOString() }, { onConflict: 'uid' });
      if (error) throw error;
    }, {
      delays: [700, 1500],
      onRetry: (err, attempt) => {
        console.warn(`[WatchlistDao] Retrying Supabase write for watchlist UID ${uid} (attempt ${attempt}):`, err?.message || err);
      }
    });
    console.log(`[WatchlistDao] Cloud sync confirmed in Supabase for UID: ${uid} (${sanitized.length} lists, ${sanitized.reduce((acc, l) => acc + (l.items?.length || 0), 0)} stocks)`);
  } catch (err: any) {
    if (isOfflineOrNetworkError(err)) {
      console.info(`[WatchlistDao] Supabase connecting for ${uid}. Saved locally.`);
    } else {
      addLog('ERROR', 'SYNC', `Failed to persist watchlists for ${uid} to Supabase after retries: ${err?.message || err}`);
      console.warn(`Supabase notice in persistUserWatchlists for ${uid}:`, err?.message || err);
    }
  }
}

export interface GetWatchlistsOptions {
  /**
   * When true, never auto-create the starter default watchlists for unknown
   * users — return [] instead. Read-only alert pipelines (monitor, news
   * worker) must use this: scanning a user for alerts must not manufacture
   * 71 default stocks (and persist them) as a side effect.
   */
  noCreate?: boolean;
}

export async function getAllWatchlists(userId?: string, opts?: GetWatchlistsOptions): Promise<any[]> {
  const uid = sanitizeUserId(userId);
  const now = Date.now();
  const noCreate = opts?.noCreate === true;

  // 1. In-memory cache with short TTL (if not marked dirty)
  if (userWatchlistsCache[uid] !== undefined && !userWatchlistsDirty[uid] && (now - userWatchlistsCache[uid].fetchedAt < WATCHLISTS_CACHE_TTL_MS)) {
    return JSON.parse(JSON.stringify(userWatchlistsCache[uid].lists));
  }

  const localFile = getWatchlistFilename(uid);

  // 2. For logged-in users and admin, Supabase is the Single Source of Truth
  if (uid !== 'guest' && isSupabaseConfigured()) {
    try {
      const cloudLists = await readWatchlistsRow(uid);
      if (cloudLists !== null) {
        const sanitized = await migrateExistingUserWatchlists(uid, sanitizeWatchlistArray(cloudLists), noCreate);
        userWatchlistsCache[uid] = { lists: sanitized, fetchedAt: Date.now() };
        userWatchlistsDirty[uid] = false;
        writeLocalJson(localFile, sanitized);
        return JSON.parse(JSON.stringify(sanitized));
      } else {
        // No cloud row yet:
        // First check if there is legacy admin data that needs migration to this user
        const legacyFile = getWatchlistFilename('admin');
        const legacyDisk = readLocalJson<any[] | null>(legacyFile, null);
        if (legacyDisk && Array.isArray(legacyDisk) && legacyDisk.some(l => Array.isArray(l.items) && l.items.length > 0)) {
          await migrateLegacyAdminWatchlists(uid);
          if (userWatchlistsCache[uid]?.lists) {
            return JSON.parse(JSON.stringify(userWatchlistsCache[uid].lists));
          }
        }

        // Check if there is an existing local disk backup to migrate up to the cloud
        const loadedLocal = readLocalJson<any[] | null>(localFile, null);
        if (loadedLocal !== null && Array.isArray(loadedLocal) && loadedLocal.length > 0) {
          const sanitized = await migrateExistingUserWatchlists(uid, sanitizeWatchlistArray(loadedLocal), noCreate);
          userWatchlistsCache[uid] = { lists: sanitized, fetchedAt: Date.now() };
          userWatchlistsDirty[uid] = false;
          await upsertWatchlistsQuiet(uid, sanitized);
          return JSON.parse(JSON.stringify(sanitized));
        }

        // Truly a brand new user who has never saved anything: create default initial list
        // (skipped for read-only alert scans — they must not manufacture watchlists)
        if (noCreate) {
          return [];
        }
        const initial = createDefaultWatchlists();
        userWatchlistsCache[uid] = { lists: initial, fetchedAt: Date.now() };
        userWatchlistsDirty[uid] = false;
        writeLocalJson(localFile, initial);
        await upsertWatchlistsQuiet(uid, initial);
        return JSON.parse(JSON.stringify(initial));
      }
    } catch (err: any) {
      if (isOfflineOrNetworkError(err)) {
        console.info(`[WatchlistDao] Supabase client currently connecting for ${uid}, serving from local cache.`);
      } else {
        console.warn(`Supabase read notice in getAllWatchlists (${uid}):`, err?.message || err);
      }
      if (userWatchlistsCache[uid] !== undefined) {
        return JSON.parse(JSON.stringify(userWatchlistsCache[uid].lists));
      }
    }
  }

  // 3. Guest / local disk fallback
  let loadedLocal = readLocalJson<any[] | null>(localFile, null);
  if (loadedLocal === null && uid === 'guest') {
    loadedLocal = readLocalJson<any[] | null>('watchlists.json', null);
  }

  if (loadedLocal !== null && Array.isArray(loadedLocal)) {
    const sanitized = await migrateExistingUserWatchlists(uid, sanitizeWatchlistArray(loadedLocal), noCreate);
    userWatchlistsCache[uid] = { lists: sanitized, fetchedAt: Date.now() };
    writeLocalJson(localFile, sanitized);
    return JSON.parse(JSON.stringify(sanitized));
  }

  // Fresh default copy (skipped for read-only alert scans)
  if (noCreate) {
    return [];
  }
  const initial = createDefaultWatchlists();
  userWatchlistsCache[uid] = { lists: initial, fetchedAt: Date.now() };
  writeLocalJson(localFile, initial);
  return JSON.parse(JSON.stringify(initial));
}

export async function addWatchlist(name: string, userId?: string): Promise<string> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const id = Date.now().toString();
    const newList = {
      id,
      name: name.trim() || 'Custom Watchlist',
      is_active: 1,
      items: []
    };
    current.push(newList);
    await persistUserWatchlists(uid, current);
    return id;
  });
}

export async function deleteWatchlist(id: string, userId?: string): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    let current = await getAllWatchlists(uid);
    current = current.filter(l => String(l.id) !== String(id));
    await persistUserWatchlists(uid, current);
  });
}

export async function toggleWatchlist(id: string, isActive: boolean, userId?: string): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const found = current.find(l => String(l.id) === String(id));
    if (found) {
      found.is_active = isActive ? 1 : 0;
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function addSymbolToWatchlist(
  watchlistId: string, 
  symbol: string, 
  priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH', 
  category?: string,
  userId?: string
): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;

    const newItem: WatchlistStockItemDao = {
      symbol: sym,
      priority: priority || 'HIGH',
      category: category ? category.trim() : undefined
    };

    let targetList = current.find(l => String(l.id) === String(watchlistId));
    if (!targetList && current.length > 0) {
      targetList = current[0];
    }

    if (targetList) {
      if (!Array.isArray(targetList.items)) targetList.items = [];
      const existingIdx = targetList.items.findIndex((it: any) => extractSymbol(it) === sym);
      if (existingIdx >= 0) {
        targetList.items[existingIdx] = newItem;
      } else {
        targetList.items.push(newItem);
      }
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function addSymbolsToWatchlist(
  watchlistId: string, 
  symbols: (string | { symbol: string; priority?: 'HIGH' | 'MEDIUM' | 'LOW'; category?: string })[],
  userId?: string
): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    
    const cleanItems: WatchlistStockItemDao[] = symbols.map(s => {
      if (typeof s === 'string') {
        return { symbol: s.trim().toUpperCase(), priority: 'HIGH' as const };
      }
      const p = (s.priority || 'HIGH').toUpperCase();
      const priority: 'HIGH' | 'MEDIUM' | 'LOW' = (p === 'MEDIUM' || p === 'MED') ? 'MEDIUM' : p === 'LOW' ? 'LOW' : 'HIGH';
      return {
        symbol: (s.symbol || '').trim().toUpperCase(),
        priority,
        category: s.category ? s.category.trim() : undefined
      };
    }).filter(it => it.symbol.length > 0);

    let targetList = current.find(l => String(l.id) === String(watchlistId));
    if (!targetList && current.length > 0) {
      targetList = current[0];
    }

    if (targetList) {
      if (!Array.isArray(targetList.items)) targetList.items = [];
      for (const item of cleanItems) {
        const idx = targetList.items.findIndex((it: any) => extractSymbol(it) === item.symbol);
        if (idx >= 0) {
          targetList.items[idx] = item;
        } else {
          targetList.items.push(item);
        }
      }
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function updateSymbolPriorityInWatchlist(
  watchlistId: string, 
  symbol: string, 
  priority: 'HIGH' | 'MEDIUM' | 'LOW', 
  category?: string,
  userId?: string
): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const sym = symbol.trim().toUpperCase();
    const targetList = current.find(l => String(l.id) === String(watchlistId));

    if (targetList && Array.isArray(targetList.items)) {
      const idx = targetList.items.findIndex((it: any) => extractSymbol(it) === sym);
      if (idx >= 0) {
        const curr = targetList.items[idx];
        targetList.items[idx] = {
          symbol: sym,
          priority,
          category: category !== undefined ? category : extractCategory(curr)
        };
        await persistUserWatchlists(uid, current);
      }
    }
  });
}

export async function clearWatchlistSymbols(watchlistId: string, userId?: string): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const targetList = current.find(l => String(l.id) === String(watchlistId));
    if (targetList) {
      targetList.items = [];
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function clearAllWatchlistsSymbols(userId?: string): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    for (const list of current) {
      list.items = [];
    }
    await persistUserWatchlists(uid, current);
  });
}

export async function resetUserWatchlistsToDefault(userId?: string): Promise<any[]> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const initial = createDefaultWatchlists();
    await persistUserWatchlists(uid, initial);
    return JSON.parse(JSON.stringify(initial));
  });
}

export async function removeSymbolFromWatchlist(
  watchlistId: string, 
  symbol: string, 
  userId?: string
): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const sym = symbol.trim().toUpperCase();
    const targetList = current.find(l => String(l.id) === String(watchlistId));

    if (targetList && Array.isArray(targetList.items)) {
      targetList.items = targetList.items.filter((s: any) => extractSymbol(s) !== sym);
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function removeSymbolsFromWatchlistBatch(
  watchlistId: string, 
  symbols: string[], 
  userId?: string
): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    if (!Array.isArray(symbols) || symbols.length === 0) return;
    const current = await getAllWatchlists(uid);
    const symSet = new Set(symbols.map(s => String(s).trim().toUpperCase()).filter(Boolean));
    const targetList = current.find(l => String(l.id) === String(watchlistId));

    if (targetList && Array.isArray(targetList.items)) {
      targetList.items = targetList.items.filter((s: any) => !symSet.has(extractSymbol(s)));
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function updateSymbolsPriorityBatch(
  watchlistId: string,
  updates: { symbol: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; category?: string }[],
  userId?: string
): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    if (!Array.isArray(updates) || updates.length === 0) return;
    const current = await getAllWatchlists(uid);
    const targetList = current.find(l => String(l.id) === String(watchlistId));

    if (targetList && Array.isArray(targetList.items)) {
      const updateMap = new Map<string, { priority: 'HIGH' | 'MEDIUM' | 'LOW'; category?: string }>();
      for (const u of updates) {
        if (u && u.symbol) {
          updateMap.set(u.symbol.trim().toUpperCase(), u);
        }
      }

      let modified = false;
      for (let i = 0; i < targetList.items.length; i++) {
        const it = targetList.items[i];
        const sym = extractSymbol(it);
        const match = updateMap.get(sym);
        if (match) {
          targetList.items[i] = {
            ...it,
            symbol: sym,
            priority: match.priority,
            category: match.category !== undefined ? match.category : extractCategory(it)
          };
          modified = true;
        }
      }

      if (modified) {
        await persistUserWatchlists(uid, current);
      }
    }
  });
}

export async function renameWatchlist(id: string, newName: string, userId?: string): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const found = current.find(l => String(l.id) === String(id));
    if (found) {
      found.name = newName.trim() || found.name;
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function updateSymbolPriorityAcrossAllWatchlists(
  symbol: string,
  priority: 'HIGH' | 'MEDIUM' | 'LOW',
  category?: string,
  userId?: string
): Promise<void> {
  const uid = sanitizeUserId(userId);
  return withUidLock(uid, async () => {
    const current = await getAllWatchlists(uid);
    const sym = symbol.trim().toUpperCase();
    let modified = false;

    for (const list of current) {
      if (Array.isArray(list.items)) {
        const idx = list.items.findIndex((it: any) => extractSymbol(it) === sym);
        if (idx >= 0) {
          const curr = list.items[idx];
          list.items[idx] = {
            symbol: sym,
            priority,
            category: category !== undefined ? category : extractCategory(curr)
          };
          modified = true;
        }
      }
    }

    if (modified) {
      await persistUserWatchlists(uid, current);
    }
  });
}

export async function getAllActiveWatchlistsAcrossUsers(): Promise<any[]> {
  const allLists: any[] = [];
  const knownUids = new Set<string>(['bcb4FayOgxYPdyH7HoBKlfCpjZB2', 'guest']);
  try {
    const users = readLocalJson<Record<string, any>>('users.json', {});
    Object.keys(users).forEach(k => {
      if (k && k !== 'admin') knownUids.add(k);
    });
  } catch {}

  for (const uid of knownUids) {
    try {
      const watchlists = await getAllWatchlists(uid);
      if (Array.isArray(watchlists)) {
        allLists.push(...watchlists);
      }
    } catch {}
  }
  return allLists;
}

export async function getActiveWatchlistSymbols(userId?: string, opts?: GetWatchlistsOptions): Promise<string[]> {
  const symbols: string[] = [];

  // If specific non-admin user is requested
  if (userId && userId !== 'admin' && userId !== 'all') {
    const uid = sanitizeUserId(userId);
    const watchlists = await getAllWatchlists(uid, opts);
    for (const list of watchlists) {
      if (list.is_active) {
        const listItems = Array.isArray(list.items) ? list.items : [];
        for (const it of listItems) {
          const sym = extractSymbol(it);
          if (sym) symbols.push(sym);
        }
      }
    }
    return [...new Set(symbols)];
  }

  // Aggregate across all known users and primary owner
  const knownUids = new Set<string>(['bcb4FayOgxYPdyH7HoBKlfCpjZB2', 'guest']);
  try {
    const users = readLocalJson<Record<string, any>>('users.json', {});
    Object.keys(users).forEach(k => {
      if (k && k !== 'admin') knownUids.add(k);
    });
  } catch {}

  for (const uid of knownUids) {
    try {
      const watchlists = await getAllWatchlists(uid, opts);
      for (const list of watchlists) {
        if (list.is_active) {
          const listItems = Array.isArray(list.items) ? list.items : [];
          for (const it of listItems) {
            const sym = extractSymbol(it);
            if (sym) symbols.push(sym);
          }
        }
      }
    } catch {}
  }

  return [...new Set(symbols)];
}

export async function getActiveWatchlistSymbolMap(userId?: string, opts?: GetWatchlistsOptions): Promise<Record<string, { priority: 'HIGH' | 'MEDIUM' | 'LOW', category?: string, scripCode?: string, companyName?: string }>> {
  const map: Record<string, { priority: 'HIGH' | 'MEDIUM' | 'LOW', category?: string, scripCode?: string, companyName?: string }> = {};
  const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  // If specific non-admin user is requested
  if (userId && userId !== 'admin' && userId !== 'all') {
    const uid = sanitizeUserId(userId);
    const listsToScan: any[] = await getAllWatchlists(uid, opts);

    for (const list of listsToScan) {
      if (list.is_active) {
        const listItems = Array.isArray(list.items) ? list.items : [];
        for (const it of listItems) {
          const sym = extractSymbol(it);
          if (sym) {
            const itemP = extractPriority(it);
            const itemCat = extractCategory(it);
            const resolved = resolveStockDetailsSync(sym);
            if (!map[sym] || weight[itemP] > weight[map[sym].priority]) {
              map[sym] = {
                priority: itemP,
                category: itemCat || map[sym]?.category,
                scripCode: resolved?.scripCode || (typeof it === 'object' && it.scripCode ? String(it.scripCode) : undefined),
                companyName: resolved?.name || (typeof it === 'object' && it.companyName ? String(it.companyName) : undefined)
              };
            }
          }
        }
      }
    }
    return map;
  }

  // Aggregate across all known users and primary owner
  const knownUids = new Set<string>(['bcb4FayOgxYPdyH7HoBKlfCpjZB2', 'guest']);
  try {
    const users = readLocalJson<Record<string, any>>('users.json', {});
    Object.keys(users).forEach(k => {
      if (k && k !== 'admin') knownUids.add(k);
    });
  } catch {}

  for (const uid of knownUids) {
    try {
      const listsToScan: any[] = await getAllWatchlists(uid, opts);
      for (const list of listsToScan) {
        if (list.is_active) {
          const listItems = Array.isArray(list.items) ? list.items : [];
          for (const it of listItems) {
            const sym = extractSymbol(it);
            if (sym) {
              const itemP = extractPriority(it);
              const itemCat = extractCategory(it);
              const resolved = resolveStockDetailsSync(sym);
              if (!map[sym] || weight[itemP] > weight[map[sym].priority]) {
                map[sym] = {
                  priority: itemP,
                  category: itemCat || map[sym]?.category,
                  scripCode: resolved?.scripCode || (typeof it === 'object' && it.scripCode ? String(it.scripCode) : undefined),
                  companyName: resolved?.name || (typeof it === 'object' && it.companyName ? String(it.companyName) : undefined)
                };
              }
            }
          }
        }
      }
    } catch {}
  }

  return map;
}

/**
 * Initializes default watchlist collections on first launch for default profiles
 */
export async function initWatchlists(): Promise<void> {
  try {
    const guestLists = await getAllWatchlists('guest');
    if (!guestLists || guestLists.length === 0) {
      const initial = createDefaultWatchlists();
      await persistUserWatchlists('guest', initial);
    }
  } catch (err: any) {
    console.info('[WatchlistDao] Initialized default local watchlists.');
  }
}

