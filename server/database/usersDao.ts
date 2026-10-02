import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { readLocalJson, writeLocalJson, isOfflineOrNetworkError } from './localStore.js';
import { UserProfile } from '../../src/types.js';
import { withRetry } from '../utils/retry.js';
import { addLog } from './logDao.js';
import { PaymentStoreUnavailableError, runPaymentStore } from './paymentStore.js';

const USERS_TABLE = 'users';

// --- Row mapping: camelCase UserProfile <-> snake_case Postgres columns ---
function toRow(p: UserProfile): Record<string, any> {
  return {
    uid: p.uid,
    email: p.email ?? null,
    display_name: p.displayName ?? null,
    username: p.username ?? null,
    photo_url: p.photoURL ?? null,
    tier: p.tier || 'free',
    pro_expires_at: p.proExpiresAt ?? null,
    trial_used: !!p.trialUsed,
    free_summary_used: !!p.freeSummaryUsed,
    pro_plan_id: p.proPlanId ?? null,
    last_payment_at: p.lastPaymentAt ?? null,
    last_order_id: p.lastOrderId ?? null,
    telegram_chat_id: p.telegramChatId ?? null,
    telegram_username: p.telegramUsername ?? null,
    mute_in_app_notifications: !!p.muteInAppNotifications,
    notification_prefs: p.notificationPreferences ?? {},
    created_at: p.createdAt ?? Date.now(),
    last_login_at: p.lastLoginAt ?? Date.now(),
    max_watchlist_stocks: p.maxWatchlistStocks ?? 25,
  };
}

function fromRow(r: any): UserProfile {
  return {
    uid: r.uid,
    email: r.email ?? null,
    displayName: r.display_name ?? null,
    username: r.username ?? null,
    photoURL: r.photo_url ?? null,
    tier: r.tier || 'free',
    proExpiresAt: r.pro_expires_at != null ? Number(r.pro_expires_at) : null,
    trialUsed: !!r.trial_used,
    freeSummaryUsed: !!r.free_summary_used,
    proPlanId: r.pro_plan_id ?? null,
    lastPaymentAt: r.last_payment_at != null ? Number(r.last_payment_at) : null,
    lastOrderId: r.last_order_id ?? null,
    telegramChatId: r.telegram_chat_id ?? null,
    telegramUsername: r.telegram_username ?? null,
    muteInAppNotifications: !!r.mute_in_app_notifications,
    notificationPreferences: r.notification_prefs || {},
    createdAt: Number(r.created_at || 0),
    lastLoginAt: Number(r.last_login_at || 0),
    maxWatchlistStocks: Number(r.max_watchlist_stocks ?? 25),
  } as UserProfile;
}

const USERS_FILE = 'users.json';
const USER_CACHE_TTL_MS = 2500; // Fast cache invalidation for fresh Firestore reads
// Quota-bachao (1 Oct): the ALL-users list is consumed only by background
// scans (monitor cycle, news worker). A full `users` collection scan on every
// poll cycle burned thousands of reads/day for data that changes rarely — and
// every profile save already nulls this cache (saveUserProfile /
// invalidateUserProfileCache), so OFF/payment/preference changes still punch
// through instantly. Per-UID profile reads keep the short TTL above.
const ALL_USERS_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
export const ADMIN_EMAIL = 'dahiyarahul023@gmail.com';

// Strictly reserved system and staff handles that regular users cannot claim
export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'owner',
  'bse_admin',
  'nexus_admin',
  'official',
  'support',
  'moderator',
  'bse',
  'nexus',
  'help',
  'system',
  'bse_nexus',
  'rahul023'
]);

interface CachedUserEntry {
  profile: UserProfile;
  fetchedAt: number;
}

let userProfilesCache: Record<string, CachedUserEntry> = {};
let allUsersListCache: { list: UserProfile[]; fetchedAt: number } | null = null;
let usersWithTelegramCache: { list: UserProfile[]; fetchedAt: number } | null = null;
const USERS_WITH_TELEGRAM_CACHE_TTL_MS = 60000;

export function invalidateUserProfileCache(uid?: string) {
  if (uid) {
    delete userProfilesCache[uid];
  } else {
    userProfilesCache = {};
  }
  allUsersListCache = null;
  usersWithTelegramCache = null;
}

