import { adminDb } from './firebase.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isOfflineOrNetworkError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied } from './localStore.js';
import { withRetry } from '../utils/retry.js';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  category: 'ALL' | 'RESULTS' | 'DIVIDEND' | 'BUYBACK' | 'BONUS_SPLIT' | 'ORDER_WIN' | 'BOARD_MEETING' | 'GOVERNANCE';
  priority: 'ALL' | 'HIGH_ONLY' | 'MEDIUM_HIGH';
  scope: 'ALL_STOCKS' | 'WATCHLIST_ONLY' | 'SPECIFIC_SYMBOLS';
  symbols: string[]; // e.g. ["ASHOKLEY", "TCS"]
  keywords: string[]; // e.g. ["dividend", "acquisition", "bonus"]
  excludeKeywords: string[];
  channels: {
    inApp: boolean;
    telegram: boolean;
  };
  userId: string;
  createdAt: number;
}

const ALERT_RULES_FILE = 'alert_rules.json';

const DEFAULT_PRESET_RULES: AlertRule[] = [
  {
    id: 'preset_results',
    name: 'Quarterly & Annual Financial Results',
    description: 'Instant notification on audited/unaudited quarterly financial result filings',
    enabled: true,
    category: 'RESULTS',
    priority: 'HIGH_ONLY',
    scope: 'WATCHLIST_ONLY',
    symbols: [],
    keywords: ['financial result', 'audited', 'unaudited', 'quarterly result'],
    excludeKeywords: ['newspaper publication'],
    channels: { inApp: true, telegram: true },
    userId: 'system',
    createdAt: Date.now()
  },
  {
    id: 'preset_dividends',
    name: 'Dividends, Bonus & Stock Splits',
    description: 'Detects interim/final dividends, bonus issues, and share splits',
    enabled: true,
    category: 'DIVIDEND',
    priority: 'HIGH_ONLY',
    scope: 'WATCHLIST_ONLY',
    symbols: [],
    keywords: ['dividend', 'bonus', 'split', 'sub-division', 'record date'],
    excludeKeywords: [],
    channels: { inApp: true, telegram: true },
    userId: 'system',
    createdAt: Date.now()
  },
  {
    id: 'preset_buybacks',
    name: 'Share Buybacks & Open Offers',
    description: 'Capital restructuring, buyback proposals, tender offers & acceptances',
    enabled: true,
    category: 'BUYBACK',
    priority: 'HIGH_ONLY',
    scope: 'ALL_STOCKS',
    symbols: [],
    keywords: ['buyback', 'buy-back', 'open offer', 'delisting', 'tender offer'],
    excludeKeywords: [],
    channels: { inApp: true, telegram: false },
    userId: 'system',
    createdAt: Date.now()
  },
  {
    id: 'preset_order_wins',
    name: 'Major Order Wins & Commercial Contracts',
    description: 'Significant commercial orders, contracts, tenders, and agreements',
    enabled: true,
    category: 'ORDER_WIN',
    priority: 'MEDIUM_HIGH',
    scope: 'WATCHLIST_ONLY',
    symbols: [],
    keywords: ['order win', 'bagged order', 'contract', 'agreement', 'commercial pact', 'work order'],
    excludeKeywords: [],
    channels: { inApp: true, telegram: true },
    userId: 'system',
    createdAt: Date.now()
  }
];

let rulesCache: AlertRule[] = readLocalJson<AlertRule[]>(ALERT_RULES_FILE, DEFAULT_PRESET_RULES);

if (rulesCache.length === 0) {
  rulesCache = [...DEFAULT_PRESET_RULES];
  writeLocalJson(ALERT_RULES_FILE, rulesCache);
}

