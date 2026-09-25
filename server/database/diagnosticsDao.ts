import { readLocalJson, writeLocalJson } from './localStore.js';
import { getSettings } from './settingsDao.js';
import { sendToTelegram } from '../services/telegram.js';
import { getBloomFilterDiagnostics } from './announcementDao.js';

export interface DeviceInfo {
  type: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'UNKNOWN';
  os: string;
  browser: string;
  screen: string;
  memoryMb?: number;
  connection?: string;
  isLowEndDevice?: boolean;
}

export interface PerformanceMetrics {
  pageLoadTimeMs?: number;
  ttfbMs?: number;
  domContentLoadedMs?: number;
  fcpMs?: number;
  lcpMs?: number;
  fidMs?: number;
  cls?: number;
  path?: string;
}

export interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING';
  breadcrumbs?: Array<{ action: string; category: string; timestamp: number; data?: any }>;
  url?: string;
  isApproved?: boolean;
  isMuted?: boolean;
}

export interface ApprovedBugRule {
  id: string;
  pattern: string;
  name: string;
  reason?: string;
  createdAt: number;
}

export interface ApiMetric {
  endpoint: string;
  latencyMs: number;
  status: number;
  success: boolean;
  errorMessage?: string;
}

export interface TelemetryEvent {
  id: string;
  type: 'PERFORMANCE' | 'ERROR' | 'WEB_VITAL' | 'API_METRIC' | 'DEVICE_INFO';
  timestamp: number;
  device: DeviceInfo;
  performance?: PerformanceMetrics;
  error?: ErrorDetails;
  api?: ApiMetric;
  userId?: string;
}

const DIAGNOSTICS_FILE = 'diagnostics.json';
const APPROVED_BUGS_FILE = 'approved_bugs.json';
const MAX_EVENTS = 500;
let lastCrashAlertTime = 0;
const CRASH_ALERT_COOLDOWN_MS = 60 * 1000; // 1 min cooldown per crash alert to avoid spamming

// Default benign approved bugs (e.g. harmless websocket reconnects in dev / safe timeouts)
const DEFAULT_APPROVED_BUGS: ApprovedBugRule[] = [
  {
    id: 'rule_vite_ws',
    pattern: 'websocket',
    name: 'WebSocket Connection / HMR Notice',
    reason: 'Benign dev server hot-reload socket connection notice in iframe preview',
    createdAt: Date.now()
  },
  {
    id: 'rule_ws_closed',
    pattern: 'closed without opened',
    name: 'WebSocket Closed Notice',
    reason: 'Client socket disconnect when HMR is inactive',
    createdAt: Date.now()
  },
  {
    id: 'rule_db_closing',
    pattern: 'Database is closing',
    name: 'Database Sleep Standby Notice',
    reason: 'Harmless tab suspension or standby notification',
    createdAt: Date.now()
  },
  {
    id: 'rule_resize_obs',
    pattern: 'ResizeObserver',
    name: 'Browser ResizeObserver Loop Notification',
    reason: 'Harmless browser layout cycle warning',
    createdAt: Date.now()
  },
  {
    id: 'rule_abort_err',
    pattern: 'AbortError',
    name: 'Fetch Request Aborted Notice',
    reason: 'Request cancelled on component unmount or rapid tab switch',
    createdAt: Date.now()
  }
];

export function getApprovedBugRules(): ApprovedBugRule[] {
  const rules = readLocalJson<ApprovedBugRule[]>(APPROVED_BUGS_FILE, DEFAULT_APPROVED_BUGS);
  if (!Array.isArray(rules) || rules.length === 0) {
    return DEFAULT_APPROVED_BUGS;
  }
  return rules;
}

export function saveApprovedBugRules(rules: ApprovedBugRule[]): void {
  writeLocalJson(APPROVED_BUGS_FILE, rules);
}

