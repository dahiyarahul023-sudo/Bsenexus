import { getSettings } from '../database/settingsDao.js';
import { addLog } from '../database/logDao.js';
import { fetchBSEAnnouncements, getLastBseError } from './bse.js';
import { sendToTelegram } from './telegram.js';
import { generateAndSendSummary } from './gemini.js';
import { getActiveWatchlistSymbols, getActiveWatchlistSymbolMap } from '../database/watchlistDao.js';
import { getAllUserProfiles } from '../database/usersDao.js';
import { isAnnouncementProcessed, isAnnouncementSent, markAnnouncementSent, saveAnnouncement, pruneAndCheckStorageCapacity, initAnnouncementCache } from '../database/announcementDao.js';
import { escapeHTML, determinePriority, isSymbolMatch, parseBseDate, isMarketHoursIST } from '../utils/helpers.js';
import { addNotification, initNotificationsFromFirestore } from '../database/notificationDao.js';
import { evaluateAlertRulesForUser } from '../database/alertRulesDao.js';
import { classifyMaterialEvent } from './timelineClassifier.js';
import { doesAnnouncementMatchUserPrefs, isTelegramEligible } from '../utils/alertDecision.js';

export { pruneAndCheckStorageCapacity };

let consecutiveFailures = 0;
let isBseOutageActive = false;
let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;
// Startup grace: after a (re)deploy the cold boot fires a burst of BSE requests
// (10-page backfill + parallel syncs) that can trip Akamai rate-limiting for a
// few minutes. Never send the outage Telegram alert during this window — the
// feed genuinely failing AFTER the grace period still alerts normally.
const PROCESS_BOOT_MS = Date.now();
const OUTAGE_ALERT_STARTUP_GRACE_MS = 10 * 60 * 1000;

export function getConsecutiveFailures(): number {
  return consecutiveFailures;
}

let isPolling = false;
let isCacheInitialized = false;

// Per-User Watchlist Cache with 10-minute TTL to drastically reduce Firestore read volume
// Per-user watchlist snapshot for the monitor loop. Kept SHORT (60s, same as
// the main config cache): a stock deleted from a watchlist must stop matching
// for Telegram within a minute, even on a Cloud Run instance that did not
// handle the delete request (in-memory invalidation is per-instance only).
const USER_WATCHLIST_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const monitorUserWatchlistCache = new Map<string, { symbols: string[]; map: any; fetchedAt: number }>();
// Uids already warned about personal-chat == admin-channel overlap (once per process).
const warnedAdminOverlap = new Set<string>();

// In-Memory Configuration Cache with ~60s TTL to prevent repeated DB lookups on 15s critical loop
let configCache: {
  settings: any;
  activeSymbols: string[];
  activeSymbolMap: any;
  allUsers: any[];
  userWatchlistCache: Map<string, { symbols: string[]; map: any }>;
  lastFetched: number;
} | null = null;

export function invalidateMonitorConfigCache(userId?: string) {
  configCache = null;
  if (userId) {
    monitorUserWatchlistCache.delete(userId);
  } else {
    monitorUserWatchlistCache.clear();
  }
}

