import express from "express";
import bcrypt from "bcryptjs";
import { getSettings, saveSettings } from "../database/settingsDao.js";
import { getLogs, addLog, clearLogs } from "../database/logDao.js";
import { saveFeedback, getAllFeedback, markFeedbackRead } from "../database/feedbackDao.js";
import { getRecentAnnouncements, markAnnouncementSent, getAnnouncementById, processedBloomFilter, sentBloomFilter, isAnnouncementProcessed, isAnnouncementSent, getBloomFilterDiagnostics } from "../database/announcementDao.js";
import { generateDirectSummary, generateAndSendSummary, askAppHelpAI } from "../services/gemini.js";
import { escapeHTML } from "../utils/helpers.js";
import { resumeFirestoreNetwork, pauseFirestoreNetwork } from "../database/firebase.js";
import { requireAuth, requireAdmin, requireProOrAdmin, aiRateLimiter, telegramRateLimiter } from "../security/auth.js";
import { runSecurityAudit, executeSimulatedPenTest } from "../security/hardening.js";
import {
  getAllWatchlists,
  renameWatchlist,
  addWatchlist,
  deleteWatchlist,
  toggleWatchlist,
  addSymbolToWatchlist,
  addSymbolsToWatchlist,
  updateSymbolPriorityInWatchlist,
  updateSymbolPriorityAcrossAllWatchlists,
  removeSymbolFromWatchlist,
  removeSymbolsFromWatchlistBatch,
  updateSymbolsPriorityBatch,
  clearWatchlistSymbols,
  clearAllWatchlistsSymbols,
  resetUserWatchlistsToDefault,
  sanitizeUserId
} from "../database/watchlistDao.js";
import { getBseHealth, testBSEConnection, syncWatchlistHistoricalData, syncSingleStockHistoricalData, backfillRecentAnnouncements, getBackupStalenessMetrics } from "../services/bse.js";
import { getAllStockEntries } from "../utils/stockResolver.js";
import { invalidateMonitorConfigCache } from "../services/monitor.js";
import { getTelegramHealth, sendToTelegram, getBotUsername } from "../services/telegram.js";
import { 
  getResultsCalendarData, 
  fetchAndSyncResultsCalendar, 
  syncSingleStockResultsCalendar,
  getStockResultsHistory, 
  broadcastUpcomingMeetingsToTelegram,
  fetchDeepHistoricalResultsForStock,
  fetchDeepHistoricalResultsForWatchlist,
  boostPreResultWindow,
  getPreResultRunupAnnouncements
} from "../services/resultsCalendarService.js";
import { getStorageStatusReport, runAutoStorageCleanup, triggerManualTestStorageAlert, pruneAnnouncementsByPercentage } from "../services/storageMonitor.js";
import { getManualStorageMode, setManualStorageMode, resetQuotaExceededFlag, isFirestoreQuotaExceeded, resetAdminPermissionDenied, isAdminPermissionDenied } from "../database/localStore.js";
import { getCompanyIntelligence, generateCompanyAiOverview, fetchStockQuote } from "../services/companyIntelService.js";
import { getAllNotifications, getUnreadNotificationCount, markNotificationRead, markNotificationsReadBatch, markAllNotificationsRead, clearAllNotifications } from "../database/notificationDao.js";
import { circuitRegistry } from "../utils/circuitBreaker.js";
import { 
  fetchGeneralMarketNews, 
  fetchStockSpecificNews, 
  getWatchlistNews, 
  sendNewsToTelegram, 
  sendWatchlistNewsDigestToTelegram,
  processAutomatedNewsAlerts,
  NEWS_FEEDS
} from "../services/stockNewsService.js";
import { 
  getUserProfile, 
  saveUserProfile, 
  isUsernameAvailable, 
  generateUniqueUsername
} from "../database/usersDao.js";
import { getAllAlertRules, saveAlertRule, toggleAlertRule, deleteAlertRule } from "../database/alertRulesDao.js";
import { checkServerAiQuota, consumeServerAiQuota, getServerAiQuotaStatus, resetServerAiQuota } from "../services/aiQuotaService.js";
import { classifyMaterialEvent } from "../services/timelineClassifier.js";
import { searchCompany } from "./search.js";
import { fetchLiveMarketIndices, getMarketSessionStatus } from "../services/marketIndicesService.js";
import { getLiveStoryFeed } from "../services/storyFeedService.js";
import { 
  recordTelemetry, 
  getDiagnosticsSummary, 
  clearDiagnostics, 
  triggerCrashTelegramAlert,
  getApprovedBugRules,
  addApprovedBugRule,
  deleteApprovedBugRule
} from "../database/diagnosticsDao.js";
import { seoRouter } from "./seoRoutes.js";
import { pageRenderCache, staticGuideCache, apiResponseCache } from "../utils/renderCache.js";
import { getMarketGuides, getMarketGuideBySlug } from "../services/marketGuidesService.js";

export const apiRouter = express.Router();

// Mount Super SEO Suite (11 Verified Skills Engine)
apiRouter.use("/seo", seoRouter);

// Educational Market Guides API (Fail-safe, cached)
apiRouter.get("/market-guides", (_req, res) => {
  const guides = getMarketGuides();
  res.json({
    success: true,
    total: guides.length,
    guides
  });
});

apiRouter.get("/market-guides/:slug", (req, res) => {
  const guide = getMarketGuideBySlug(req.params.slug);
  if (!guide) {
    return res.status(404).json({ success: false, error: "Market guide not found" });
  }
  res.json({
    success: true,
    guide
  });
});

// Health Check Endpoint with Circuit Breakers & Cache Telemetry
apiRouter.get("/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(), 
    timestamp: Date.now(),
    circuitBreakers: circuitRegistry.getAllStatuses(),
    caches: {
      pages: pageRenderCache.getStats(),
      api: apiResponseCache.getStats(),
      guides: staticGuideCache.getStats()
    }
  });
});

// Cache Telemetry & Diagnostics API
apiRouter.get("/cache/stats", (_req, res) => {
  res.json({
    success: true,
    pages: pageRenderCache.getStats(),
    api: apiResponseCache.getStats(),
    guides: staticGuideCache.getStats()
  });
});

// Admin Cache Invalidation API
apiRouter.post("/cache/clear", requireAdmin, (req, res) => {
  const namespace = req.body?.namespace as string | undefined;
  if (namespace === 'pages') {
    pageRenderCache.clear();
  } else if (namespace === 'api') {
    apiResponseCache.clear();
  } else if (namespace === 'guides') {
    staticGuideCache.clear();
  } else {
    pageRenderCache.clear();
    apiResponseCache.clear();
    staticGuideCache.clear();
  }
  addLog('INFO', 'CACHE', `Render and API cache flushed (namespace: ${namespace || 'all'}) by admin`).catch(() => {});
  res.json({
    success: true,
    message: `Cache cleared successfully (${namespace || 'all'})`
  });
});

// Circuit Breaker Telemetry & Status API
apiRouter.get("/circuit-breakers", (_req, res) => {
  res.json({
    success: true,
    circuitBreakers: circuitRegistry.getAllStatuses()
  });
});

// Reset a specific circuit breaker manually (Admin only)
apiRouter.post("/circuit-breakers/:name/reset", requireAdmin, (req, res) => {
  const breaker = circuitRegistry.get(req.params.name);
  if (!breaker) {
    return res.status(404).json({ success: false, error: `Circuit breaker '${req.params.name}' not found` });
  }
  breaker.reset();
  addLog('INFO', 'CIRCUIT_BREAKER', `Circuit breaker '${req.params.name}' was manually reset by admin`).catch(() => {});
  res.json({
    success: true,
    message: `Circuit breaker '${req.params.name}' reset successfully`,
    status: breaker.getStatus()
  });
});

// Reset all circuit breakers manually (Admin only)
apiRouter.post("/circuit-breakers/reset-all", requireAdmin, (_req, res) => {
  circuitRegistry.resetAll();
  addLog('INFO', 'CIRCUIT_BREAKER', 'All circuit breakers were manually reset by admin').catch(() => {});
  res.json({
    success: true,
    message: "All circuit breakers reset successfully",
    circuitBreakers: circuitRegistry.getAllStatuses()
  });
});

// Helper to safely extract verified user ID from authenticated JWT
export function getReqUserId(req: express.Request): string {
  const user = (req as any).user;
  if (user && user.uid && user.uid !== 'guest') {
    return sanitizeUserId(user.uid);
  }
  return 'guest';
}



// SSRF Safe URL Validator (strictly restricts fetch/proxy to official BSE India domains)
function isAllowedBseUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'www.bseindia.com' ||
      hostname === 'bseindia.com' ||
      hostname.endsWith('.bseindia.com')
    );
  } catch {
    return false;
  }
}

