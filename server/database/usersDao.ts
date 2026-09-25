import { adminDb } from './firebase.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isOfflineOrNetworkError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied } from './localStore.js';
import { UserProfile } from '../../src/types.js';
import { withRetry } from '../utils/retry.js';
import { addLog } from './logDao.js';

const USERS_FILE = 'users.json';
const USER_CACHE_TTL_MS = 2500; // Fast cache invalidation for fresh Firestore reads
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

  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) {
    usersWithTelegramCache = { list: localList, fetchedAt: now };
    return localList;
  }

  try {
    const snap = await adminDb.collection('users')
      .where('telegramChatId', '!=', null)
      .get();
    
    const result: UserProfile[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as UserProfile;
      if (data && docSnap.id) {
        data.uid = docSnap.id;
        if (data.telegramChatId && String(data.telegramChatId).trim() !== '') {
          result.push(data);
          userProfilesCache[docSnap.id] = { profile: data, fetchedAt: now };
        }
      }
    });

    usersWithTelegramCache = { list: result, fetchedAt: now };
    return result;
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
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
  if (allUsersListCache && (now - allUsersListCache.fetchedAt < USER_CACHE_TTL_MS)) {
    return JSON.parse(JSON.stringify(allUsersListCache.list));
  }

  const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});

  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) {
    const list = Object.values(localUsersMap);
    allUsersListCache = { list, fetchedAt: now };
    return list;
  }

  try {
    const snap = await adminDb.collection('users').get();
    const result: UserProfile[] = [];
    const updatedMap: Record<string, UserProfile> = { ...localUsersMap };

    snap.forEach(docSnap => {
      const data = docSnap.data() as UserProfile;
      if (data && docSnap.id) {
        data.uid = docSnap.id;
        result.push(data);
        updatedMap[docSnap.id] = data;
        userProfilesCache[docSnap.id] = { profile: data, fetchedAt: now };
      }
    });

    writeLocalJson(USERS_FILE, updatedMap);
    allUsersListCache = { list: result, fetchedAt: now };
    return result;
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const now = Date.now();

  // 1. Return fresh in-memory profile if within TTL
  if (userProfilesCache[uid] && (now - userProfilesCache[uid].fetchedAt < USER_CACHE_TTL_MS)) {
    return JSON.parse(JSON.stringify(userProfilesCache[uid].profile));
  }

  // 2. Query Firestore as the authoritative source
  if (!isFirestoreQuotaExceeded() && !isAdminPermissionDenied()) {
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const data = userDoc.data() as UserProfile;
        data.uid = uid;
        userProfilesCache[uid] = { profile: data, fetchedAt: now };

        // Keep local disk backup updated
        const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
        localUsersMap[uid] = data;
        writeLocalJson(USERS_FILE, localUsersMap);

        return JSON.parse(JSON.stringify(data));
      }
    } catch (err: any) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExceeded(true);
      } else if (isPermissionDeniedError(err)) {
        setAdminPermissionDenied(true);
      } else if (isOfflineOrNetworkError(err)) {
        console.info(`[UsersDao] Firestore connecting for ${uid}, serving profile from local cache.`);
      } else {
        console.warn(`[UsersDao] Firestore read notice for ${uid}:`, err?.message || err);
      }
    }
  }

  // 3. Fallback to local disk file
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
  skipUniquenessCheck: boolean = false
): Promise<UserProfile> {
  const localUsersMap = readLocalJson<Record<string, UserProfile>>(USERS_FILE, {});
  const existingProfile = userProfilesCache[uid]?.profile || localUsersMap[uid];
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

  userProfilesCache[uid] = { profile: updated, fetchedAt: Date.now() };
  allUsersListCache = null;
  usersWithTelegramCache = null;
  localUsersMap[uid] = updated;
  writeLocalJson(USERS_FILE, localUsersMap);

  if (!isFirestoreQuotaExceeded() && !isAdminPermissionDenied()) {
    try {
      await withRetry(async () => {
        await adminDb.collection('users').doc(uid).set(updated, { merge: true });
      }, {
        delays: [700, 1500, 3000],
        onRetry: (err, attempt) => {
          console.warn(`[UsersDao] Retrying Firestore write for user ${uid} (attempt ${attempt}):`, err?.message || err);
        }
      });
    } catch (err: any) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExceeded(true);
        addLog('WARNING', 'SYNC', `Firestore quota limit reached during user profile save for ${uid}. Saved to local fallback.`);
      } else if (isPermissionDeniedError(err)) {
        setAdminPermissionDenied(true);
      } else {
        addLog('ERROR', 'SYNC', `Failed to persist user profile for ${uid} to Firestore after retries: ${err?.message || err}`);
        console.error(`[UsersDao] Error persisting profile for ${uid}:`, err);
      }
    }
  }

  return updated;
}

// Run boot deduplication pass asynchronously
setTimeout(() => {
  cleanAndDeduplicateAllUsernames().catch(e => console.warn('[UsersDao] Initial username deduplication notice:', e));
}, 2000);