async function getCachedMonitorConfig() {
  const now = Date.now();
  if (configCache && (now - configCache.lastFetched < 60000)) {
    return configCache;
  }

  // 1. Fetch settings, global active symbols, and ALL user profiles.
  // In-app notifications must work for every user — NOT only those with a
  // linked Telegram chat ID. Telegram dispatch stays gated on chat ID
  // separately in the per-user loop below.
  // noCreate: the scan is read-only — it must never manufacture default
  // watchlists (71 starter stocks) for users as a side effect.
  const [settings, activeSymbols, activeSymbolMap, allProfiles] = await Promise.all([
    getSettings(),
    getActiveWatchlistSymbols('all', { noCreate: true }),
    getActiveWatchlistSymbolMap('all', { noCreate: true }),
    getAllUserProfiles()
  ]);

  const notifyUsers = (allProfiles || []).filter(u => u && u.uid && u.uid !== 'guest');

  const userWatchlistCache = new Map<string, { symbols: string[]; map: any }>();
  if (notifyUsers.length > 0) {
    await Promise.all(
      notifyUsers.map(async (u) => {
        const cached = monitorUserWatchlistCache.get(u.uid);
        if (cached && (now - cached.fetchedAt < USER_WATCHLIST_CACHE_TTL_MS)) {
          userWatchlistCache.set(u.uid, { symbols: cached.symbols, map: cached.map });
        } else {
          const [symbols, map] = await Promise.all([
            getActiveWatchlistSymbols(u.uid, { noCreate: true }),
            getActiveWatchlistSymbolMap(u.uid, { noCreate: true })
          ]);
          monitorUserWatchlistCache.set(u.uid, { symbols, map, fetchedAt: now });
          userWatchlistCache.set(u.uid, { symbols, map });
        }
      })
    );
  }

  configCache = {
    settings,
    activeSymbols,
    activeSymbolMap,
    allUsers: notifyUsers,
    userWatchlistCache,
    lastFetched: now
  };
  return configCache;
}