// Initial background sync to restore custom rules from Firestore
export async function initAlertRulesFromFirestore(): Promise<void> {
  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) return;
  try {
    const snap = await adminDb.collection('alert_rules').get();
    let added = 0;
    snap.forEach(docSnap => {
      const cloudRule = docSnap.data() as AlertRule;
      if (cloudRule && cloudRule.id) {
        const idx = rulesCache.findIndex(r => r.id === cloudRule.id);
        if (idx >= 0) {
          rulesCache[idx] = { ...rulesCache[idx], ...cloudRule };
        } else {
          rulesCache.push(cloudRule);
          added++;
        }
      }
    });
    if (added > 0) {
      writeLocalJson(ALERT_RULES_FILE, rulesCache);
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    } else if (!isOfflineOrNetworkError(err)) {
      console.warn('[AlertRulesDao] Cloud sync notice:', err?.message || err);
    }
  }
}
setTimeout(() => {
  initAlertRulesFromFirestore().catch(() => {});
}, 3000);

export function getAllAlertRules(userId: string = 'guest'): AlertRule[] {
  return rulesCache.filter(r => r.userId === 'system' || (userId !== 'guest' && r.userId === userId));
}

async function persistRuleToCloud(rule: AlertRule): Promise<void> {
  if (rule.userId === 'system' || isFirestoreQuotaExceeded() || isAdminPermissionDenied()) return;
  try {
    await withRetry(async () => {
      await adminDb.collection('alert_rules').doc(rule.id).set(rule, { merge: true });
    }, { maxRetries: 1 });
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
  }
}

async function removeRuleFromCloud(ruleId: string): Promise<void> {
  if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) return;
  try {
    await withRetry(async () => {
      await adminDb.collection('alert_rules').doc(ruleId).delete();
    }, { maxRetries: 1 });
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    } else if (isPermissionDeniedError(err)) {
      setAdminPermissionDenied(true);
    }
  }
}

export function saveAlertRule(rule: Partial<AlertRule> & { name: string }, userId: string = 'guest'): AlertRule {
  const id = rule.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const existingIdx = rulesCache.findIndex(r => r.id === id);

  // If modifying existing rule, enforce ownership (cannot overwrite other users or system rules)
  if (existingIdx >= 0) {
    const existing = rulesCache[existingIdx];
    if (existing.userId === 'system' || (existing.userId !== userId && userId !== 'admin')) {
      throw new Error("Cannot modify system or another user's alert rule");
    }
  }

  const fullRule: AlertRule = {
    id,
    name: String(rule.name).slice(0, 100),
    description: rule.description ? String(rule.description).slice(0, 500) : '',
    enabled: rule.enabled !== undefined ? Boolean(rule.enabled) : true,
    category: rule.category || 'ALL',
    priority: rule.priority || 'HIGH_ONLY',
    scope: rule.scope || 'WATCHLIST_ONLY',
    symbols: Array.isArray(rule.symbols) ? rule.symbols.map(s => String(s).toUpperCase().slice(0, 30)) : [],
    keywords: Array.isArray(rule.keywords) ? rule.keywords.map(k => String(k).slice(0, 50)) : [],
    excludeKeywords: Array.isArray(rule.excludeKeywords) ? rule.excludeKeywords.map(k => String(k).slice(0, 50)) : [],
    channels: rule.channels || { inApp: true, telegram: true },
    userId: userId, // enforce authenticated user ID
    createdAt: rule.createdAt || Date.now()
  };

  if (existingIdx >= 0) {
    rulesCache[existingIdx] = fullRule;
  } else {
    rulesCache.push(fullRule);
  }

  writeLocalJson(ALERT_RULES_FILE, rulesCache);
  persistRuleToCloud(fullRule).catch(() => {});
  return fullRule;
}

export function toggleAlertRule(id: string, enabled: boolean, userId: string = 'guest'): boolean {
  const rule = rulesCache.find(r => r.id === id);
  if (rule) {
    // Only owner or admin can toggle
    if (rule.userId !== 'system' && rule.userId !== userId && userId !== 'admin') {
      return false;
    }
    rule.enabled = enabled;
    writeLocalJson(ALERT_RULES_FILE, rulesCache);
    persistRuleToCloud(rule).catch(() => {});
    return true;
  }
  return false;
}

