import { readLocalJson, writeLocalJson } from '../database/localStore.js';
import { getUserProfile } from '../database/usersDao.js';

const AI_USAGE_FILE = 'ai_usage.json';

function getTodayKeyIST(): string {
  const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function checkServerAiQuota(
  uid: string,
  isAdminUser: boolean
): Promise<{ allowed: boolean; remaining: number; dailyLimit: number; error?: string; isPro?: boolean }> {
  // 1. Admin/Owner always has full unlimited AI generation
  if (isAdminUser || uid === 'admin') {
    return { allowed: true, remaining: Infinity, dailyLimit: Infinity, isPro: true };
  }

  // 2. Guest users (unauthenticated / anonymous): STRICTLY 0 QUOTA.
  // This prevents bots, web crawlers, or random visitors from draining the Gemini API limits.
  if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit: 0,
      error: "Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial with Gemini AI summaries.",
      isPro: false
    };
  }

  // 3. Authenticated User: Verify active 1-Week Pro Trial
  const profile = await getUserProfile(uid);
  const now = Date.now();
  const proExpiresAt = profile?.proExpiresAt;
  const isProActive = Boolean(proExpiresAt && proExpiresAt > now);

  // If user's 1-week Pro trial has expired
  if (!isProActive && profile?.tier !== 'admin') {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit: 0,
      error: "Your 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) to continue generating Gemini AI summaries.",
      isPro: false
    };
  }

  // 4. User has active 1-Week Pro Trial: Provide generous 100 summaries/day fair-use rate limit
  const todayKey = getTodayKeyIST();
  const usageKey = `${uid}_${todayKey}`;
  const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  const used = usageMap[usageKey] || 0;

  const dailyLimit = 100; // Fair-use daily limit for 1-week Pro trial
  const remaining = Math.max(0, dailyLimit - used);

  if (used >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit,
      error: `Daily Pro quota reached (${dailyLimit} AI summaries/day). Resets at 00:00 IST.`,
      isPro: true
    };
  }

  return {
    allowed: true,
    remaining,
    dailyLimit,
    isPro: true
  };
}

export async function resetServerAiQuota(uid: string): Promise<boolean> {
  const todayKey = getTodayKeyIST();
  const usageKey = `${uid}_${todayKey}`;
  const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  delete usageMap[usageKey];
  writeLocalJson(AI_USAGE_FILE, usageMap);
  return true;
}

export async function consumeServerAiQuota(
  uid: string,
  isAdminUser: boolean
): Promise<{ remaining: number; dailyLimit: number; isPro: boolean }> {
  // 1. Admin / Owner has unlimited
  if (isAdminUser || uid === 'admin') {
    return { remaining: Infinity, dailyLimit: Infinity, isPro: true };
  }

  // 2. Guests have 0 quota
  if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
    return { remaining: 0, dailyLimit: 0, isPro: false };
  }

  // 3. Authenticated user: Check 1-week (7-day) Pro trial
  const profile = await getUserProfile(uid);
  const now = Date.now();
  const proExpiresAt = profile?.proExpiresAt;
  const isProActive = Boolean(proExpiresAt && proExpiresAt > now);

  if (!isProActive && profile?.tier !== 'admin') {
    return { remaining: 0, dailyLimit: 0, isPro: false };
  }

  const todayKey = getTodayKeyIST();
  const usageKey = `${uid}_${todayKey}`;
  const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  const used = usageMap[usageKey] || 0;

  const dailyLimit = 100;
  const newUsed = used + 1;
  usageMap[usageKey] = newUsed;
  writeLocalJson(AI_USAGE_FILE, usageMap);

  return {
    remaining: Math.max(0, dailyLimit - newUsed),
    dailyLimit,
    isPro: true
  };
}

export async function checkAndConsumeServerAiQuota(
  uid: string,
  isAdminUser: boolean
): Promise<{ allowed: boolean; remaining: number; dailyLimit: number; error?: string; isPro?: boolean }> {
  const check = await checkServerAiQuota(uid, isAdminUser);
  if (!check.allowed) {
    return check;
  }
  const consumed = await consumeServerAiQuota(uid, isAdminUser);
  return {
    allowed: true,
    remaining: consumed.remaining,
    dailyLimit: consumed.dailyLimit,
    isPro: consumed.isPro
  };
}

export async function getServerAiQuotaStatus(
  uid: string,
  isAdminUser: boolean
): Promise<{ tier: 'guest' | 'free' | 'pro' | 'admin'; dailyLimit: number; usedToday: number; remaining: number; canGenerate: boolean; proDaysLeft?: number }> {
  if (isAdminUser || uid === 'admin') {
    return {
      tier: 'admin',
      dailyLimit: Infinity,
      usedToday: 0,
      remaining: Infinity,
      canGenerate: true
    };
  }

  // Guest users have 0 quota
  if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
    return {
      tier: 'guest',
      dailyLimit: 0,
      usedToday: 0,
      remaining: 0,
      canGenerate: false,
      proDaysLeft: 0
    };
  }

  // Authenticated user: Check 1-week (7-day) Pro trial
  const profile = await getUserProfile(uid);
  const now = Date.now();
  const proExpiresAt = profile?.proExpiresAt;
  const isProActive = Boolean(proExpiresAt && proExpiresAt > now);
  const proDaysLeft = proExpiresAt ? Math.max(0, Math.ceil((proExpiresAt - now) / (24 * 60 * 60 * 1000))) : 0;

  if (!isProActive && profile?.tier !== 'admin') {
    return {
      tier: 'free',
      dailyLimit: 0,
      usedToday: 0,
      remaining: 0,
      canGenerate: false,
      proDaysLeft: 0
    };
  }

  const todayKey = getTodayKeyIST();
  const usageKey = `${uid}_${todayKey}`;
  const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  const used = usageMap[usageKey] || 0;

  const dailyLimit = 100;
  const remaining = Math.max(0, dailyLimit - used);

  return {
    tier: 'pro',
    dailyLimit,
    usedToday: used,
    remaining,
    canGenerate: remaining > 0,
    proDaysLeft
  };
}