export function invalidateUsersWithTelegramCache() {
  usersWithTelegramCache = null;
}

export async function getUsersWithTelegram(): Promise<UserProfile[]> {
  const now = Date.now();
  if (usersWithTelegramCache && (now - usersWithTelegramCache.fetchedAt < USERS_WITH_TELEGRAM_CACHE_TTL_MS)) {
    return JSON.parse(JSON.stringify(usersWithTelegramCache.list));
  }

  const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
  const localList = Object.values(localUsersMap).filter(u => u.telegramChatId && String(u.telegramChatId).trim() !== '');

  if (!isSupabaseConfigured()) {
    usersWithTelegramCache = { list: localList, fetchedAt: now };
    return localList;
  }

  try {
    const { data, error } = await getSupabase()
      .from(USERS_TABLE)
      .select('*')
      .not('telegram_chat_id', 'is', null);
    if (error) throw error;

    const result: UserProfile[] = [];
    for (const row of data || []) {
      const profile = fromRow(row);
      if (profile.telegramChatId && String(profile.telegramChatId).trim() !== '') {
        result.push(profile);
        userProfilesCache[profile.uid] = { profile, fetchedAt: now };
      }
    }

    usersWithTelegramCache = { list: result, fetchedAt: now };
    return result;
  } catch (err: any) {
    usersWithTelegramCache = { list: localList, fetchedAt: now };
    return localList;
  }
}

/**
 * Standardize and sanitize a username string according to strict rules:
 * - Lowercase only
 * - Alphanumeric and underscores only [a-z0-9_]
 * - Strips leading @
 * - Length between 3 and 25 characters
 */
export function sanitizeUsername(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 25);
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const now = Date.now();
  if (allUsersListCache && (now - allUsersListCache.fetchedAt < ALL_USERS_LIST_CACHE_TTL_MS)) {
    return JSON.parse(JSON.stringify(allUsersListCache.list));
  }

  const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});

  if (!isSupabaseConfigured()) {
    const list = Object.values(localUsersMap);
    allUsersListCache = { list, fetchedAt: now };
    return list;
  }

  try {
    const { data, error } = await getSupabase().from(USERS_TABLE).select('*');
    if (error) throw error;
    const result: UserProfile[] = [];
    const updatedMap: Record<string, UserProfile> = { ...localUsersMap };

    for (const row of data || []) {
      const profile = fromRow(row);
      result.push(profile);
      updatedMap[profile.uid] = profile;
      userProfilesCache[profile.uid] = { profile, fetchedAt: now };
    }

    writeLocalJson(USERS_FILE, updatedMap);
    allUsersListCache = { list: result, fetchedAt: now };
    return result;
  } catch (err: any) {
    const list = Object.values(localUsersMap);
    allUsersListCache = { list, fetchedAt: now };
    return list;
  }
}

/**
 * Checks if a specific username is globally available.
 * Rules:
 * 1. Checks format (minimum 3 chars, valid chars)
 * 2. Checks reserved list (Admin/Owner can claim reserved handles; regular users cannot)
 * 3. Checks all existing registered user profiles (case-insensitive)
 */
export async function isUsernameAvailable(
  rawUsername: string,
  excludeUid?: string,
  userEmail?: string
): Promise<{ available: boolean; cleanUsername: string; reason?: string }> {
  const clean = sanitizeUsername(rawUsername);

  if (!clean || clean.length < 3) {
    return { available: false, cleanUsername: clean, reason: 'Username must be at least 3 characters long.' };
  }

  if (clean.length > 25) {
    return { available: false, cleanUsername: clean, reason: 'Username cannot exceed 25 characters.' };
  }

  const isOwner = userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Check reserved names
  if (RESERVED_USERNAMES.has(clean) && !isOwner) {
    return { 
      available: false, 
      cleanUsername: clean, 
      reason: 'This username is reserved for system administrators.' 
    };
  }

  // Fetch all profiles from Cloud / Store to verify uniqueness
  const allUsers = await getAllUserProfiles();
  
  for (const u of allUsers) {
    if (u.uid === excludeUid) continue; // Same user keeping their own username is valid
    
    const existingClean = sanitizeUsername(u.username || '');
    if (existingClean && existingClean === clean) {
      return { 
        available: false, 
        cleanUsername: clean, 
        reason: 'This username is already taken by another trader.' 
      };
    }
  }

  return { available: true, cleanUsername: clean };
}