export function deleteAlertRule(id: string, userId: string = 'guest'): boolean {
  const rule = rulesCache.find(r => r.id === id);
  if (!rule) return false;
  // System rules cannot be deleted; user can only delete their own rules
  if (rule.userId === 'system') return false;
  if (rule.userId !== userId && userId !== 'admin') return false;

  const prevLen = rulesCache.length;
  rulesCache = rulesCache.filter(r => r.id !== id);
  if (rulesCache.length !== prevLen) {
    writeLocalJson(ALERT_RULES_FILE, rulesCache);
    removeRuleFromCloud(id).catch(() => {});
    return true;
  }
  return false;
}

export function evaluateAlertRulesForUser(
  announcement: {
    companyName?: string;
    symbol?: string;
    scripCode?: string;
    subject?: string;
    details?: string;
    category?: string;
    priority?: string;
    isWatchlist?: boolean;
  },
  userId: string = 'system'
): { matchedRules: AlertRule[]; shouldSendInApp: boolean; shouldSendTelegram: boolean } {
  // Only evaluate system preset rules + this specific user's custom alert rules
  const activeRules = rulesCache.filter(r => r.enabled && (r.userId === 'system' || r.userId === userId));
  const matchedRules: AlertRule[] = [];
  let shouldSendInApp = false;
  let shouldSendTelegram = false;

  const combinedText = `${announcement.subject || ''} ${announcement.details || ''} ${announcement.companyName || ''}`.toLowerCase();
  const annSym = (announcement.symbol || '').toUpperCase();
  const annScrip = String(announcement.scripCode || '');
  const annCat = (announcement.category || '').toUpperCase();
  const annPrio = (announcement.priority || 'LOW').toUpperCase();

  for (const rule of activeRules) {
    // 1. Check Scope
    if (rule.scope === 'WATCHLIST_ONLY' && !announcement.isWatchlist) {
      continue;
    }
    if (rule.scope === 'SPECIFIC_SYMBOLS') {
      const match = rule.symbols.some(s => s.toUpperCase() === annSym || s === annScrip);
      if (!match) continue;
    }

    // 2. Check Category
    if (rule.category !== 'ALL') {
      if (rule.category === 'RESULTS' && !/financial result|audited|unaudited|quarterly result|board meeting outcome/i.test(combinedText)) {
        continue;
      }
      if (rule.category === 'DIVIDEND' && !/dividend|bonus|split|sub-division/i.test(combinedText)) {
        continue;
      }
      if (rule.category === 'BUYBACK' && !/buyback|buy-back|open offer/i.test(combinedText)) {
        continue;
      }
      if (rule.category === 'ORDER_WIN' && !/order|contract|agreement|award|pact|bagged/i.test(combinedText)) {
        continue;
      }
      if (rule.category === 'BOARD_MEETING' && !/board meeting|intimation of board/i.test(combinedText)) {
        continue;
      }
    }

    // 3. Check Priority
    if (rule.priority === 'HIGH_ONLY' && annPrio !== 'HIGH') {
      continue;
    }
    if (rule.priority === 'MEDIUM_HIGH' && annPrio !== 'HIGH' && annPrio !== 'MEDIUM') {
      continue;
    }

    // 4. Check Exclude Keywords
    if (rule.excludeKeywords && rule.excludeKeywords.length > 0) {
      const hasExcluded = rule.excludeKeywords.some(kw => kw && combinedText.includes(kw.toLowerCase()));
      if (hasExcluded) continue;
    }

    // 5. Check Include Keywords (if defined)
    if (rule.keywords && rule.keywords.length > 0) {
      const hasKeyword = rule.keywords.some(kw => kw && combinedText.includes(kw.toLowerCase()));
      if (!hasKeyword) continue;
    }

    // Match found!
    matchedRules.push(rule);
    if (rule.channels?.inApp) shouldSendInApp = true;
    if (rule.channels?.telegram) shouldSendTelegram = true;
  }

  return { matchedRules, shouldSendInApp, shouldSendTelegram };
}

export function evaluateAlertRules(announcement: {
  companyName?: string;
  symbol?: string;
  scripCode?: string;
  subject?: string;
  details?: string;
  category?: string;
  priority?: string;
  isWatchlist?: boolean;
}): { matchedRules: AlertRule[]; shouldSendInApp: boolean; shouldSendTelegram: boolean } {
  return evaluateAlertRulesForUser(announcement, 'system');
}