export async function processAnnouncements() {
  if (isPolling) return;
  isPolling = true;
  try {
    if (!isCacheInitialized) {
      await initAnnouncementCache();
      // Restore in-app notifications from Firestore in the background (never blocks polling)
      initNotificationsFromFirestore().catch(() => {});
      isCacheInitialized = true;
    }

    const announcements = await fetchBSEAnnouncements();
    
    if (!announcements) {
      consecutiveFailures++;
      // Fire outage alert ONLY when all tiers fail for 6 consecutive cycles and cooldown has elapsed.
      // Suppressed during the post-boot grace window: a fresh deploy's cold-start burst can fail
      // transiently (Akamai rate-limit) without the feed being genuinely down.
      const pastStartupGrace = (Date.now() - PROCESS_BOOT_MS) > OUTAGE_ALERT_STARTUP_GRACE_MS;
      const canAlert = ((lastAlertTime === 0) || (Date.now() - lastAlertTime > ALERT_COOLDOWN_MS)) && pastStartupGrace;
      if (consecutiveFailures >= 6 && !isBseOutageActive && canAlert) {
        const settings = await getSettings();
        if (settings.botToken && settings.chatId) {
          isBseOutageActive = true;
          lastAlertTime = Date.now();
          const errDetail = getLastBseError();
          const alertMsg = `⚠️ <b>BSE Nexus System Alert</b>\n\nUnable to fetch live feed from BSE India (${errDetail}). Both primary and backup endpoints failed.\n\n<b>Diagnostics:</b>\n• Exchange API unreachable or cloud IP filtered.\n• Exponential backoff retries active.\n• Recovery notification will be sent automatically upon reconnection.\n\n<i>No further outage alerts will be sent during this episode.</i>`;
          await sendToTelegram(alertMsg);
          await addLog('CRITICAL', 'SYSTEM', `Sent BSE Outage Alert to Telegram: ${errDetail}`);
        }
      }
      return;
    }
    
    // If the feed was previously in an outage state, send one recovery notice!
    if (isBseOutageActive) {
      isBseOutageActive = false;
      const settings = await getSettings();
      if (settings.botToken && settings.chatId) {
        const isMarket = isMarketHoursIST();
        const recoveryMsg = `✅ <b>BSE Live Feed Restored</b>\n\nLive corporate filings feed has successfully reconnected to BSE India. Normal ${isMarket ? 'Live (20s)' : 'Relaxed (5m)'} polling resumed.`;
        await sendToTelegram(recoveryMsg);
        await addLog('INFO', 'SYSTEM', 'Sent BSE Feed Recovery Notice to Telegram');
      }
    }

    consecutiveFailures = 0;

    // Instant in-memory configuration read (~60s TTL) - Zero DB latency on critical path
    const { settings, activeSymbols, activeSymbolMap, allUsers, userWatchlistCache } = await getCachedMonitorConfig();
    
    // Pass 1: Find pending items (all unprocessed items in batch)
    const pendingAnnouncements = [];
    
    for (const item of announcements) {
      const newsId = item.NEWSID;
      if (!newsId) continue;
      if (!(await isAnnouncementProcessed(newsId))) {
        pendingAnnouncements.push(item);
      }
    }

    if (pendingAnnouncements.length > 0) {
      addLog('INFO', 'MONITOR', `Found ${pendingAnnouncements.length} new announcements to process`);
    }

    // Sort pending announcements: Watchlist matches & HIGH priority first, then others
    const prioritizedPending = pendingAnnouncements.slice().sort((a, b) => {
      const compA = a.SLONGNAME || a.scrip_cd || "";
      const subA = a.NEWSSUB || "";
      const scripA = String(a.SCRIP_CD || a.scrip_cd || "");
      const isWlA = activeSymbols.some(kw => isSymbolMatch(compA, subA, kw, scripA));

      const compB = b.SLONGNAME || b.scrip_cd || "";
      const subB = b.NEWSSUB || "";
      const scripB = String(b.SCRIP_CD || b.scrip_cd || "");
      const isWlB = activeSymbols.some(kw => isSymbolMatch(compB, subB, kw, scripB));

      if (isWlA && !isWlB) return -1;
      if (!isWlA && isWlB) return 1;
      return 0;
    });

    // Pass 2: Process them with Watchlist items at the top of the queue
    for (const item of prioritizedPending) {
      try {
        const newsId = item.NEWSID;
        
        const companyName = item.SLONGNAME || item.scrip_cd || "Unknown Company";
        const subject = item.NEWSSUB || "No Subject";
        const details = item.HEADLINE || "";
        
        let shouldSendAdminTelegram = true;

        // 0. Strict Live Real-Time Age Check & Ingestion Delay Telemetry
        const bseTimeStr = item.News_submission_dt || item.DT_TM || item.NEWS_DT || "";
        const itemTs = parseBseDate(bseTimeStr);
        const now = Date.now();
        const ingestLagSec = itemTs > 0 ? Math.max(0, Math.round((now - itemTs) / 1000)) : 0;
        const sourceName = item._source || 'BSE_PRIMARY';

        // Ingest telemetry logging
        if (itemTs > 0) {
          const ageHours = (now - itemTs) / (1000 * 60 * 60);
          
          if (ingestLagSec > 90) {
            // Diagnostic logging for filings that exceed the 90s delay threshold
            addLog('WARNING', 'DELAY_DIAGNOSTIC', `Filing latency alert: ${companyName} (${newsId}) took ${ingestLagSec}s to reach platform. BSE Time: ${bseTimeStr} | Source: ${sourceName} | Fetch Latency: ${item._fetchLatency || 0}ms.`);
          }

          // If older than 2 hours or in the future by > 5 min, do not send to Telegram
          if (ageHours > 2 || ageHours < -0.1) {
            shouldSendAdminTelegram = false;
          }
        } else {
          shouldSendAdminTelegram = false;
        }

        // 1. Exclude Keywords Check (Spam Filter) - ONLY if filter is enabled in settings
        if (settings.isFilterEnabled && settings.excludeKeywords && settings.excludeKeywords.trim() !== '') {
          const keywords = settings.excludeKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
          const contentToSearch = `${subject} ${details}`;
          
          for (const kw of keywords) {
            const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
            if (regex.test(contentToSearch)) {
              shouldSendAdminTelegram = false;
              break;
            }
          }
        }

        // 2. Watchlist Check & Priority Determination
        const priority = determinePriority(subject, details);
        const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : '';
        const scrip_cd = String(item.SCRIP_CD || item.scrip_cd || item.Scrip_Code || item.SCRIPCODE || "").trim();

        let isWatchlistMatch = false;
        let matchedStockPriority: 'HIGH' | 'MEDIUM' | 'LOW' | null = null;

        for (const kw of activeSymbols) {
          if (isSymbolMatch(companyName, subject, kw, scrip_cd)) {
            isWatchlistMatch = true;
            matchedStockPriority = activeSymbolMap[kw]?.priority || 'HIGH';
            break;
          }
        }

        // 3. Telegram Priority & Category & Scope Filters for Admin/Root channel
        const alertPrioritySetting = settings.telegramAlertPriority || 'HIGH_ONLY';
        const alertCategorySetting = settings.telegramAlertCategory || 'RESULTS_ONLY';
        const isWatchlistOnly = settings.telegramWatchlistOnly !== false;

        // Check Watchlist Scope for Admin
        if (isWatchlistOnly && !isWatchlistMatch) {
          shouldSendAdminTelegram = false;
        }

        // Check Priority Level for Admin (LOW priority watchlist stocks are strictly muted)
        if (matchedStockPriority === 'LOW') {
          shouldSendAdminTelegram = false;
        } else if (alertPrioritySetting === 'HIGH_ONLY' && priority.level !== 'HIGH' && matchedStockPriority !== 'HIGH') {
          shouldSendAdminTelegram = false;
        } else if (alertPrioritySetting === 'HIGH_MEDIUM') {
          const isHighOrMed = (priority.level === 'HIGH' || priority.level === 'MEDIUM' || matchedStockPriority === 'HIGH' || matchedStockPriority === 'MEDIUM');
          if (!isHighOrMed) {
            shouldSendAdminTelegram = false;
          }
        }

        // Check Event Category Filter for Admin
        if (alertCategorySetting === 'RESULTS_ONLY' && priority.category !== 'RESULTS') {
          shouldSendAdminTelegram = false;
        } else if (alertCategorySetting === 'RESULTS_AND_CONCALLS' && priority.category !== 'RESULTS' && priority.category !== 'CONFERENCE_CALL') {
          shouldSendAdminTelegram = false;
        } else if (alertCategorySetting === 'RESULTS_AND_MATERIAL' && priority.category !== 'RESULTS' && priority.category !== 'CONFERENCE_CALL' && priority.category !== 'MATERIAL_EVENT' && !isWatchlistMatch) {
          shouldSendAdminTelegram = false;
        }

        // Double check against duplicate Telegram alert storms on service restart or cache clear
        const alreadySent = await isAnnouncementSent(newsId);
        if (alreadySent) {
          shouldSendAdminTelegram = false;
        }

        // ALWAYS save to DB and in-memory cache so website UI shows it in real-time
        try {
          await saveAnnouncement({
            newsId, companyName, subject, details, pdfLink, scrip_cd,
            bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
            priority: priority.level,
            category: priority.category,
            isWatchlist: isWatchlistMatch
          });
        } catch (e: any) {
          console.error("saveAnnouncement error:", e?.message || e);
        }

        // Evaluate Advanced Alert Rules for System & Admin
        const ruleEval = evaluateAlertRulesForUser({
          companyName,
          symbol: companyName,
          scripCode: scrip_cd,
          subject,
          details,
          category: priority.category,
          priority: priority.level,
          isWatchlist: isWatchlistMatch
        }, 'system');

        // Classify Material Event if applicable
        const materialEvt = classifyMaterialEvent({
          id: newsId,
          subject,
          details,
          companyName,
          scrip_cd,
          bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
          pdfLink
        });

        // Add In-App Notification ONLY if:
        // 1. In-app notifications are NOT muted in settings
        // 2. The stock is strictly in user's active Watchlist OR triggered by a custom Alert Rule
        const isNotifMuted = Boolean(settings.muteInAppNotifications);
        const shouldAddInAppNotif = !isNotifMuted && (isWatchlistMatch || (ruleEval && ruleEval.shouldSendInApp));

        if (shouldAddInAppNotif) {
          const notifType = materialEvt ? (materialEvt.eventType as any) : (priority.category === 'RESULTS' ? 'RESULT' : 'GENERAL');
          addNotification({
            id: `notif_${newsId}_sys`,
            userId: 'system',
            title: materialEvt ? materialEvt.title : `${companyName}: ${subject}`,
            message: subject,
            type: notifType,
            priority: (priority.level as any) || 'HIGH',
            symbol: companyName,
            scripCode: scrip_cd,
            newsId,
            pdfLink,
            timestamp: itemTs || Date.now(),
            isRead: false,
            isWatchlist: isWatchlistMatch
          });
        }

        // Build notification message text
        let message = ``;
        if (priority.category === 'RESULTS') {
          const isOutcome = /outcome/i.test(subject + ' ' + details);
          if (isOutcome) {
            message += `🔴 <b>HIGH PRIORITY</b>\n\n📊 <b>BOARD MEETING OUTCOME / RESULTS</b>\n\n`;
          } else {
            message += `🔴 <b>HIGH PRIORITY</b>\n\n📊 <b>FINANCIAL RESULTS</b>\n\n`;
          }
        } else if (priority.category === 'CONFERENCE_CALL') {
          message += `🔴 <b>HIGH PRIORITY</b>\n\n📞 <b>CONFERENCE CALL / INVESTOR MEET</b>\n\n`;
        } else {
          message += `${priority.icon} <b>${priority.level} IMPACT</b>\n\n`;
        }
        
        message += `🏢 <b>Company:</b> ${escapeHTML(companyName)}\n`;
        message += `📌 <b>Subject:</b> ${escapeHTML(subject)}\n\n`;
        
        let truncatedDetails = details;
        if (truncatedDetails.length > 3000) truncatedDetails = truncatedDetails.substring(0, 3000) + "...";
        if (priority.category !== 'RESULTS' && priority.category !== 'CONFERENCE_CALL' && details) {
            message += `📝 <b>Details:</b> ${escapeHTML(truncatedDetails)}\n`;
        }
        
        const safePdfUrl = (pdfLink && /^https?:\/\/[^\s"<>]+$/i.test(pdfLink.trim())) 
          ? pdfLink.trim().replace(/"/g, '%22') 
          : null;
        if (safePdfUrl) {
          message += `\n📎 <a href="${safePdfUrl}">Original BSE Filing</a>`;
        }

        // 1. Dispatch to Admin Telegram & Individual Pro/Registered Users (Asynchronous dispatch)
        const dispatchPromises: Promise<void>[] = [];
        const sentTelegramChatIds = new Set<string>();

        if (settings.isRunning && settings.botToken && settings.chatId && settings.telegramAlertsEnabled !== false && shouldSendAdminTelegram) {
          const adminChatId = String(settings.chatId).trim();
          sentTelegramChatIds.add(adminChatId);

          // Write-ahead persistence: mark is_sent flag FIRST before Telegram network dispatch
          markAnnouncementSent(newsId);

          dispatchPromises.push((async () => {
            try {
              const result = await sendToTelegram(message, adminChatId);
              if (result.success) {
                if (result.messageId) {
                  markAnnouncementSent(newsId, result.messageId);
                }
                addLog('SUCCESS', 'TELEGRAM', `Dispatched Admin ${priority.level} alert for ${companyName} (${priority.category})`);
                
                if (result.messageId && settings.telegramAiSummaryEnabled !== false) {
                  generateAndSendSummary(result.messageId, companyName, subject, details, priority.category, pdfLink, newsId, adminChatId)
                    .catch(e => addLog('ERROR', 'GEMINI', `[${companyName}] Summary dispatch exception: ${e.message}`));
                }
              } else {
                addLog('ERROR', 'TELEGRAM', `Failed to send alert for ${companyName}: ${result.error}`);
              }
            } catch (err: any) {
              addLog('ERROR', 'TELEGRAM', `Exception sending alert for ${companyName}: ${err.message}`);
            }
          })());
        }

        // 2. Dispatch to individual Pro/Registered Users (Strict Data Isolation & Per-User Filter Rules)
        // NOTE: in-app notifications are created for EVERY user with a matching
        // watchlist or custom alert rule — a linked Telegram chat ID is NOT required.
        // Only the Telegram dispatch below stays gated on rawUserChatId.
        if (settings.isRunning && allUsers.length > 0) {
          for (const u of allUsers) {
            const rawUserChatId = u.telegramChatId ? String(u.telegramChatId).trim() : '';

            // Fail-closed: a profile with no saved preferences behaves like
            // defaults (WATCHLIST_ONLY scope), never "match everything".
            const uPrefs = u.notificationPreferences || {};
            // Diagnostic: this user's personal chat IS the global admin channel.
            // The admin channel gets operational broadcasts (BSE outage,
            // calendar, storage, manual admin sends) independent of the
            // personal toggle — that is the expected explanation if such a
            // user reports "messages despite toggle OFF". Warn once.
            const adminChatIdNorm = settings.chatId ? String(settings.chatId).trim() : '';
            if (rawUserChatId && adminChatIdNorm && rawUserChatId === adminChatIdNorm
                && uPrefs.telegramAlertsEnabled === false && !warnedAdminOverlap.has(u.uid)) {
              warnedAdminOverlap.add(u.uid);
              console.warn(`[TELEGRAM] user ${u.uid}: personal chat == admin channel and personal toggle is OFF; admin-channel broadcasts will still reach this chat by design`);
            }
            // Telegram is a PRO-ONLY feature: skip dispatch when the user's
            // trial/pack has expired (in-app notifications above are unaffected).
            const userProActive = Boolean(u.tier === 'admin' || (u.proExpiresAt && u.proExpiresAt > Date.now()));
            // Respect user toggle to turn OFF/ON Telegram alerts
            const isUserTelegramActive = userProActive && uPrefs.telegramAlertsEnabled !== false;

            const cachedUserWl = userWatchlistCache.get(u.uid);
            const userSymbols = cachedUserWl?.symbols || [];
            const userSymbolMap = cachedUserWl?.map || {};

            // Check this specific user's active watchlist from memory cache
            let uWatchlistMatch = false;
            let uMatchedStockPriority: 'HIGH' | 'MEDIUM' | 'LOW' | null = null;

            for (const kw of userSymbols) {
              if (isSymbolMatch(companyName, subject, kw, scrip_cd)) {
                uWatchlistMatch = true;
                uMatchedStockPriority = userSymbolMap[kw]?.priority || 'HIGH';
                break;
              }
            }

            // Evaluate user custom alert rules (in-memory, cheap)
            const userRuleEval = evaluateAlertRulesForUser({
              companyName,
              symbol: companyName,
              scripCode: scrip_cd,
              subject,
              details,
              category: priority.category,
              priority: priority.level,
              isWatchlist: uWatchlistMatch
            }, u.uid);

            const effectiveScope = uPrefs?.telegramAlertScope || uPrefs?.alertScope || 'WATCHLIST_ONLY';
            // Skip alert processing entirely only when nothing could match:
            // empty watchlist + watchlist-only scope + no custom rule matched.
            if (userSymbols.length === 0 && effectiveScope === 'WATCHLIST_ONLY'
                && !userRuleEval.shouldSendInApp && !userRuleEval.shouldSendTelegram) {
              continue;
            }

            const prefsMatch = doesAnnouncementMatchUserPrefs(uPrefs, priority, uMatchedStockPriority, subject, details, uWatchlistMatch);
            // Telegram fires ONLY on telegram-eligible matches: the user's own
            // filter rules, or an alert rule whose telegram channel is ON.
            // An in-app-only rule match (e.g. the system buyback preset:
            // ALL_STOCKS scope, telegram off) must never trigger a Telegram
            // message for companies outside the user's watchlist.
            const telegramEligible = isTelegramEligible(prefsMatch, userRuleEval.shouldSendTelegram);
            const matchesUser = telegramEligible || userRuleEval.shouldSendInApp;
            
            const userNotifMuted = Boolean(u.muteInAppNotifications ?? uPrefs?.muteInAppNotifications);
            if (matchesUser) {
              if (!userNotifMuted && (uWatchlistMatch || userRuleEval.shouldSendInApp)) {
                const notifType = materialEvt ? (materialEvt.eventType as any) : (priority.category === 'RESULTS' ? 'RESULT' : (userRuleEval.shouldSendInApp ? 'RULE_MATCH' : 'GENERAL'));
                addNotification({
                  id: `notif_${newsId}_${u.uid}`,
                  userId: u.uid,
                  title: materialEvt ? materialEvt.title : `${companyName}: ${subject}`,
                  message: subject,
                  type: notifType,
                  priority: (priority.level as any) || 'HIGH',
                  symbol: companyName,
                  scripCode: scrip_cd,
                  newsId,
                  pdfLink,
                  timestamp: itemTs || Date.now(),
                  isRead: false,
                  isWatchlist: uWatchlistMatch
                });
              }

              // Deduplicate Telegram dispatch: skip if the match is not
              // telegram-eligible, user disabled Telegram, no chat ID, or already sent
              if (telegramEligible && isUserTelegramActive && rawUserChatId && !sentTelegramChatIds.has(rawUserChatId)) {
                // STRICT DELETE RULE — final fresh check before firing. The
                // match above was computed from a ≤60s snapshot; re-read the
                // user's watchlist straight from the DAO (its own cache is
                // only ~2s) when the Telegram eligibility came from a
                // watchlist match. A stock deleted seconds ago can never
                // trigger this send. (Custom alert rules with telegram ON are
                // explicit per-rule opt-ins and are not affected by this.)
                if (prefsMatch && uWatchlistMatch) {
                  const freshSymbols = await getActiveWatchlistSymbols(u.uid, { noCreate: true }).catch(() => userSymbols);
                  const stillWatched = freshSymbols.some(kw => isSymbolMatch(companyName, subject, kw, scrip_cd));
                  // Opportunistically refresh the snapshot for later items.
                  monitorUserWatchlistCache.set(u.uid, { symbols: freshSymbols, map: userSymbolMap, fetchedAt: Date.now() });
                  if (!stillWatched) {
                    console.debug(`[TELEGRAM] skip user ${u.uid} for ${companyName}: no longer in watchlist (deleted after snapshot)`);
                    continue;
                  }
                }
                sentTelegramChatIds.add(rawUserChatId);
                dispatchPromises.push((async () => {
                  try {
                    const userRes = await sendToTelegram(message, rawUserChatId);
                    if (userRes.success && userRes.messageId) {
                      const viaRule = !prefsMatch && userRuleEval.shouldSendTelegram;
                      await addLog('SUCCESS', 'TELEGRAM', `Personal alert -> user ${u.uid}: ${companyName} [${priority.category}] via ${viaRule ? 'alert-rule(telegram-on)' : 'watchlist-prefs'}`);
                      const userWantsAiSummary = uPrefs?.telegramAiSummaryEnabled !== false;
                      if (userWantsAiSummary) {
                        const userSummaryLang = (uPrefs as any)?.aiSummaryLang === 'hinglish' ? 'hinglish' : 'english';
                        generateAndSendSummary(userRes.messageId, companyName, subject, details, priority.category, pdfLink, newsId, rawUserChatId, userSummaryLang)
                          .catch(() => {});
                      }
                    }
                  } catch (userErr: any) {
                    console.warn(`Failed sending user telegram to ${rawUserChatId}:`, userErr?.message);
                  }
                })());
              } else if (matchesUser && rawUserChatId && !sentTelegramChatIds.has(rawUserChatId)) {
                // Skip diagnostics (console only, no Firestore cost): explains
                // "why didn't I get it" without spamming the activity log.
                console.debug(`[TELEGRAM] skip user ${u.uid} for ${companyName}: telegramEligible=${telegramEligible} toggleActive=${isUserTelegramActive}`);
              }
            }
          }
        }

        // Execute dispatches concurrently without stalling the loop
        if (dispatchPromises.length > 0) {
          Promise.allSettled(dispatchPromises).catch(() => {});
        }

      } catch (itemErr: any) {
        addLog('ERROR', 'MONITOR', `Error processing item ${item?.NEWSID || 'unknown'} (${item?.SLONGNAME || 'unknown'}): ${itemErr.message}`);
      }
    }
  } finally {
    isPolling = false;
  }
}