/**
 * Generates a strictly unique username by appending incremental numbers (1, 2, 3...)
 * if the base username or email prefix is already taken.
 */
export async function generateUniqueUsername(
  baseRaw: string,
  excludeUid?: string,
  userEmail?: string
): Promise<string> {
  let cleanBase = sanitizeUsername(baseRaw);
  if (!cleanBase || cleanBase.length < 3) {
    cleanBase = 'trader';
  }

  // Check if base is already available
  const initialCheck = await isUsernameAvailable(cleanBase, excludeUid, userEmail);
  if (initialCheck.available) {
    return cleanBase;
  }

  // Try appending incremental suffixes: 1, 2, 3 ... 999
  let counter = 1;
  while (counter < 1000) {
    const candidate = `${cleanBase}${counter}`.slice(0, 25);
    const check = await isUsernameAvailable(candidate, excludeUid, userEmail);
    if (check.available) {
      return candidate;
    }
    counter++;
  }

  // Extreme fallback with random digits
  return `${cleanBase.slice(0, 18)}_${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Automatic Cloud Registry Migration & Deduplication:
 * Scans all registered user profiles on the cloud/disk:
 * 1. Admin/Owner profile is preserved completely isolated and untouched.
 * 2. Any regular user sharing a duplicate username or conflicting with admin/reserved
 *    gets automatically reassigned a numbered unique suffix (e.g. user1, user2).
 */
export async function cleanAndDeduplicateAllUsernames(): Promise<{ cleanedCount: number }> {
  try {
    const allUsers = await getAllUserProfiles();
    const seenUsernames = new Map<string, string>(); // username -> uid
    let cleanedCount = 0;

    // 1. First Pass: Register Admin/Owner handles so they are given absolute priority
    for (const u of allUsers) {
      const isOwner = u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (isOwner && u.username) {
        const clean = sanitizeUsername(u.username);
        seenUsernames.set(clean, u.uid);
      }
    }

    // 2. Second Pass: Verify all other users and fix collisions
    for (const u of allUsers) {
      const isOwner = u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (isOwner) continue; // Admin is untouched

      let currentUsername = sanitizeUsername(u.username || (u.email ? u.email.split('@')[0] : 'trader'));
      if (currentUsername.length < 3) {
        currentUsername = `trader_${currentUsername}`;
      }

      const isReserved = RESERVED_USERNAMES.has(currentUsername);
      const isAlreadyTaken = seenUsernames.has(currentUsername) && seenUsernames.get(currentUsername) !== u.uid;

      if (isReserved || isAlreadyTaken || !u.username || u.username !== currentUsername) {
        // Find a new unique username with numbering (e.g., rahul1, rahul2)
        let counter = 1;
        let uniqueCandidate = currentUsername;
        while (seenUsernames.has(uniqueCandidate) || RESERVED_USERNAMES.has(uniqueCandidate)) {
          uniqueCandidate = `${currentUsername}${counter}`.slice(0, 25);
          counter++;
        }

        seenUsernames.set(uniqueCandidate, u.uid);
        u.username = uniqueCandidate;
        cleanedCount++;

        // Save back to Firestore and local backup
        await saveUserProfile(u.uid, { username: uniqueCandidate }, true);
        console.info(`[UsersDao] Deduplicated username for user ${u.email || u.uid} -> @${uniqueCandidate}`);
      } else {
        seenUsernames.set(currentUsername, u.uid);
      }
    }

    if (cleanedCount > 0) {
      addLog('INFO', 'AUTH', `Cleaned and deduplicated ${cleanedCount} user profile handles for cloud uniqueness.`);
    }

    return { cleanedCount };
  } catch (err: any) {
    console.warn('[UsersDao] Error during username deduplication pass:', err?.message || err);
    return { cleanedCount: 0 };
  }
}

export async function getUserProfile(
  uid: string,
  options: { durable?: boolean } = {},
): Promise<UserProfile | null> {
  const now = Date.now();
  const durable = options.durable === true;

  // Ordinary app reads may use the short-lived cache. Durable payment/profile
  // reads always go back to Supabase: an in-memory or local copy must never
  // be allowed to reinterpret a paid user as trial/free after a republish.
  if (!durable && userProfilesCache[uid] && (now - userProfilesCache[uid].fetchedAt < USER_CACHE_TTL_MS)) {
    return JSON.parse(JSON.stringify(userProfilesCache[uid].profile));
  }

  if (durable) {
    const row = await runPaymentStore(
      'read user profile',
      (async () => {
        const { data, error } = await getSupabase()
          .from(USERS_TABLE)
          .select('*')
          .eq('uid', uid)
          .maybeSingle();
        if (error) throw error;
        return data;
      })(),
      10_000,
    );

    if (!row) return null;

    const data = fromRow(row);
    userProfilesCache[uid] = { profile: data, fetchedAt: now };

    // Local JSON is only a disposable cache here, never the source of truth.
    try {
      const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
      localUsersMap[uid] = data;
      writeLocalJson(USERS_FILE, localUsersMap);
    } catch { /* non-fatal cache write */ }

    return JSON.parse(JSON.stringify(data));
  }

  // General app path: Supabase first, local cache only as a resilience
  // fallback for non-payment features. Payment code must pass durable:true.
  if (isSupabaseConfigured()) {
    try {
      const { data: row, error } = await getSupabase()
        .from(USERS_TABLE)
        .select('*')
        .eq('uid', uid)
        .maybeSingle();
      if (error) throw error;
      if (row) {
        const data = fromRow(row);
        userProfilesCache[uid] = { profile: data, fetchedAt: now };

        try {
          const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
          localUsersMap[uid] = data;
          writeLocalJson(USERS_FILE, localUsersMap);
        } catch { /* non-fatal cache write */ }

        return JSON.parse(JSON.stringify(data));
      }
    } catch (err: any) {
      if (isOfflineOrNetworkError(err)) {
        console.info(`[UsersDao] Supabase connecting for ${uid}, serving profile from local cache.`);
      } else {
        console.warn(`[UsersDao] Supabase read notice for ${uid}:`, err?.message || err);
      }
    }
  }

  const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
  if (localUsersMap[uid]) {
    userProfilesCache[uid] = { profile: localUsersMap[uid], fetchedAt: now };
    return JSON.parse(JSON.stringify(localUsersMap[uid]));
  }

  return null;
}

export async function saveUserProfile(
  uid: string,
  profile: Partial<UserProfile>,
  skipUniquenessCheck: boolean = false,
  options: { durable?: boolean } = {},
): Promise<UserProfile> {
  const durable = options.durable === true;

  let existingProfile: UserProfile | undefined;
  if (durable) {
    existingProfile = (await getUserProfile(uid, { durable: true })) || undefined;
  } else {
    const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
    existingProfile = userProfilesCache[uid]?.profile || localUsersMap[uid];
  }
  const existingEmail = existingProfile?.email || profile.email;

  // If username is being changed/set, enforce strict uniqueness unless skipping
  if (profile.username !== undefined && !skipUniquenessCheck) {
    const check = await isUsernameAvailable(profile.username, uid, existingEmail);
    if (!check.available) {
      const suggestion = await generateUniqueUsername(profile.username, uid, existingEmail);
      const err: any = new Error(check.reason || 'Username is already taken.');
      err.code = 'USERNAME_UNAVAILABLE';
      err.suggestion = suggestion;
      throw err;
    }
    profile.username = check.cleanUsername;
  }

  const existing = existingProfile || { uid, createdAt: Date.now() };
  const updated: UserProfile = { ...existing, ...profile, uid } as UserProfile;

  if (durable) {
    await runPaymentStore(
      'save user profile',
      (async () => {
        const { error } = await getSupabase()
          .from(USERS_TABLE)
          .upsert(toRow(updated), { onConflict: 'uid' });
        if (error) throw error;
      })(),
      12_000,
    );

    userProfilesCache[uid] = { profile: updated, fetchedAt: Date.now() };
    allUsersListCache = null;
    usersWithTelegramCache = null;

    // Cache only after Supabase confirms the write. A successful durable
    // return must never mean "saved only in revision-local JSON".
    try {
      const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
      localUsersMap[uid] = updated;
      writeLocalJson(USERS_FILE, localUsersMap);
    } catch { /* non-fatal cache write */ }

    return updated;
  }

  userProfilesCache[uid] = { profile: updated, fetchedAt: Date.now() };
  allUsersListCache = null;
  usersWithTelegramCache = null;

  try {
    const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
    localUsersMap[uid] = updated;
    writeLocalJson(USERS_FILE, localUsersMap);
  } catch { /* non-fatal cache write */ }

  if (isSupabaseConfigured()) {
    try {
      await withRetry(async () => {
        const { error } = await getSupabase()
          .from(USERS_TABLE)
          .upsert(toRow(updated), { onConflict: 'uid' });
        if (error) throw error;
      }, {
        delays: [700, 1500, 3000],
        onRetry: (err, attempt) => {
          console.warn(`[UsersDao] Retrying Supabase write for user ${uid} (attempt ${attempt}):`, err?.message || err);
        }
      });
    } catch (err: any) {
      addLog('ERROR', 'SYNC', `Failed to persist user profile for ${uid} to Supabase after retries: ${err?.message || err}`);
      console.error(`[UsersDao] Error persisting profile for ${uid}:`, err);
    }
  }

  return updated;
}

// ---- One-time free AI summary demo: atomic claim -------------------------
// Per-uid promise-chain mutex: serializes concurrent claims on this instance.
const freeDemoLocks = new Map<string, Promise<void>>();

/**
 * Atomically claim the one-time free AI summary demo for a free-plan user.
 * Returns true if THIS call won the claim (caller may generate the summary),
 * false if the demo was already used (caller must 403).
 * - Supabase function claim_free_summary_demo when available (atomic across
 *   Cloud Run instances: single INSERT-or-conditional-UPDATE statement).
 * - Serialized local read-modify-write fallback when Supabase is down.
 */
export async function claimFreeSummaryDemo(uid: string): Promise<boolean> {
  const prev = freeDemoLocks.get(uid) || Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((res) => { release = () => res(); });
  const chained = prev.then(() => mine);
  freeDemoLocks.set(uid, chained);
  await prev;
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data: won, error } = await getSupabase().rpc('claim_free_summary_demo', { p_uid: uid });
        if (error) throw error;
        if (won) {
          // Keep in-memory cache + local fallback in sync with the won claim
          try {
            const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
            const existing = localUsersMap[uid] || userProfilesCache[uid]?.profile;
            const updated = { ...(existing || { uid, createdAt: Date.now() }), freeSummaryUsed: true, uid } as UserProfile;
            localUsersMap[uid] = updated;
            writeLocalJson(USERS_FILE, localUsersMap);
            userProfilesCache[uid] = { profile: updated, fetchedAt: Date.now() };
          } catch { /* cache sync is best-effort; Supabase is authoritative */ }
        }
        return !!won;
      } catch (err: any) {
        console.warn(`[UsersDao] Free-demo claim notice for ${uid}:`, err?.message || err);
        // fall through to the serialized local fallback
      }
    }
    const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
    const existing = localUsersMap[uid] || userProfilesCache[uid]?.profile;
    if ((existing as any)?.freeSummaryUsed) return false;
    const updated = { ...(existing || { uid, createdAt: Date.now() }), freeSummaryUsed: true, uid } as UserProfile;
    localUsersMap[uid] = updated;
    writeLocalJson(USERS_FILE, localUsersMap);
    userProfilesCache[uid] = { profile: updated, fetchedAt: Date.now() };
    return true;
  } finally {
    release();
    if (freeDemoLocks.get(uid) === chained) freeDemoLocks.delete(uid);
  }
}

/**
 * Release a previously won free-demo claim (used when summary generation
 * fails, so the user can retry their one demo). Best-effort.
 */
export async function releaseFreeSummaryDemo(uid: string): Promise<void> {
  try {
    await saveUserProfile(uid, { freeSummaryUsed: false } as any, true);
  } catch (err: any) {
    console.warn(`[UsersDao] Free-demo release notice for ${uid}:`, err?.message || err);
  }
}

// Run boot deduplication pass asynchronously
setTimeout(() => {
  cleanAndDeduplicateAllUsernames().catch(e => console.warn('[UsersDao] Initial username deduplication notice:', e));
}, 2000);