function sanitizeSafeUrl(urlStr?: string): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  if (/^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

apiRouter.get("/settings", async (req, res) => {
  const settings = await getSettings();
  const isAdmin = (req as any).user?.isAdmin === true;
  const uid = getReqUserId(req);
  let userMuted = false;
  if (uid && uid !== 'guest') {
    const profile = await getUserProfile(uid);
    if (profile) {
      userMuted = Boolean(profile.muteInAppNotifications ?? profile.notificationPreferences?.muteInAppNotifications);
    }
  } else {
    userMuted = !!settings.muteInAppNotifications;
  }
  
  res.json({
    botToken: isAdmin ? (settings.botToken ? "•••••••••••••••••••••••••••••" : "") : "",
    chatId: isAdmin ? settings.chatId : "",
    botUsername: getBotUsername(),
    telegramBotConfigured: Boolean(settings.botToken || process.env.TELEGRAM_BOT_TOKEN),
    isRunning: settings.isRunning,
    isFilterEnabled: settings.isFilterEnabled,
    excludeKeywords: settings.excludeKeywords || "",
    telegramAlertPriority: settings.telegramAlertPriority || 'HIGH_ONLY',
    telegramAlertCategory: settings.telegramAlertCategory || 'RESULTS_ONLY',
    telegramWatchlistOnly: settings.telegramWatchlistOnly !== undefined ? settings.telegramWatchlistOnly : true,
    telegramAlertsEnabled: settings.telegramAlertsEnabled !== false,
    telegramAiSummaryEnabled: settings.telegramAiSummaryEnabled !== false,
    muteCrashAlerts: !!settings.muteCrashAlerts,
    muteInAppNotifications: !!userMuted,
    hasAppPin: !!settings.appPinHash,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    envConfigured: {
      botToken: !!process.env.TELEGRAM_BOT_TOKEN,
      chatId: isAdmin ? !!process.env.TELEGRAM_CHAT_ID : false,
      appPin: !!process.env.APP_PIN,
      geminiKey: !!process.env.GEMINI_API_KEY
    },
  });
});

// Settings Modification (Strictly Admin Only)
apiRouter.post("/settings", requireAdmin, async (req, res) => {
  const updated = { ...req.body };
  if (updated.botToken === "•••••••••••••••••••••••••••••" || (typeof updated.botToken === 'string' && !updated.botToken.trim())) {
    delete updated.botToken;
  }
  if (typeof updated.chatId === 'string' && !updated.chatId.trim()) {
    delete updated.chatId;
  }

  if (updated.clearPin) {
    updated.appPinHash = "";
  } else if (updated.newPin) {
    updated.appPinHash = bcrypt.hashSync(updated.newPin, 10);
  }

  delete updated.clearPin;
  delete updated.newPin;

  await saveSettings(updated);
  invalidateMonitorConfigCache();
  res.json({ success: true });
});

apiRouter.get("/logs", requireAdmin, async (req, res) => {
  const limitParam = parseInt(req.query.limit as string) || 300;
  res.json({
    logs: await getLogs(limitParam),
    bseHealth: getBseHealth(),
    backupMetrics: getBackupStalenessMetrics(),
    telegramHealth: getTelegramHealth(),
  });
});

// Clear System Logs (Strictly Admin Only)
apiRouter.delete("/logs", requireAdmin, async (req, res) => {
  await clearLogs();
  await addLog('INFO', 'SYSTEM', 'Engine activity logs were cleared by admin user');
  res.json({ success: true, logs: await getLogs(100) });
});

// Client Error & Sync Failure Logger (Receives frontend Firestore errors for Admin Diagnostics)
apiRouter.post("/client-log", requireAuth, async (req, res) => {
  try {
    const { level, module, message } = req.body || {};
    if (message) {
      await addLog(
        typeof level === 'string' ? level : 'WARNING',
        typeof module === 'string' ? module : 'CLIENT',
        String(message)
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-app user feedback: saves to Firestore/local and notifies admin on Telegram.
apiRouter.post("/feedback", apiRateLimiter, async (req, res) => {
  try {
    const { type, message, email } = req.body || {};
    const cleanType = ['feedback', 'bug', 'feature'].includes(type) ? type : 'feedback';
    const cleanMessage = String(message || '').trim().slice(0, 2000);
    if (!cleanMessage) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }
    const rawEmail = String(email || '').trim().slice(0, 120);
    const cleanEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : '';

    const item = await saveFeedback({
      type: cleanType,
      message: cleanMessage,
      email: cleanEmail || undefined,
      userId: (req as any).user?.uid,
    });

    const typeLabel = cleanType === 'bug' ? '🐞 Bug Report' : cleanType === 'feature' ? '💡 Feature Idea' : '💬 Feedback';
    // Fire-and-forget admin notification; feedback is already persisted above.
    sendToTelegram(
      `📩 <b>New ${typeLabel}</b>\n\n${escapeHTML(cleanMessage)}${cleanEmail ? `\n\n✉️ ${escapeHTML(cleanEmail)}` : ''}\n\n🕒 <i>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</i>`
    ).catch(() => {});

    res.json({ success: true, id: item.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Could not submit feedback. Please try again.' });
  }
});

// Admin: list user feedback
apiRouter.get("/feedback", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100));
    res.json({ success: true, items: getAllFeedback(limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/test-gemini", requireAdmin, aiRateLimiter, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      await addLog('WARNING', 'GEMINI', 'Test Gemini failed: GEMINI_API_KEY environment variable is not defined.');
      return res.status(400).json({ 
        success: false, 
        error: "GEMINI_API_KEY is not configured in the environment. Please add it to your environment secrets." 
      });
    }

    await addLog('INFO', 'GEMINI', 'Triggering test AI summary for sample quarterly earnings announcement...');
    const testCompany = "TATA CONSULTANCY SERVICES LTD";
    const testSubject = "Financial Results for the quarter ended December 31, 2024 (Q3 FY25)";
    const testDetails = "The Board of Directors approved the unaudited standalone and consolidated financial results. Highlights: Revenue from operations stood at ₹60,583 Cr compared to ₹58,229 Cr in Q3 FY24 (+4.0% YoY). Net Profit (PAT) was ₹12,040 Cr against ₹11,058 Cr in the corresponding quarter of previous year (+8.9% YoY). Operating Margin expanded by 50 bps to 25.0%. Interim dividend of ₹10 per equity share declared with record date January 17, 2025.";

    const summary = await generateDirectSummary(testCompany, testSubject, testDetails, 'RESULTS');
    if (summary) {
      return res.json({ success: true, aiSummary: summary });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: "Gemini did not return an output. Please check the Engine Activity Logs tab for rate limit or quota errors." 
      });
    }
  } catch (err: any) {
    await addLog('ERROR', 'GEMINI', `Test Gemini exception: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/announcements", 
  apiResponseCache.middleware({ ttlMs: 15 * 1000, publicCache: false }),
  async (req, res) => {
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
    // Cap at 1000: DAO serves from in-memory cache (up to 10k items), so this
    // does not add Firestore reads. Frontend requests limit=1000 for watchlists.
    const limitParam = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 50));
    let symbols: string[] | undefined;
    if (req.query.symbols && typeof req.query.symbols === 'string') {
      symbols = req.query.symbols.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(req.query.symbols)) {
      symbols = (req.query.symbols as string[]).map(s => String(s).trim()).filter(Boolean);
    }
    res.json(await getRecentAnnouncements(limitParam, symbols));
  }
);

apiRouter.get("/announcements/:id", async (req, res) => {
  try {
    const newsId = req.params.id;
    const item = await getAnnouncementById(newsId);
    if (!item) {
      return res.status(404).json({ success: false, error: "Announcement not found" });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch announcement" });
  }
});

apiRouter.post("/announcements/refresh", async (_req, res) => {
  try {
    const bseRes = await backfillRecentAnnouncements(3);
    const announcements = await getRecentAnnouncements(100);
    res.json({ success: true, count: bseRes?.count ?? 0, announcements });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to refresh announcements" });
  }
});

apiRouter.get("/billing/quota", async (req, res) => {
  const uid = getReqUserId(req);
  const isAdminUser = (req as any).user?.isAdmin === true;
  const status = await getServerAiQuotaStatus(uid, isAdminUser);
  res.json(status);
});

apiRouter.post("/billing/reset-quota", requireAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  await resetServerAiQuota(uid);
  const status = await getServerAiQuotaStatus(uid, true);
  await addLog('INFO', 'AI_QUOTA', `AI summary quota reset for user ${uid}`);
  res.json({ success: true, message: "AI Quota reset successfully", status });
});

apiRouter.post("/announcements/:id/generate-summary", aiRateLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const isAdminUser = (req as any).user?.isAdmin === true;

    // Reject unauthenticated guests immediately to safeguard Gemini API
    if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
      return res.status(401).json({
        success: false,
        authRequired: true,
        error: "Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro Gemini AI summaries."
      });
    }

    // 1. Check server-side AI summary quota before generation
    const quotaCheck = await checkServerAiQuota(uid, isAdminUser);
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: quotaCheck.error || "Daily AI summary quota reached.",
        upgradeRequired: true,
        remainingQuota: 0,
        dailyLimit: quotaCheck.dailyLimit
      });
    }

    const newsId = req.params.id;
    let item = await getAnnouncementById(newsId);
    if (!item && req.body && req.body.companyName) {
      item = req.body;
    }
    if (!item) {
      return res.status(404).json({ error: "Announcement not found in memory or database" });
    }
    const summary = await generateDirectSummary(
      item.companyName || item.SLONGNAME || "",
      item.subject || item.NEWSSUB || "",
      item.details || item.HEADLINE || "",
      item.category || "OTHER",
      item.pdfLink || item.attachmentUrl || "",
      newsId
    );
    if (!summary) {
      return res.status(500).json({ 
        success: false, 
        error: "AI Summary generation failed or rate limited. Check Engine Activity Logs tab for details." 
      });
    }

    // 2. Consume quota ONLY after successful generation
    const consumed = await consumeServerAiQuota(uid, isAdminUser);

    res.json({
      success: true,
      aiSummary: summary,
      remainingQuota: consumed.remaining,
      dailyLimit: consumed.dailyLimit,
      isPro: consumed.isPro
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.get("/watchlists", async (req, res) => {
  const uid = getReqUserId(req);
  res.json(await getAllWatchlists(uid));
});

apiRouter.post("/watchlists", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  const id = await addWatchlist(req.body.name, uid);
  res.json({ id });
});

apiRouter.delete("/watchlists/:id", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  await deleteWatchlist(req.params.id, uid);
  invalidateMonitorConfigCache();
  res.json({ success: true });
});

apiRouter.delete("/watchlists/all/symbols", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  await clearAllWatchlistsSymbols(uid);
  invalidateMonitorConfigCache();
  res.json({ success: true, message: "All watchlists cleared" });
});

apiRouter.delete("/watchlists/:id/symbols", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  await clearWatchlistSymbols(req.params.id, uid);
  invalidateMonitorConfigCache();
  res.json({ success: true, message: "Watchlist cleared" });
});

apiRouter.post("/watchlists/reset-default", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  const data = await resetUserWatchlistsToDefault(uid);
  invalidateMonitorConfigCache();
  res.json({ success: true, data });
});

apiRouter.post(["/watchlists/sync", "/watchlists/sync-historical"], requireAuth, async (req, res) => {
  const mode = req.query.mode || req.body?.mode;
  if (mode === 'background' || mode === 'full') {
    syncWatchlistHistoricalData().catch(console.error);
    return res.json({ success: true, background: true, message: "Full watchlist historical sync initiated in background" });
  }
  const result = await syncWatchlistHistoricalData();
  res.json(result);
});

apiRouter.post(["/watchlists/sync-stock", "/results-calendar/sync-stock"], requireAuth, async (req, res) => {
  const { symbol, scripCode } = req.body;
  const target = scripCode || symbol;
  const [histResult, calResult] = await Promise.allSettled([
    syncSingleStockHistoricalData(target),
    syncSingleStockResultsCalendar(target, scripCode)
  ]);
  res.json({
    success: true,
    symbol: target,
    historical: histResult.status === 'fulfilled' ? histResult.value : null,
    calendar: calResult.status === 'fulfilled' ? calResult.value : null
  });
});

apiRouter.get(
  "/stock-master",
  apiResponseCache.middleware({ ttlMs: 60 * 60 * 1000, publicCache: true }),
  async (_req, res) => {
    res.json(getAllStockEntries());
  }
);

apiRouter.patch("/watchlists/:id/toggle", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  await toggleWatchlist(req.params.id, req.body.isActive, uid);
  syncWatchlistHistoricalData().catch(console.error);
  res.json({ success: true });
});

apiRouter.post("/watchlists/:id/symbols", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  const { symbol, priority, category } = req.body;
  const sym = (symbol || '').trim().toUpperCase();
  if (!sym) {
    return res.status(400).json({ success: false, error: "Symbol is required" });
  }

  await addSymbolToWatchlist(req.params.id, sym, priority || 'HIGH', category, uid);
  invalidateMonitorConfigCache();
  // Instant single-stock sync for BOTH Announcements AND Results Calendar in parallel!
  Promise.allSettled([
    syncSingleStockHistoricalData(sym),
    syncSingleStockResultsCalendar(sym)
  ]).catch(console.error);
  res.json({ success: true });
});

apiRouter.patch("/watchlists/:id/symbols/:symbol/priority", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  const { priority, category } = req.body;
  await updateSymbolPriorityInWatchlist(req.params.id, req.params.symbol, priority, category, uid);
  invalidateMonitorConfigCache();
  res.json({ success: true });
});

apiRouter.post("/watchlists/:id/symbols/bulk", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  if (Array.isArray(req.body.symbols)) {
    const isAdminUser = (req as any).user?.isAdmin === true || uid === 'admin';
    const profile = uid !== 'guest' ? await getUserProfile(uid) : null;
    const isPro = isAdminUser || (profile?.tier === 'pro' && (!profile.proExpiresAt || profile.proExpiresAt > Date.now()));

    const cleanInputSymbols = req.body.symbols
      .map((item: any) => (typeof item === 'string' ? item : item?.symbol || '').trim().toUpperCase())
      .filter(Boolean);

    if (!isPro) {
      const existingLists = await getAllWatchlists(uid);
      const totalSymbols = new Set(
        existingLists.flatMap(l => (l.items || []).map((it: any) => (typeof it === 'string' ? it : it?.symbol || '').toUpperCase())).filter(Boolean)
      );

      const newSymbolsToAdd = cleanInputSymbols.filter((s: string) => !totalSymbols.has(s));
      if (totalSymbols.size + newSymbolsToAdd.length > 5) {
        return res.status(402).json({
          success: false,
          error: "Adding these stocks exceeds the Free Tier 5-stock limit. Upgrade to Pro for unlimited stocks.",
          upgradeRequired: true
        });
      }
    }

    await addSymbolsToWatchlist(req.params.id, req.body.symbols, uid);
    invalidateMonitorConfigCache();
    // Instant sync all newly added symbols in parallel without blocking UI
    cleanInputSymbols.forEach((sym: string) => {
      syncSingleStockHistoricalData(sym).catch(console.error);
      syncSingleStockResultsCalendar(sym).catch(console.error);
    });
  }
  res.json({ success: true });
});

apiRouter.get("/search-company", async (req, res) => {
  try {
    const rawQ = req.query.q;
    const q = typeof rawQ === 'string' ? rawQ.slice(0, 100).trim() : '';
    if (!q) {
      return res.json([]);
    }
    const results = await searchCompany(q);
    res.json(results);
  } catch (e) {
    res.json([]);
  }
});

apiRouter.delete("/watchlists/:id/symbols/:symbol", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  await removeSymbolFromWatchlist(req.params.id, req.params.symbol, uid);
  invalidateMonitorConfigCache();
  res.json({ success: true });
});

apiRouter.post("/watchlists/:id/symbols/remove-batch", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const symbols = Array.isArray(req.body.symbols) ? req.body.symbols : [];
    if (symbols.length > 0) {
      await removeSymbolsFromWatchlistBatch(req.params.id, symbols, uid);
      invalidateMonitorConfigCache();
    }
    res.json({ success: true, removedCount: symbols.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/watchlists/:id/symbols/priority-batch", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
    if (updates.length > 0) {
      await updateSymbolsPriorityBatch(req.params.id, updates, uid);
      invalidateMonitorConfigCache();
    }
    res.json({ success: true, updatedCount: updates.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const handleToggleRoute = async (req: any, res: any) => {
  const isRunningVal = typeof req.body.isRunning === 'boolean'
    ? req.body.isRunning
    : typeof req.body.is_running === 'number'
      ? req.body.is_running === 1
      : Boolean(req.body.isRunning);

  await saveSettings({ isRunning: isRunningVal });
  await addLog(
    "INFO",
    "SYSTEM",
    isRunningVal ? "Monitoring started" : "Monitoring stopped",
  );
  res.json({ isRunning: isRunningVal, is_running: isRunningVal ? 1 : 0 });
};

apiRouter.post("/toggle", requireAdmin, handleToggleRoute);
apiRouter.post("/toggle-engine", requireAdmin, handleToggleRoute);

apiRouter.post("/test-telegram", requireAdmin, telegramRateLimiter, async (req, res) => {
  let { botToken, chatId } = req.body;
  const currentSettings = await getSettings();
  if (botToken === "•••••••••••••••••••••••••••••" || !botToken)
    botToken = currentSettings.botToken;

  const targetChatId = chatId || currentSettings.chatId;

  if (!botToken || !targetChatId) {
    return res.status(400).json({ success: false, error: "Bot Token and Channel/Chat ID are required" });
  }

  const result = await sendToTelegram(
    "👋 <b>Root Admin Test Message</b>\n\nYour global Telegram channel integration is working perfectly! BSE Nexus Engine is ready.",
    targetChatId
  );
  if (result.success) {
    await addLog('SUCCESS', 'TELEGRAM', `Admin test message sent successfully to ${targetChatId}`);
    res.json({ success: true });
  } else {
    await addLog('ERROR', 'TELEGRAM', `Admin test message failed: ${result.error}`);
    res.status(500).json({ success: false, error: result.error });
  }
});

// Dedicated Personal Telegram Alert Test for Registered/Pro users (Does NOT touch global admin settings)
apiRouter.post("/users/test-telegram", requireAuth, telegramRateLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { chatId } = req.body || {};
    const userProf = await getUserProfile(uid);
    const rawTargetChatId = (chatId && typeof chatId === 'string' && chatId.trim()) ? chatId.trim() : (userProf?.telegramChatId || '');

    if (!rawTargetChatId) {
      return res.status(400).json({ success: false, error: "Please enter your numerical Telegram Chat ID" });
    }

    const settings = await getSettings();
    const botToken = settings.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ 
        success: false, 
        error: "Global Telegram Bot is not configured by Admin yet. Please check back shortly." 
      });
    }

    const cleanChatId = rawTargetChatId;
    const userName = (req as any).user?.displayName || (req as any).user?.email?.split('@')[0] || userProf?.displayName || 'Trader';
    const isAiSummaryOn = userProf?.notificationPreferences?.telegramAiSummaryEnabled !== false;
    const isAlertsOn = userProf?.notificationPreferences?.telegramAlertsEnabled !== false;

    const testMsg = `👋 <b>BSE Nexus Personal Alert Test</b>\n\nHello <b>${escapeHTML(userName)}</b>!\n\nYour personal Telegram instant alert connection is <b>ACTIVE & VERIFIED</b>.\n\n⚙️ <b>Current Configuration:</b>\n• Alert Status: ${isAlertsOn ? '🔔 <b>Active (ON)</b>' : '🔕 <b>Muted/Paused (OFF)</b>'}\n• Gemini AI Summary: ${isAiSummaryOn ? '✨ <b>Enabled (ON)</b>' : '⚡ <b>Disabled (Raw Filings Only)</b>'}\n\nYou will receive real-time corporate filings for your Watchlist stocks directly to this chat.\n\n🕒 <i>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</i>`;

    const result = await sendToTelegram(testMsg, cleanChatId);
    if (result.success) {
      await addLog('SUCCESS', 'TELEGRAM', `Personal test alert delivered to user ${uid} (${cleanChatId})`);
      res.json({ success: true, messageId: result.messageId });
    } else {
      await addLog('ERROR', 'TELEGRAM', `Personal test alert failed for user ${uid} (${cleanChatId}): ${result.error}`);
      
      const botUser = getBotUsername();
      let friendlyError = result.error || "Could not deliver message to Telegram.";
      const errStr = (result.error || '').toLowerCase();
      if (errStr.includes('chat not found') || errStr.includes('bot was blocked') || errStr.includes('user is deactivated') || errStr.includes('chat_id is empty')) {
        friendlyError = `Telegram bot cannot reach your Chat ID yet. Telegram requires you to start the bot first: Please open @${botUser} on Telegram (or tap https://t.me/${botUser}), press "Start" (/start), then click "Send test alert" again!`;
      }

      res.status(400).json({ 
        success: false, 
        error: friendlyError 
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Live Username Availability Check Endpoint (Real-time Cloud Check)
apiRouter.get("/users/check-username", async (req, res) => {
  try {
    const rawUsername = (req.query.username as string) || '';
    const currentUid = (req as any).user?.uid !== 'guest' ? (req as any).user?.uid : undefined;
    const userEmail = (req as any).user?.email || undefined;

    const check = await isUsernameAvailable(rawUsername, currentUid, userEmail);
    let suggestion: string | undefined = undefined;

    if (!check.available) {
      suggestion = await generateUniqueUsername(rawUsername, currentUid, userEmail);
    }

    res.json({
      success: true,
      available: check.available,
      cleanUsername: check.cleanUsername,
      reason: check.reason,
      suggestion
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Profile Management Endpoints (Isolated per UID with Strict Cloud Uniqueness)
apiRouter.get("/users/profile", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const userEmail = (req as any).user?.email;
    let profile = await getUserProfile(uid);

    // If profile exists but has no unique username, or is colliding, auto-assign one
    if (profile && !profile.username) {
      const base = profile.displayName || (userEmail ? userEmail.split('@')[0] : 'trader');
      const uniqueUsername = await generateUniqueUsername(base, uid, userEmail);
      profile = await saveUserProfile(uid, { username: uniqueUsername }, true);
    }

    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/users/profile", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const body = req.body || {};

    // Strict whitelist: displayName, username, telegramChatId, telegramUsername, notificationPreferences
    // Explicitly ignored: tier, proExpiresAt, email, maxWatchlistStocks, isAdmin, isOwner, uid
    const sanitizedPatch: Record<string, any> = {};

    if (body.displayName !== undefined) {
      sanitizedPatch.displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    }
    if (body.username !== undefined) {
      sanitizedPatch.username = typeof body.username === 'string' ? body.username.trim() : '';
    }
    if (body.telegramChatId !== undefined) {
      sanitizedPatch.telegramChatId = typeof body.telegramChatId === 'string' ? body.telegramChatId.trim() : (body.telegramChatId === null ? null : undefined);
    }
    if (body.telegramUsername !== undefined) {
      sanitizedPatch.telegramUsername = typeof body.telegramUsername === 'string' ? body.telegramUsername.trim() : (body.telegramUsername === null ? null : undefined);
    }
    if (body.muteInAppNotifications !== undefined) {
      sanitizedPatch.muteInAppNotifications = Boolean(body.muteInAppNotifications);
    }
    if (body.notificationPreferences !== undefined && typeof body.notificationPreferences === 'object' && body.notificationPreferences !== null) {
      sanitizedPatch.notificationPreferences = body.notificationPreferences;
    }

    const updatedProfile = await saveUserProfile(uid, { ...sanitizedPatch, uid });
    invalidateMonitorConfigCache(uid);
    res.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    if (err.code === 'USERNAME_UNAVAILABLE') {
      return res.status(409).json({ 
        success: false, 
        error: err.message, 
        code: 'USERNAME_UNAVAILABLE',
        suggestion: err.suggestion 
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated User Telegram Settings Management (Toggle, AI Summary, Disconnect/Unlink, Scope)
apiRouter.post("/users/telegram/settings", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { 
      telegramChatId, 
      telegramUsername, 
      telegramAlertsEnabled, 
      telegramAiSummaryEnabled, 
      telegramAlertScope,
      unlink 
    } = req.body || {};

    const existingProfile = await getUserProfile(uid);
    const currentPrefs = existingProfile?.notificationPreferences || ({} as any);

    const updatedPrefs = {
      ...currentPrefs,
      ...(telegramAlertsEnabled !== undefined ? { telegramAlertsEnabled: Boolean(telegramAlertsEnabled) } : {}),
      ...(telegramAiSummaryEnabled !== undefined ? { telegramAiSummaryEnabled: Boolean(telegramAiSummaryEnabled) } : {}),
      ...(telegramAlertScope !== undefined ? { telegramAlertScope: telegramAlertScope } : {}),
    };

    const patch: Record<string, any> = {
      notificationPreferences: updatedPrefs,
      uid
    };

    if (unlink) {
      patch.telegramChatId = null;
      patch.telegramUsername = null;
      updatedPrefs.telegramAlertsEnabled = false;
    } else {
      if (telegramChatId !== undefined) {
        patch.telegramChatId = typeof telegramChatId === 'string' ? telegramChatId.trim() : (telegramChatId === null ? null : undefined);
      }
      if (telegramUsername !== undefined) {
        patch.telegramUsername = typeof telegramUsername === 'string' ? telegramUsername.trim().replace(/^@/, '') : (telegramUsername === null ? null : undefined);
      }
    }

    const updatedProfile = await saveUserProfile(uid, patch);
    invalidateMonitorConfigCache(uid);

    res.json({
      success: true,
      profile: updatedProfile,
      telegramChatId: updatedProfile.telegramChatId,
      telegramAlertsEnabled: updatedProfile.notificationPreferences?.telegramAlertsEnabled !== false,
      telegramAiSummaryEnabled: updatedProfile.notificationPreferences?.telegramAiSummaryEnabled !== false,
      telegramAlertScope: updatedProfile.notificationPreferences?.telegramAlertScope || 'WATCHLIST_ONLY'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/test-bse", requireAdmin, async (req, res) => {
  const testRes = await testBSEConnection();
  if (!testRes.success) {
    await addLog('ERROR', 'BSE', `Test BSE fetch failed: ${testRes.error || "No data returned"}`);
    return res.status(500).json({ success: false, error: testRes.error || "No data returned from BSE." });
  }

  const companyName = testRes.company;
  await addLog('SUCCESS', 'BSE', `Test BSE fetch successful. Latest record: ${companyName}`);

  // Try sending test alert to Telegram if token is set
  try {
    await sendToTelegram(`🛠️ <b>BSE FETCH TEST</b>\n\nSuccessfully connected to BSE India!\nLatest Record: <b>${escapeHTML(companyName)}</b>`);
  } catch (e) {
    // Ignore telegram notification error during BSE test
  }

  res.json({ success: true, company: companyName });
});

apiRouter.patch("/watchlists/:id/name", requireAuth, async (req, res) => {
  const uid = getReqUserId(req);
  await renameWatchlist(req.params.id, req.body.name, uid);
  res.json({ success: true });
});

apiRouter.post("/send-to-telegram-manual", requireProOrAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const { newsId, companyName, subject, details, category, pdfLink, attachmentUrl, scripCode, calendarUrl } = req.body;

    if (!companyName || !subject) {
      return res.status(400).json({ success: false, error: "Missing required announcement fields" });
    }

    const effectivePdf = sanitizeSafeUrl(pdfLink || attachmentUrl || '');
    const safeCalendarUrl = sanitizeSafeUrl(calendarUrl);
    const formattedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let messageText = `⚡ <b>MANUAL ALERT: ${escapeHTML(companyName)}</b>\n\n`;
    messageText += `📌 <b>Subject:</b> ${escapeHTML(subject)}\n`;
    if (scripCode) {
      messageText += `🔢 <b>Scrip Code:</b> <code>${escapeHTML(scripCode)}</code>\n`;
    }
    if (details) {
      messageText += `📝 <b>Details:</b> ${escapeHTML(details.length > 300 ? details.substring(0, 300) + '...' : details)}\n`;
    }
    if (safeCalendarUrl) {
      messageText += `\n📅 <b>Calendar Event:</b> <a href="${escapeHTML(safeCalendarUrl)}">Add to Google Calendar (1-Click)</a>\n`;
    }
    if (effectivePdf) {
      messageText += `\n📄 <a href="${escapeHTML(effectivePdf)}">View Attachment (PDF)</a>\n`;
    }
    messageText += `\n🕒 <i>${formattedDate}</i>`;

    if (newsId) {
      await markAnnouncementSent(newsId);
    }

    const telegramRes = await sendToTelegram(messageText);

    if (!telegramRes.success || !telegramRes.messageId) {
      await addLog('ERROR', 'TELEGRAM', `Manual send failed for ${companyName}: ${telegramRes.error || 'Unknown error'}`);
      return res.status(500).json({ success: false, error: telegramRes.error || "Failed to send to Telegram. Please check Bot Token & Chat ID in Config." });
    }

    const messageId = telegramRes.messageId;
    if (newsId) {
      await markAnnouncementSent(newsId, messageId);
    }
    await addLog('SUCCESS', 'TELEGRAM', `Manual alert sent to Telegram for ${companyName}`);

    // Trigger AI summary generation & send as reply automatically if requested
    const shouldSendAi = req.body.includeAiSummary !== undefined ? Boolean(req.body.includeAiSummary) : true;
    if (shouldSendAi) {
      generateAndSendSummary(messageId, companyName, subject, details || '', category || 'OTHER', effectivePdf || '', newsId)
        .catch(err => addLog('ERROR', 'GEMINI', `Manual AI summary send error: ${err.message}`));
    }

    res.json({ success: true, messageId });
  } catch (err: any) {
    await addLog('ERROR', 'TELEGRAM', `Manual send exception: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/send-holiday-telegram", requireProOrAdmin, async (req, res) => {
  try {
    const { name, date, day, isMuhuratTrading, muhuratTiming, description, calendarUrl } = req.body;
    if (!name || !date) {
      return res.status(400).json({ success: false, error: "Missing holiday name or date" });
    }

    const safeCalendarUrl = sanitizeSafeUrl(calendarUrl);

    let messageText = `🏖️ <b>MARKET HOLIDAY ALERT (BSE / NSE INDIA)</b>\n\n`;
    messageText += `🏛️ <b>Holiday:</b> ${escapeHTML(name)}\n`;
    messageText += `📅 <b>Date:</b> ${escapeHTML(date)} (${escapeHTML(day || 'Exchange Closed')})\n\n`;
    messageText += `🛑 <b>Market Status:</b> Trading is CLOSED for Capital Market (Equities), Derivatives (F&O), and Currency Segments.\n`;
    
    if (isMuhuratTrading) {
      messageText += `\n🪔 <b>Special Session:</b> Diwali Muhurat Trading will take place!\n⏰ <b>Timing:</b> ${escapeHTML(muhuratTiming || '06:15 PM - 07:15 PM IST')}\n`;
    }
    
    messageText += `\n⚡ <b>F&O Expiry Note:</b> Any derivative contracts scheduled to expire on this day will expire on the preceding trading day.\n`;
    
    if (safeCalendarUrl) {
      messageText += `\n📅 <b>Calendar Event:</b> <a href="${escapeHTML(safeCalendarUrl)}">Add Holiday to Google Calendar (1-Click)</a>\n`;
    }
    
    const formattedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    messageText += `\n🕒 <i>Broadcasted via BSE Nexus • ${formattedDate}</i>`;

    const telegramRes = await sendToTelegram(messageText);
    if (!telegramRes.success) {
      return res.status(500).json({ success: false, error: telegramRes.error || "Failed to broadcast holiday to Telegram" });
    }

    await addLog('SUCCESS', 'TELEGRAM', `Market Holiday alert broadcasted to Telegram: ${name} (${date})`);
    res.json({ success: true, messageId: telegramRes.messageId });
  } catch (err: any) {
    await addLog('ERROR', 'TELEGRAM', `Holiday broadcast error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/results-calendar", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    const filter = (req.query.filter as string || "all") as 'all' | 'today' | 'upcoming' | 'recent';
    const watchlistId = req.query.watchlistId as string;
    const uid = getReqUserId(req);
    const data = await getResultsCalendarData(filter, watchlistId, uid);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/results-calendar/refresh", async (req, res) => {
  try {
    const mode = (req.query.mode as string) || req.body?.mode;
    const filter = (req.query.filter as string || "all") as 'all' | 'today' | 'upcoming' | 'recent';
    const watchlistId = req.query.watchlistId as string;
    const uid = getReqUserId(req);

    if (mode === 'full') {
      // Run full 200+ stock library scan in background non-blocking
      fetchAndSyncResultsCalendar(true).catch(console.error);
      const data = await getResultsCalendarData(filter, watchlistId, uid);
      return res.json({ 
        success: true, 
        background: true, 
        message: "Full background sync initiated across all library stocks", 
        ...data 
      });
    }

    // Quick / Standard refresh: updates cache and declaration matching quickly (<1s)
    await fetchAndSyncResultsCalendar(false);
    const data = await getResultsCalendarData(filter, watchlistId, uid);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/results-calendar/telegram-broadcast", requireProOrAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const forceAll = Boolean(req.body?.forceAll);
    const result = await broadcastUpcomingMeetingsToTelegram({ forceAll });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Dynamic Live Market Story Feed Route
// ==========================================
apiRouter.get("/story/feed", async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    const feed = await getLiveStoryFeed();
    res.json({ success: true, ...feed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Multi-Source Stock News & 24/7 Telegram Alert Routes
// ==========================================
apiRouter.get(["/news", "/news/general"], async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    const force = req.query.refresh === 'true';
    const source = req.query.source as string;
    const items = await fetchGeneralMarketNews(force, source);
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/news/watchlist", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const source = req.query.source as string;
    const result = await getWatchlistNews(uid, source);
    res.json({ success: true, count: result.items.length, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get(
  "/news/sources",
  apiResponseCache.middleware({ ttlMs: 60 * 60 * 1000, publicCache: true }),
  async (_req, res) => {
    try {
      const uniqueSources = [
        { name: 'Economic Times', slug: 'et', logo: 'ET', feedsCount: 5, color: '#C026D3' },
        { name: 'LiveMint', slug: 'mint', logo: 'Mint', feedsCount: 4, color: '#EA580C' },
        { name: 'Moneycontrol', slug: 'moneycontrol', logo: 'MC', feedsCount: 4, color: '#0284C7' },
        { name: 'Business Standard', slug: 'bs', logo: 'BS', feedsCount: 3, color: '#DC2626' }
      ];
      res.json({ success: true, sources: uniqueSources, totalFeeds: NEWS_FEEDS.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

apiRouter.get("/news/stock/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const company = req.query.company as string;
    const items = await fetchStockSpecificNews(symbol, company);
    res.json({ success: true, symbol, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/news/summarize", aiRateLimiter, async (req, res) => {
  try {
    const { title, snippet, source, symbol, companyName, link } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: "News title required" });
    }
    const uid = getReqUserId(req);
    const isAdminUser = (req as any).user?.isAdmin === true;

    // Reject unauthenticated guests immediately to safeguard Gemini API
    if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
      return res.status(401).json({
        success: false,
        authRequired: true,
        error: "Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro Gemini AI summaries."
      });
    }

    // 1. Check AI quota without consuming
    const quotaCheck = await checkServerAiQuota(uid, isAdminUser);
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: quotaCheck.error || "Daily AI summary quota reached.",
        upgradeRequired: true,
        remainingQuota: 0,
        dailyLimit: quotaCheck.dailyLimit
      });
    }

    const companyTarget = companyName || (symbol ? `${symbol}` : (source || "Market News"));
    const details = `${snippet || title}\n\nPublisher: ${source || 'Financial Media'}\nArticle URL: ${link || ''}`;
    const summary = await generateDirectSummary(companyTarget, title, details, 'NEWS');
    
    if (!summary) {
      return res.status(500).json({ success: false, error: "Gemini AI was unable to summarize this news story." });
    }

    // 2. Consume quota ONLY after successful generation
    const consumed = await consumeServerAiQuota(uid, isAdminUser);

    res.json({
      success: true,
      aiSummary: summary,
      remainingQuota: consumed.remaining,
      dailyLimit: consumed.dailyLimit,
      isPro: consumed.isPro
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/news/telegram/send", requireAuth, telegramRateLimiter, async (req, res) => {
  try {
    const { newsItem, chatId } = req.body;
    if (!newsItem || !newsItem.title) {
      return res.status(400).json({ success: false, error: "News item payload required" });
    }
    const result = await sendNewsToTelegram(newsItem, chatId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/news/telegram/digest", requireAuth, telegramRateLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { chatId } = req.body;
    const result = await sendWatchlistNewsDigestToTelegram(uid, chatId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get or Set 24/7 Cloud Telegram News Alert Preferences
apiRouter.get("/news/telegram/preferences", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    if (uid && uid !== 'anonymous') {
      const user = await getUserProfile(uid);
      if (user) {
        const prefs = user.notificationPreferences || ({} as any);
        return res.json({
          success: true,
          enabled: prefs.telegramNewsAlerts !== false,
          sources: prefs.telegramNewsSources || ['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard'],
          categories: prefs.telegramNewsCategories || ['all']
        });
      }
    }
    const settings = await getSettings();
    res.json({
      success: true,
      enabled: settings.autoTelegramNews !== false,
      sources: settings.telegramNewsSources || ['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard'],
      categories: settings.telegramNewsCategories || ['all']
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle 24/7 Cloud Automated News Alerts & Categories for the user
apiRouter.post("/news/telegram/toggle-auto", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { enabled, sources, categories } = req.body;

    if (uid && uid !== 'anonymous') {
      const user = await getUserProfile(uid);
      if (user) {
        const prefs = user.notificationPreferences || ({} as any);
        if (enabled !== undefined) prefs.telegramNewsAlerts = enabled === true;
        if (Array.isArray(sources)) prefs.telegramNewsSources = sources;
        if (Array.isArray(categories)) prefs.telegramNewsCategories = categories;
        
        await saveUserProfile(uid, { notificationPreferences: prefs });
        return res.json({
          success: true,
          enabled: prefs.telegramNewsAlerts,
          sources: prefs.telegramNewsSources,
          categories: prefs.telegramNewsCategories
        });
      }
    }

    // Fallback to global settings for admin / system
    const settings = await getSettings();
    await saveSettings({
      autoTelegramNews: enabled !== undefined ? enabled === true : settings.autoTelegramNews,
      telegramNewsSources: Array.isArray(sources) ? sources : settings.telegramNewsSources,
      telegramNewsCategories: Array.isArray(categories) ? categories : settings.telegramNewsCategories
    });

    res.json({
      success: true,
      enabled: enabled === true,
      sources: Array.isArray(sources) ? sources : settings.telegramNewsSources,
      categories: Array.isArray(categories) ? categories : settings.telegramNewsCategories
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger immediate manual check of automated news worker (admin/test)
apiRouter.post("/news/telegram/trigger-worker", requireAuth, async (_req, res) => {
  try {
    const result = await processAutomatedNewsAlerts();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Storage and Quota Management Endpoints (Admin Protected)
apiRouter.get("/storage/status", requireAdmin, async (req, res) => {
  try {
    const report = await getStorageStatusReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/storage/cleanup", requireAdmin, async (req, res) => {
  try {
    const result = await runAutoStorageCleanup(true);
    const report = await getStorageStatusReport();
    res.json({ success: true, ...result, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/storage/test-alert", requireAdmin, async (req, res) => {
  try {
    const level = parseInt(req.body.level) || 50;
    if (level !== 50 && level !== 90 && level !== 100) {
      return res.status(400).json({ success: false, error: "Invalid level. Must be 50, 90, or 100." });
    }
    const result = await triggerManualTestStorageAlert(level as 50 | 90 | 100);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Storage Quota Mode Controls (Automatic vs Manual Override)
apiRouter.get("/storage/quota-mode", (req, res) => {
  const mode = getManualStorageMode();
  const isQuotaExceeded = isFirestoreQuotaExceeded();
  const isPermissionDenied = isAdminPermissionDenied();
  res.json({
    mode,
    isQuotaExceeded,
    isPermissionDenied,
    effectiveStorage: (isQuotaExceeded || isPermissionDenied) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

apiRouter.post("/storage/quota-mode", requireAdmin, async (req, res) => {
  const { mode } = req.body;
  if (mode !== 'AUTO' && mode !== 'FORCE_LOCAL' && mode !== 'FORCE_FIRESTORE') {
    return res.status(400).json({ success: false, error: "Invalid storage mode" });
  }
  setManualStorageMode(mode);
  if (mode === 'FORCE_FIRESTORE' || mode === 'AUTO') {
    resetAdminPermissionDenied();
    await resumeFirestoreNetwork();
  } else if (mode === 'FORCE_LOCAL') {
    await pauseFirestoreNetwork();
  }
  await addLog('INFO', 'STORAGE', `Storage quota mode manually set to ${mode}`);
  res.json({
    success: true,
    mode: getManualStorageMode(),
    isQuotaExceeded: isFirestoreQuotaExceeded(),
    isPermissionDenied: isAdminPermissionDenied(),
    effectiveStorage: (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

apiRouter.post("/storage/reset-quota", requireAdmin, async (req, res) => {
  resetQuotaExceededFlag();
  resetAdminPermissionDenied();
  await resumeFirestoreNetwork();
  await addLog('INFO', 'STORAGE', 'Firestore quota and permission denial flags reset manually by admin. Firestore network resumed.');
  res.json({
    success: true,
    isQuotaExceeded: isFirestoreQuotaExceeded(),
    isPermissionDenied: isAdminPermissionDenied(),
    effectiveStorage: (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

apiRouter.post("/storage/reset-permission", requireAdmin, async (req, res) => {
  resetAdminPermissionDenied();
  await resumeFirestoreNetwork();
  await addLog('INFO', 'STORAGE', 'Firestore permission denied flag reset manually by admin. Re-enabling Firestore connection attempts.');
  res.json({
    success: true,
    isQuotaExceeded: isFirestoreQuotaExceeded(),
    isPermissionDenied: isAdminPermissionDenied(),
    effectiveStorage: (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

// Admin Percentage Disclosure Pruning with Safe Floor (Admin PIN protected)
apiRouter.post("/admin/announcements/prune-percentage", requireAdmin, async (req, res) => {
  try {
    const { percentage, pin } = req.body;
    const settings = await getSettings();

    // Verify Admin PIN if configured
    if (settings.appPinHash) {
      if (!pin) {
        return res.status(401).json({ success: false, error: "Admin PIN is required to prune disclosures" });
      }
      const match = await bcrypt.compare(String(pin), settings.appPinHash);
      if (!match) {
        return res.status(403).json({ success: false, error: "Invalid Admin PIN" });
      }
    }

    const pctNum = parseInt(percentage, 10);
    if (isNaN(pctNum) || pctNum < 5 || pctNum > 90) {
      return res.status(400).json({ success: false, error: "Percentage must be between 5% and 90%" });
    }

    // Min floor of at least 100 recent live disclosures + 100% of watchlist results
    const result = await pruneAnnouncementsByPercentage(pctNum, 100);
    const report = await getStorageStatusReport();
    res.json({ success: true, ...result, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stock Results & Historical Earnings Disclosures
apiRouter.get("/stock-results-history", async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || '';
    const scripCode = (req.query.scripCode as string) || '';
    const companyName = (req.query.companyName as string) || '';
    
    if (!symbol && !scripCode && !companyName) {
      return res.status(400).json({ error: "Missing symbol or scripCode" });
    }
    const history = await getStockResultsHistory(symbol, scripCode, companyName);
    res.json({ success: true, symbol, scripCode, history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Deep Historical Sync for a single stock (1 to 5 years)
apiRouter.post("/stocks/:scripCode/fetch-deep-history", async (req, res) => {
  try {
    const scripCode = req.params.scripCode;
    const { symbol, years } = req.body;
    const result = await fetchDeepHistoricalResultsForStock(scripCode, symbol, parseInt(years, 10) || 1);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Deep Historical Sync for all active Watchlist stocks (1 to 5 years)
apiRouter.post("/watchlist/fetch-deep-history", async (req, res) => {
  try {
    const { years } = req.body;
    const result = await fetchDeepHistoricalResultsForWatchlist(parseInt(years, 10) || 1);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Boost Priority for 10-day Pre-Result Announcements Window
apiRouter.post("/stocks/:scripCode/boost-runup-priority", async (req, res) => {
  try {
    const scripCode = req.params.scripCode;
    const { symbol, resultDate, windowDays } = req.body;
    const result = await boostPreResultWindow(scripCode, symbol, resultDate, parseInt(windowDays, 10) || 10);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all announcements in the 10-day Pre-Result Runup Window
apiRouter.get("/stocks/:scripCode/runup-announcements", async (req, res) => {
  try {
    const scripCode = req.params.scripCode;
    const symbol = (req.query.symbol as string) || '';
    const resultDate = (req.query.resultDate as string) || '';
    const windowDays = parseInt(req.query.windowDays as string, 10) || 10;
    const announcements = getPreResultRunupAnnouncements(scripCode, symbol, resultDate, windowDays);
    res.json({ success: true, count: announcements.length, announcements, windowDays, resultDate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Priority Sync Across All Watchlists
apiRouter.patch("/watchlists/symbols/:symbol/priority-sync", requireAuth, async (req, res) => {
  try {
    const { priority, category } = req.body;
    const symbol = req.params.symbol;
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol" });
    }
    const uid = getReqUserId(req);
    await updateSymbolPriorityAcrossAllWatchlists(symbol, priority || 'HIGH', category, uid);
    syncWatchlistHistoricalData().catch(console.error);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Interactive AI Help Assistant for BSE Nexus Guide
apiRouter.post("/help/ask-ai", requireProOrAdmin, aiRateLimiter, async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ success: false, error: "Question cannot be empty" });
    }
    const cleanQuestion = question.trim().slice(0, 500);
    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
    const answer = await askAppHelpAI(cleanQuestion, safeHistory);
    res.json({ success: true, answer });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resilient BSE PDF Resolver & Proxy (SSRF-protected, strictly restricted to BSE domains)
apiRouter.get("/pdf-open", async (req, res) => {
  try {
    const rawUrl = (req.query.url as string) || '';
    const filename = (req.query.file as string) || '';
    const newsId = (req.query.newsId as string) || '';

    const candidateUrls: string[] = [];

    if (rawUrl && isAllowedBseUrl(rawUrl)) {
      candidateUrls.push(rawUrl);
      if (rawUrl.includes('/AttachLive/')) {
        candidateUrls.push(rawUrl.replace('/AttachLive/', '/AttachHis/'));
      } else if (rawUrl.includes('/AttachHis/')) {
        candidateUrls.push(rawUrl.replace('/AttachHis/', '/AttachLive/'));
      }
    }

    if (filename) {
      const cleanFile = filename.replace(/^.*[\\\/]/, '').replace(/[^a-zA-Z0-9_\-\.]/g, '').trim();
      if (cleanFile) {
        candidateUrls.push(`https://www.bseindia.com/xml-data/corpfiling/AttachLive/${cleanFile}`);
        candidateUrls.push(`https://www.bseindia.com/xml-data/corpfiling/AttachHis/${cleanFile}`);
      }
    }

    if (newsId) {
      const cleanNewsId = newsId.replace(/[^a-zA-Z0-9_\-]/g, '');
      if (cleanNewsId) {
        candidateUrls.push(`https://www.bseindia.com/corporates/anndet_new.aspx?origid=${encodeURIComponent(cleanNewsId)}`);
      }
    }

    // Try candidates in order with standard browser headers to prevent hotlink blocks
    for (const testUrl of candidateUrls) {
      // Re-verify each candidate is on bseindia.com
      if (!isAllowedBseUrl(testUrl)) continue;

      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://www.bseindia.com/'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/pdf') || testUrl.toLowerCase().endsWith('.pdf')) {
            const cleanSafeName = (filename || 'bse_filing.pdf').replace(/[^a-zA-Z0-9_\-\.]/g, '');
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${cleanSafeName}"`);
            const arrayBuffer = await response.arrayBuffer();
            return res.send(Buffer.from(arrayBuffer));
          } else if (testUrl.includes('anndet_new.aspx')) {
            return res.redirect(testUrl);
          }
        }
      } catch {
        // Try next candidate url
      }
    }

    // Direct fallback if proxy fetch fails
    if (candidateUrls.length > 0 && isAllowedBseUrl(candidateUrls[0])) {
      return res.redirect(candidateUrls[0]);
    }
    return res.redirect('https://www.bseindia.com/corporates/ann.html');
  } catch (err: any) {
    return res.redirect('https://www.bseindia.com/corporates/ann.html');
  }
});

// ==========================================
// FEATURE 1: COMPANY INTELLIGENCE & QUOTE
// ==========================================

apiRouter.get("/company-intel/:identifier", async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const scripCode = (req.query.scripCode as string) || (/^\d+$/.test(identifier) ? identifier : '');
    const symbol = (req.query.symbol as string) || (!/^\d+$/.test(identifier) ? identifier : '');

    const intel = await getCompanyIntelligence(scripCode, symbol);
    res.json(intel);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.all("/company-intel/:identifier/ai-overview", requireProOrAdmin, aiRateLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const isAdminUser = (req as any).user?.isAdmin === true;

    // 1. Check AI quota without consuming
    const quotaCheck = await checkServerAiQuota(uid, isAdminUser);
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: quotaCheck.error || "Daily AI summary quota reached.",
        upgradeRequired: true,
        remainingQuota: 0,
        dailyLimit: quotaCheck.dailyLimit
      });
    }

    const identifier = req.params.identifier;
    const scripCode = (req.query.scripCode as string) || (req.body?.scripCode as string) || (/^\d+$/.test(identifier) ? identifier : '');
    const symbol = (req.query.symbol as string) || (req.body?.symbol as string) || (!/^\d+$/.test(identifier) ? identifier : '');

    const aiOverview = await generateCompanyAiOverview(scripCode, symbol);
    if (!aiOverview) {
      return res.status(500).json({ success: false, error: "Gemini AI was unable to generate company overview." });
    }

    // 2. Consume quota ONLY after successful generation
    const consumed = await consumeServerAiQuota(uid, isAdminUser);

    res.json({
      success: true,
      aiOverview,
      remainingQuota: consumed.remaining,
      dailyLimit: consumed.dailyLimit,
      isPro: consumed.isPro
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/stocks/:symbol/quote", async (req, res) => {
  try {
    const quote = await fetchStockQuote(req.params.symbol);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    res.json(quote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FEATURE 2: MATERIAL CORPORATE ACTIONS TIMELINE
// ==========================================

apiRouter.get("/material-events", async (req, res) => {
  try {
    const category = (req.query.category as string) || 'ALL';
    const limitParam = parseInt(req.query.limit as string) || 100;
    const recent = await getRecentAnnouncements(300);

    const events = [];
    for (const ann of recent) {
      const evt = classifyMaterialEvent({
        id: ann.id,
        subject: ann.subject,
        details: ann.details,
        companyName: ann.companyName,
        scrip_cd: ann.scrip_cd,
        bseTime: ann.bseTime,
        pdfLink: ann.pdfLink,
        priority: ann.priority,
        category: ann.category,
        timestamp: ann.bseTimestamp || ann.fetched_at
      });

      if (evt) {
        if (category === 'ALL' || evt.eventType === category) {
          events.push(evt);
        }
      }
    }

    res.json({ events: events.slice(0, limitParam) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FEATURE 3: IN-APP NOTIFICATION INBOX
// ==========================================

apiRouter.get("/notifications", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const limitParam = parseInt(req.query.limit as string) || 100;
    const watchlistOnly = req.query.watchlistOnly === 'true';
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifs = getAllNotifications(uid, limitParam, { watchlistOnly, type, unreadOnly });
    const unreadCount = getUnreadNotificationCount(uid, false);
    const watchlistUnreadCount = getUnreadNotificationCount(uid, true);

    let isMuted = false;
    if (uid && uid !== 'guest') {
      const profile = await getUserProfile(uid);
      if (profile) {
        isMuted = Boolean(profile.muteInAppNotifications ?? profile.notificationPreferences?.muteInAppNotifications);
      }
    }

    res.json({ notifications: notifs, unreadCount, watchlistUnreadCount, muteInAppNotifications: isMuted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/notifications/unread-count", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const watchlistOnly = req.query.watchlistOnly === 'true';
    const count = getUnreadNotificationCount(uid, watchlistOnly);
    res.json({ unreadCount: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const ok = markNotificationRead(req.params.id, uid);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/notifications/read-batch", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const count = markNotificationsReadBatch(ids, uid);
    res.json({ success: true, updatedCount: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    markAllNotificationsRead(uid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete("/notifications", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    clearAllNotifications(uid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/notifications/toggle-mute", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    let shouldMute: boolean;
    if (uid && uid !== 'guest') {
      const userProfile = await getUserProfile(uid);
      const currentMute = userProfile
        ? Boolean(userProfile.muteInAppNotifications ?? userProfile.notificationPreferences?.muteInAppNotifications)
        : false;
      shouldMute = typeof req.body.mute === 'boolean' ? req.body.mute : !currentMute;

      if (userProfile) {
        const updatedPrefs = {
          ...(userProfile.notificationPreferences || {}),
          muteInAppNotifications: shouldMute
        };
        await saveUserProfile(uid, {
          muteInAppNotifications: shouldMute,
          notificationPreferences: updatedPrefs as any
        }, true);
      }
    } else {
      shouldMute = typeof req.body.mute === 'boolean' ? req.body.mute : true;
    }

    res.json({ success: true, muteInAppNotifications: shouldMute });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FEATURE 3 (CONT.): ADVANCED ALERT RULES
// ==========================================

apiRouter.get("/alert-rules", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const rules = getAllAlertRules(uid);
    res.json({ rules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/alert-rules", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const rule = saveAlertRule(req.body, uid);
    res.json({ success: true, rule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch("/alert-rules/:id/toggle", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { enabled } = req.body;
    const ok = toggleAlertRule(req.params.id, Boolean(enabled), uid);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete("/alert-rules/:id", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const ok = deleteAlertRule(req.params.id, uid);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FEATURE: REAL-TIME MARKET INDICES & OVERVIEW
// ==========================================

apiRouter.get(
  "/market/indices",
  apiResponseCache.middleware({ ttlMs: 15 * 1000, publicCache: true }),
  async (_req, res) => {
    try {
      const data = await fetchLiveMarketIndices();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

apiRouter.get(
  "/market/status",
  apiResponseCache.middleware({ ttlMs: 30 * 1000, publicCache: true }),
  (_req, res) => {
    try {
      const status = getMarketSessionStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// FEATURE: IN-HOUSE SYSTEM HEALTH & CRASH DIAGNOSTICS (ADMIN ONLY)
// ==========================================

// Public lightweight ingestion endpoint (used by client telemetry)
apiRouter.post("/telemetry/event", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const event = await recordTelemetry({
      ...req.body,
      userId: uid !== 'guest' ? uid : undefined
    });
    res.json({ success: true, eventId: event.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only diagnostics summary & detailed crash logs
apiRouter.get("/admin/diagnostics", requireAdmin, async (req, res) => {
  try {
    const summary = await getDiagnosticsSummary();
    const bse = await getBseHealth();
    const telegram = await getTelegramHealth();
    const settings = await getSettings();
    
    res.json({
      success: true,
      ...summary,
      muteCrashAlerts: !!settings.muteCrashAlerts,
      backendServices: {
        bse,
        telegram,
        database: {
          status: isFirestoreQuotaExceeded() ? 'LOCAL_STORAGE_MODE' : 'OPTIMAL_FIRESTORE',
          storageMode: getManualStorageMode()
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only clear diagnostics logs
apiRouter.post("/admin/diagnostics/clear", requireAdmin, async (req, res) => {
  try {
    await clearDiagnostics();
    res.json({ success: true, message: "Diagnostics logs cleared successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only test crash Telegram alert
apiRouter.post("/admin/diagnostics/test-alert", requireAdmin, async (req, res) => {
  try {
    const testEvent = {
      id: `test_${Date.now()}`,
      type: 'ERROR' as const,
      timestamp: Date.now(),
      device: {
        type: 'MOBILE' as const,
        os: 'Android 14 (Simulated)',
        browser: 'Chrome Mobile 124',
        screen: '390x844',
        connection: '4g'
      },
      error: {
        message: "Simulated Frontend Bug: Cannot read properties of undefined (reading 'announcement_id')",
        stack: "TypeError: Cannot read properties of undefined\n    at renderAnnouncementCard (Announcements.tsx:412:18)\n    at Object.invokeGuardedCallbackProd (react-dom.production.min.js:189:12)",
        severity: 'CRITICAL' as const,
        breadcrumbs: [
          { action: "Click: Watchlists Tab", category: "ui", timestamp: Date.now() - 4000 },
          { action: "Click: Filter HIGH Priority", category: "filter", timestamp: Date.now() - 2000 },
          { action: "Click: Expand RELIANCE Details", category: "card", timestamp: Date.now() - 500 }
        ],
        url: "/dashboard?tab=watchlists&view=dense"
      }
    };

    const sent = await triggerCrashTelegramAlert(testEvent, true);
    res.json({ 
      success: sent, 
      message: sent ? "Test crash alert sent to Telegram successfully!" : "Failed to send test alert. Please verify Telegram Bot Token & Chat ID in Settings."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Get all approved/muted bug rules
apiRouter.get("/admin/diagnostics/approved-bugs", requireAdmin, (req, res) => {
  try {
    const rules = getApprovedBugRules();
    res.json({ success: true, rules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Add an approved/muted bug rule
apiRouter.post("/admin/diagnostics/approved-bugs", requireAdmin, (req, res) => {
  try {
    const { pattern, name, reason } = req.body;
    if (!pattern || typeof pattern !== 'string' || !pattern.trim()) {
      return res.status(400).json({ success: false, error: "Error pattern is required" });
    }
    const rule = addApprovedBugRule(pattern.trim(), name, reason);
    res.json({ success: true, rule, rules: getApprovedBugRules() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Delete an approved/muted bug rule
apiRouter.delete("/admin/diagnostics/approved-bugs/:id", requireAdmin, (req, res) => {
  try {
    const ok = deleteApprovedBugRule(req.params.id);
    res.json({ success: ok, rules: getApprovedBugRules() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Toggle global crash alerts mute
apiRouter.post("/admin/diagnostics/toggle-mute-alerts", requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    const shouldMute = typeof req.body.mute === 'boolean' ? req.body.mute : !settings.muteCrashAlerts;
    await saveSettings({ muteCrashAlerts: shouldMute });
    addLog('INFO', 'TELEMETRY', `Global crash alert muting set to ${shouldMute}`);
    res.json({ success: true, muteCrashAlerts: shouldMute });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 20-POINT SECURITY AUDIT & PENETRATION TESTING
// ==========================================

// Audit status of all 20 launch security items
apiRouter.get("/security/audit", async (req, res) => {
  try {
    const user = (req as any).user;
    const auditReport = await runSecurityAudit(user);
    res.json({ success: true, ...auditReport });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Execute simulated live penetration test against endpoints
apiRouter.post("/security/pen-test", requireAdmin, async (req, res) => {
  try {
    const penTestReport = await executeSimulatedPenTest('http://localhost:3000');
    await addLog('INFO', 'SECURITY', `Simulated Penetration Test executed: ${penTestReport.blockedAttacks}/${penTestReport.totalAttacks} attack vectors blocked successfully`);
    res.json({ success: true, ...penTestReport });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Real-time Bloom Filter Telemetry
apiRouter.get("/admin/bloom-stats", requireAdmin, async (_req, res) => {
  try {
    const stats = getBloomFilterDiagnostics();
    res.json({ success: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Test an ID / Scrip live against the Bloom Filter
apiRouter.get("/admin/bloom-test", requireAdmin, async (req, res) => {
  try {
    const testId = String(req.query.id || '').trim();
    if (!testId) {
      return res.status(400).json({ success: false, error: "Missing 'id' query parameter" });
    }

    const processedIndices = processedBloomFilter.getBitIndices(testId);
    const sentIndices = sentBloomFilter.getBitIndices(testId);
    const mightBeProcessed = processedBloomFilter.has(testId);
    const mightBeSent = sentBloomFilter.has(testId);
    const actuallyProcessed = await isAnnouncementProcessed(testId);
    const actuallySent = await isAnnouncementSent(testId);

    res.json({
      success: true,
      id: testId,
      processed: {
        mightBeInSet: mightBeProcessed,
        actuallyInSet: actuallyProcessed,
        bitIndices: processedIndices,
        bypassedDbScan: !mightBeProcessed
      },
      sent: {
        mightBeInSet: mightBeSent,
        actuallyInSet: actuallySent,
        bitIndices: sentIndices,
        bypassedDbScan: !mightBeSent
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});