export function addApprovedBugRule(pattern: string, name?: string, reason?: string): ApprovedBugRule {
  const cleanPat = pattern.trim();
  const rules = getApprovedBugRules();
  let existing = rules.find(r => r.pattern.toLowerCase() === cleanPat.toLowerCase());
  
  if (!existing) {
    existing = {
      id: `bug_rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pattern: cleanPat,
      name: name?.trim() || cleanPat.substring(0, 40),
      reason: reason?.trim() || 'Approved / Muted as safe by Admin',
      createdAt: Date.now()
    };
    rules.unshift(existing);
    saveApprovedBugRules(rules);
  }

  // Retroactively update all stored events so they are immediately muted
  try {
    const store = getStore();
    let changed = false;
    for (const ev of store.events) {
      if (ev.error && isErrorApprovedOrMuted(ev.error.message, ev.error.stack)) {
        ev.error.isApproved = true;
        ev.error.isMuted = true;
        changed = true;
      }
    }
    if (changed) {
      saveStore(store);
    }
  } catch {}

  return existing;
}

export function deleteApprovedBugRule(id: string): boolean {
  const rules = getApprovedBugRules();
  const filtered = rules.filter(r => r.id !== id);
  if (filtered.length !== rules.length) {
    saveApprovedBugRules(filtered);
    return true;
  }
  return false;
}

export function isErrorApprovedOrMuted(errorMsg?: string, stack?: string): boolean {
  if (!errorMsg && !stack) return false;
  const rules = getApprovedBugRules();
  const target = `${errorMsg || ''} ${stack || ''}`.toLowerCase();
  
  return rules.some(rule => {
    try {
      const pat = (rule.pattern || '').toLowerCase();
      return pat.length > 0 && target.includes(pat);
    } catch {
      return false;
    }
  });
}

interface DiagnosticsStore {
  events: TelemetryEvent[];
  stats: {
    totalEventsCount: number;
    totalErrorsCount: number;
    totalPageViews: number;
    updatedAt: number;
  };
}

function getStore(): DiagnosticsStore {
  return readLocalJson<DiagnosticsStore>(DIAGNOSTICS_FILE, {
    events: [],
    stats: {
      totalEventsCount: 0,
      totalErrorsCount: 0,
      totalPageViews: 0,
      updatedAt: Date.now()
    }
  });
}

function saveStore(store: DiagnosticsStore) {
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(0, MAX_EVENTS);
  }
  store.stats.updatedAt = Date.now();
  writeLocalJson(DIAGNOSTICS_FILE, store);
}

export async function recordTelemetry(payload: Partial<TelemetryEvent>): Promise<TelemetryEvent> {
  const store = getStore();
  const id = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Check if error is approved / safe / muted
  let isApproved = false;
  if (payload.error) {
    isApproved = isErrorApprovedOrMuted(payload.error.message, payload.error.stack);
    payload.error.isApproved = isApproved;
    payload.error.isMuted = isApproved;
  }

  const event: TelemetryEvent = {
    id,
    type: payload.type || 'DEVICE_INFO',
    timestamp: payload.timestamp || Date.now(),
    device: payload.device || {
      type: 'UNKNOWN',
      os: 'Unknown OS',
      browser: 'Unknown Browser',
      screen: 'Unknown'
    },
    performance: payload.performance,
    error: payload.error,
    api: payload.api,
    userId: payload.userId
  };

  store.events.unshift(event);
  store.stats.totalEventsCount++;

  if (event.type === 'ERROR' || event.error) {
    if (!isApproved) {
      store.stats.totalErrorsCount++;
      // Trigger Telegram Alert for critical errors / uncaught crashes only if not muted / approved
      if (event.error?.severity === 'CRITICAL' || event.error?.severity === 'ERROR') {
        triggerCrashTelegramAlert(event).catch(() => {});
      }
    }
  }

  if (event.type === 'PERFORMANCE' || event.performance) {
    store.stats.totalPageViews++;
  }

  saveStore(store);
  return event;
}

export async function triggerCrashTelegramAlert(event: TelemetryEvent, force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && (now - lastCrashAlertTime < CRASH_ALERT_COOLDOWN_MS)) {
    return false;
  }

  try {
    const settings = await getSettings();
    // Check if global crash alert muting is enabled
    if (settings.muteCrashAlerts && !force) {
      return false;
    }

    if (!settings.botToken || !settings.chatId) return false;

    const errMsg = event.error?.message || 'Unknown Frontend Exception';
    
    // Check if approved / safe error
    if (!force && isErrorApprovedOrMuted(errMsg, event.error?.stack)) {
      return false;
    }

    const dev = event.device || ({} as any);
    const os = dev.os || 'Unknown OS';
    const browser = dev.browser || 'Unknown Browser';
    const devType = dev.type || 'UNKNOWN';
    const screen = dev.screen || 'N/A';
    const net = dev.connection ? `(${dev.connection.toUpperCase()})` : '';
    const url = event.error?.url || event.performance?.path || '/';

    let breadcrumbText = '';
    if (event.error?.breadcrumbs && event.error.breadcrumbs.length > 0) {
      const recent = event.error.breadcrumbs.slice(-3);
      breadcrumbText = `\n\n<b>Last User Actions:</b>\n` + recent.map((b, i) => `• ${b.action} [${b.category}]`).join('\n');
    }

    const message = `🚨 <b>Live Client Bug / Crash Alert</b>\n\n` +
      `<b>Error:</b> <code>${escapeHtml(errMsg.substring(0, 200))}</code>\n` +
      `<b>Device:</b> ${devType} | ${os} | ${browser} ${net}\n` +
      `<b>Screen:</b> ${screen}\n` +
      `<b>Page URL:</b> <code>${escapeHtml(url)}</code>` +
      breadcrumbText +
      `\n\n<i>Reported live by BSE Nexus In-House Telemetry</i>`;

    await sendToTelegram(message, settings.chatId);
    lastCrashAlertTime = now;
    return true;
  } catch (e: any) {
    console.error("Failed to send crash telegram alert:", e?.message);
    return false;
  }
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface DiagnosticsSummary {
  systemHealth: {
    status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
    score: number; // 0-100
    totalEvents: number;
    totalErrors: number;
    totalPageViews: number;
    crashFreeRate: number; // percentage e.g. 99.4%
    averageLoadTimeMs: number;
  };
  deviceBreakdown: {
    mobileCount: number;
    desktopCount: number;
    tabletCount: number;
    mobilePct: number;
    desktopPct: number;
    tabletPct: number;
  };
  osDistribution: Record<string, number>;
  browserDistribution: Record<string, number>;
  networkDistribution: Record<string, number>;
  performanceByDevice: {
    mobileAvgMs: number;
    desktopAvgMs: number;
    tabletAvgMs: number;
    fastConnectionAvgMs: number;
    slowConnectionAvgMs: number;
  };
  slowestPages: Array<{ path: string; avgLoadMs: number; samples: number }>;
  recentErrors: TelemetryEvent[];
  recentEvents: TelemetryEvent[];
  bloomFilter?: any;
}

export async function getDiagnosticsSummary(): Promise<DiagnosticsSummary> {
  const store = getStore();
  const events = store.events || [];

  let mobileCount = 0;
  let desktopCount = 0;
  let tabletCount = 0;

  const osMap: Record<string, number> = {};
  const browserMap: Record<string, number> = {};
  const networkMap: Record<string, number> = {};

  const mobileLoads: number[] = [];
  const desktopLoads: number[] = [];
  const tabletLoads: number[] = [];
  const fastLoads: number[] = [];
  const slowLoads: number[] = [];

  const pageLoadMap: Record<string, { totalMs: number; count: number }> = {};
  const recentErrors: TelemetryEvent[] = [];

  let totalLoadSum = 0;
  let loadSampleCount = 0;
  let totalErrors = 0;

  for (const ev of events) {
    // Device categorization
    const dtype = (ev.device?.type || '').toUpperCase();
    if (dtype === 'MOBILE') mobileCount++;
    else if (dtype === 'TABLET') tabletCount++;
    else desktopCount++;

    // OS
    const os = ev.device?.os || 'Unknown OS';
    osMap[os] = (osMap[os] || 0) + 1;

    // Browser
    const browser = ev.device?.browser || 'Unknown Browser';
    browserMap[browser] = (browserMap[browser] || 0) + 1;

    // Network
    const conn = (ev.device?.connection || '4g').toUpperCase();
    networkMap[conn] = (networkMap[conn] || 0) + 1;

    // Performance
    if (ev.performance?.pageLoadTimeMs && ev.performance.pageLoadTimeMs > 0) {
      const ms = ev.performance.pageLoadTimeMs;
      totalLoadSum += ms;
      loadSampleCount++;

      if (dtype === 'MOBILE') mobileLoads.push(ms);
      else if (dtype === 'TABLET') tabletLoads.push(ms);
      else desktopLoads.push(ms);

      if (conn === '4G' || conn === '5G' || conn === 'WIFI') {
        fastLoads.push(ms);
      } else {
        slowLoads.push(ms);
      }

      const p = ev.performance.path || '/';
      if (!pageLoadMap[p]) pageLoadMap[p] = { totalMs: 0, count: 0 };
      pageLoadMap[p].totalMs += ms;
      pageLoadMap[p].count++;
    }

    // Errors
    if (ev.type === 'ERROR' || ev.error) {
      const isApproved = isErrorApprovedOrMuted(ev.error?.message, ev.error?.stack);
      if (ev.error) {
        ev.error.isApproved = isApproved;
        ev.error.isMuted = isApproved;
      }

      if (!isApproved) {
        totalErrors++;
        if (recentErrors.length < 50) {
          recentErrors.push(ev);
        }
      }
    }
  }

  const totalDevices = Math.max(1, mobileCount + desktopCount + tabletCount);
  const avgLoadTime = loadSampleCount > 0 ? Math.round(totalLoadSum / loadSampleCount) : 480;
  
  const avg = (arr: number[], fallback: number) => 
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : fallback;

  const totalViews = Math.max(loadSampleCount, 1);
  const crashFreeRate = Math.max(0, Math.min(100, Number((((totalViews - totalErrors) / totalViews) * 100).toFixed(1))));

  let status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL' = 'OPTIMAL';
  let score = 98;

  if (totalErrors > 15 || crashFreeRate < 90 || avgLoadTime > 2500) {
    status = 'CRITICAL';
    score = Math.max(40, Math.round(crashFreeRate * 0.6));
  } else if (totalErrors > 3 || crashFreeRate < 98 || avgLoadTime > 1200) {
    status = 'DEGRADED';
    score = Math.max(70, Math.round(crashFreeRate * 0.85));
  }

  const slowestPages = Object.entries(pageLoadMap)
    .map(([path, data]) => ({
      path,
      avgLoadMs: Math.round(data.totalMs / data.count),
      samples: data.count
    }))
    .sort((a, b) => b.avgLoadMs - a.avgLoadMs)
    .slice(0, 10);

  return {
    systemHealth: {
      status,
      score,
      totalEvents: events.length,
      totalErrors,
      totalPageViews: loadSampleCount,
      crashFreeRate,
      averageLoadTimeMs: avgLoadTime
    },
    deviceBreakdown: {
      mobileCount,
      desktopCount,
      tabletCount,
      mobilePct: Math.round((mobileCount / totalDevices) * 100),
      desktopPct: Math.round((desktopCount / totalDevices) * 100),
      tabletPct: Math.round((tabletCount / totalDevices) * 100)
    },
    osDistribution: osMap,
    browserDistribution: browserMap,
    networkDistribution: networkMap,
    performanceByDevice: {
      mobileAvgMs: avg(mobileLoads, 620),
      desktopAvgMs: avg(desktopLoads, 340),
      tabletAvgMs: avg(tabletLoads, 490),
      fastConnectionAvgMs: avg(fastLoads, 390),
      slowConnectionAvgMs: avg(slowLoads, 1150)
    },
    slowestPages,
    recentErrors,
    recentEvents: events.slice(0, 30),
    bloomFilter: getBloomFilterDiagnostics()
  };
}

export async function clearDiagnostics(): Promise<void> {
  const store: DiagnosticsStore = {
    events: [],
    stats: {
      totalEventsCount: 0,
      totalErrorsCount: 0,
      totalPageViews: 0,
      updatedAt: Date.now()
    }
  };
  saveStore(store);
}
