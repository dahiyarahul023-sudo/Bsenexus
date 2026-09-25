import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { customFetch } from '../api';

export interface AiQuotaStatus {
  tier: 'guest' | 'free' | 'pro' | 'admin';
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  canGenerate: boolean;
  allowed: boolean;
  message?: string;
}

export interface QuotaConsumeResult {
  allowed: boolean;
  tier: 'guest' | 'free' | 'pro' | 'admin';
  dailyLimit: number;
  remaining: number;
}

const getTodayKey = (): string => {
  // Indian Standard Time (IST) date key
  const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export function updateServerAiQuota(
  data: { remainingQuota?: number; remaining?: number; dailyLimit?: number; isPro?: boolean }
) {
  if (!data) return;
  const remaining = typeof data.remainingQuota === 'number' ? data.remainingQuota : (typeof data.remaining === 'number' ? data.remaining : undefined);
  if (remaining === undefined) return;

  const todayStr = getTodayKey();
  try {
    const key = `bse_ai_server_remaining_${todayStr}`;
    localStorage.setItem(key, remaining.toString());
    if (typeof data.dailyLimit === 'number') {
      localStorage.setItem(`bse_ai_server_limit_${todayStr}`, data.dailyLimit.toString());
    }
    window.dispatchEvent(new CustomEvent('bse_ai_quota_changed', { detail: { remaining, dailyLimit: data.dailyLimit } }));
  } catch (e) {}
}

/**
 * Helper to parse and sync server response with quota information
 */
export function syncQuotaFromResponse(data: any) {
  if (!data) return;
  if (typeof data.remainingQuota === 'number' || typeof data.remaining === 'number') {
    updateServerAiQuota(data);
  }
}

/**
 * Asynchronously fetch live quota status from server
 */
export async function fetchServerAiQuota(): Promise<AiQuotaStatus | null> {
  try {
    const res = await customFetch('/api/billing/quota');
    if (res.ok) {
      const data = await res.json();
      if (typeof data.remaining === 'number') {
        updateServerAiQuota({ remainingQuota: data.remaining, dailyLimit: data.dailyLimit, isPro: data.tier === 'pro' || data.tier === 'admin' });
      }
      return {
        tier: data.tier || 'guest',
        dailyLimit: data.dailyLimit ?? 0,
        usedToday: data.usedToday ?? 0,
        remaining: data.remaining ?? 0,
        canGenerate: data.canGenerate ?? false,
        allowed: data.canGenerate ?? false,
        message: data.tier === 'admin'
          ? 'Unlimited AI Summaries (Admin Active)'
          : data.tier === 'pro'
          ? `${data.remaining ?? 100}/${data.dailyLimit ?? 100} AI summaries remaining today (1-Week Pro Trial)`
          : 'Google Sign-In Required for 1-Week Free Pro AI Access'
      };
    }
  } catch (e) {}
  return null;
}

export function getAiQuotaStatus(
  user?: any | null,
  profile?: UserProfile | null,
  isPro?: boolean,
  isAdmin?: boolean
): AiQuotaStatus {
  // 1. Admin has unlimited
  if (isAdmin || profile?.tier === 'admin') {
    return {
      tier: 'admin',
      dailyLimit: Infinity,
      usedToday: 0,
      remaining: Infinity,
      canGenerate: true,
      allowed: true,
      message: 'Unlimited AI Summaries (Admin Active)'
    };
  }

  // 2. Unauthenticated Guests / Anonymous Users: STRICTLY 0 QUOTA
  const isGuest = !user || user.isAnonymous || profile?.tier === 'guest';
  if (isGuest) {
    return {
      tier: 'guest',
      dailyLimit: 0,
      usedToday: 0,
      remaining: 0,
      canGenerate: false,
      allowed: false,
      message: 'Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro AI summaries!'
    };
  }

  // 3. User with active Pro Trial
  if (isPro) {
    const todayStr = getTodayKey();
    const defaultDailyLimit = 100;
    let remaining = defaultDailyLimit;
    let dailyLimit = defaultDailyLimit;

    try {
      const savedLimit = localStorage.getItem(`bse_ai_server_limit_${todayStr}`);
      if (savedLimit) {
        dailyLimit = parseInt(savedLimit, 10) || defaultDailyLimit;
      }
      const savedRemaining = localStorage.getItem(`bse_ai_server_remaining_${todayStr}`);
      if (savedRemaining !== null) {
        remaining = parseInt(savedRemaining, 10);
        if (isNaN(remaining)) remaining = defaultDailyLimit;
      }
    } catch (e) {
      remaining = defaultDailyLimit;
    }

    remaining = Math.max(0, remaining);
    const usedToday = Math.max(0, dailyLimit - remaining);
    const canGenerate = remaining > 0;

    return {
      tier: 'pro',
      dailyLimit,
      usedToday,
      remaining,
      canGenerate,
      allowed: canGenerate,
      message: canGenerate
        ? `${remaining}/${dailyLimit} AI summaries remaining today (1-Week Pro Trial)`
        : 'Daily Pro trial limit reached (100/100 used). Resets at 00:00 IST.'
    };
  }

  // 4. Authenticated user whose 1-week trial has expired
  return {
    tier: 'free',
    dailyLimit: 0,
    usedToday: 0,
    remaining: 0,
    canGenerate: false,
    allowed: false,
    message: 'Your 1-Week Free Pro trial has ended. Upgrade to Pro (₹499/mo) for unlimited AI summaries.'
  };
}

/**
 * Legacy wrapper: does NOT decrement local quota before request.
 * Server is the single source of truth and only consumes quota upon successful generation.
 */
export function consumeAiQuota(
  user?: any | null,
  profile?: UserProfile | null,
  isPro?: boolean,
  isAdmin?: boolean
): QuotaConsumeResult {
  const currentStatus = getAiQuotaStatus(user, profile, isPro, isAdmin);
  return {
    allowed: currentStatus.canGenerate,
    tier: currentStatus.tier,
    dailyLimit: currentStatus.dailyLimit,
    remaining: currentStatus.remaining
  };
}

/**
 * React hook to reactively subscribe to AI quota changes
 */
export function useAiQuota(
  user?: any | null,
  profile?: UserProfile | null,
  isPro?: boolean,
  isAdmin?: boolean
): AiQuotaStatus {
  const [quota, setQuota] = useState<AiQuotaStatus>(() => getAiQuotaStatus(user, profile, isPro, isAdmin));

  useEffect(() => {
    const handleUpdate = () => {
      setQuota(getAiQuotaStatus(user, profile, isPro, isAdmin));
    };

    handleUpdate();
    window.addEventListener('bse_ai_quota_changed', handleUpdate);

    // Sync live quota from server
    fetchServerAiQuota().then(serverStatus => {
      if (serverStatus) {
        setQuota(getAiQuotaStatus(user, profile, isPro, isAdmin));
      }
    }).catch(() => {});

    return () => {
      window.removeEventListener('bse_ai_quota_changed', handleUpdate);
    };
  }, [user, profile, isPro, isAdmin]);

  return quota;
}
