/**
 * Pure alert-decision helpers (dependency-free so unit tests can import them
 * without pulling in env-gated server modules like firebase).
 *
 * The alert pipeline has two independent Telegram paths — the filing monitor
 * and the 24/7 news worker — and both must honour the same contract:
 *
 * 1. The master `telegramAlertsEnabled` toggle is a KILL-SWITCH. When it is
 *    false, no bot-initiated Telegram message may go to that user, no matter
 *    which sub-feature (filing alerts, AI summaries, news digests) matched.
 * 2. Telegram fires only on telegram-ELIGIBLE matches: the user's own filter
 *    rules, or an alert rule whose telegram channel is ON. An in-app-only
 *    rule match (e.g. the system buyback preset: ALL_STOCKS scope, telegram
 *    off) must never produce a Telegram message.
 * 3. Missing preferences fail CLOSED (WATCHLIST_ONLY semantics), never
 *    "match everything".
 */

export interface AnnouncementPriority {
  level: string;
  category: string;
}

export function doesAnnouncementMatchUserPrefs(
  prefs: any,
  priority: AnnouncementPriority,
  stockPriority: 'HIGH' | 'MEDIUM' | 'LOW' | null,
  subject: string,
  details: string,
  isWatchlistMatch: boolean = false
): boolean {
  // Fail-closed: no saved prefs => behave like defaults (WATCHLIST_ONLY),
  // never "match everything".
  if (!prefs) prefs = {};

  // 1. Alert Scope Filter (Watchlist Only vs All Market)
  const effectiveScope = prefs.telegramAlertScope || prefs.alertScope || 'WATCHLIST_ONLY';
  if (effectiveScope === 'WATCHLIST_ONLY' && !isWatchlistMatch) {
    return false;
  }

  // 2. Alert Priority Filter
  if (prefs.alertPriority === 'HIGH_ONLY' && priority.level !== 'HIGH' && stockPriority !== 'HIGH') {
    return false;
  }
  if (prefs.alertPriority === 'HIGH_MEDIUM') {
    const isHighOrMed = (priority.level === 'HIGH' || priority.level === 'MEDIUM' || stockPriority === 'HIGH' || stockPriority === 'MEDIUM');
    if (!isHighOrMed) {
      return false;
    }
  }

  // 3. Alert Category Filter
  if (prefs.alertCategory === 'RESULTS_ONLY' && priority.category !== 'RESULTS') {
    return false;
  }
  if (prefs.alertCategory === 'RESULTS_AND_CONCALLS' && priority.category !== 'RESULTS' && priority.category !== 'CONFERENCE_CALL') {
    return false;
  }
  if (prefs.alertCategory === 'RESULTS_AND_MATERIAL' && priority.category !== 'RESULTS' && priority.category !== 'CONFERENCE_CALL' && priority.category !== 'MATERIAL_EVENT' && !isWatchlistMatch) {
    return false;
  }

  // 4. Stock priority check if it matched a watchlist item
  // LOW priority stocks are strictly muted by default from Telegram alerts
  if (stockPriority === 'LOW' && prefs.stocksLowPriority !== true) return false;
  if (stockPriority === 'HIGH' && prefs.stocksHighPriority === false) return false;
  if (stockPriority === 'MEDIUM' && prefs.stocksMediumPriority === false) return false;

  const text = (subject + " " + details).toUpperCase();

  // 5. Specific category toggles
  if (priority.category === 'RESULTS' && prefs.resultsAndEarnings === false) return false;
  if (priority.category === 'CONFERENCE_CALL' && prefs.concallsAndInvestorMeets === false) return false;

  if (text.includes('DIVIDEND') || text.includes('BONUS') || text.includes('BUYBACK')) {
    if (prefs.dividendsAndBonus === false) return false;
  }

  if (text.includes('ORDER') || text.includes('CAPEX') || text.includes('EXPANSION')) {
    if (prefs.orderWinsAndExpansion === false) return false;
  }

  if (text.includes('ACQUISITION') || text.includes('MERGER') || text.includes('TAKEOVER')) {
    if (prefs.acquisitionsAndMergers === false) return false;
  }

  if (text.includes('CREDIT RATING') || text.includes('CRISIL') || text.includes('ICRA') || text.includes('CARE')) {
    if (prefs.creditRatingChanges === false) return false;
  }

  if (text.includes('INSIDER') || text.includes('SAST') || text.includes('PIT')) {
    if (prefs.insiderTradingAndSAST === false) return false;
  }

  if (text.includes('ANNUAL REPORT') || text.includes('SECRETARIAL AUDIT')) {
    if (prefs.annualReportsAndAudits === false) return false;
  }

  if (prefs.muteRoutineFilings && (text.includes('LOSS OF SHARE') || text.includes('TRADING WINDOW') || text.includes('NEWSPAPER PUBLICATION') || text.includes('SCRUTINIZER'))) {
    return false;
  }

  return true;
}

/**
 * Is this announcement eligible for a Telegram message to this user?
 * prefsMatch: the user's own filter rules matched.
 * ruleShouldSendTelegram: a custom/system alert rule with telegram channel ON matched.
 * An in-app-only rule match must NOT make it eligible.
 */
export function isTelegramEligible(prefsMatch: boolean, ruleShouldSendTelegram: boolean): boolean {
  return prefsMatch || ruleShouldSendTelegram;
}

export interface TelegramEnablePatch {
  telegramChatId?: string | null;
  telegramAlertsEnabled?: boolean;
  telegramAiSummaryEnabled?: boolean;
  telegramAlertScope?: string;
  telegramNewsAlerts?: boolean;
}

/**
 * Does this profile patch attempt to LINK or ENABLE Telegram relative to the
 * existing profile? Change-based so that language-only saves (which echo the
 * current prefs) don't trip the Pro gate. Unlinking (null chat id) never
 * counts. Turning alerts OFF is always allowed — the gate only guards
 * turning them ON, so a user can always stop alerts.
 */
export function wantsTelegramEnable(patch: TelegramEnablePatch, existingProfile: any): boolean {
  const chatId = patch.telegramChatId;
  if (typeof chatId === 'string' && chatId.trim().length > 0) return true; // linking a chat id
  const cur = existingProfile?.notificationPreferences || {};
  // Only a false -> true flip counts as "enabling".
  if (patch.telegramAlertsEnabled === true && cur.telegramAlertsEnabled !== true) return true;
  if (patch.telegramAiSummaryEnabled === true && cur.telegramAiSummaryEnabled !== true) return true;
  if (patch.telegramAlertScope !== undefined && patch.telegramAlertScope !== cur.telegramAlertScope) return true;
  if (patch.telegramNewsAlerts === true && cur.telegramNewsAlerts !== true) return true;
  return false;
}
