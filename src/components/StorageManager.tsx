import React, { useState, useEffect } from 'react';
import { 
  Database, HardDrive, ShieldCheck, Trash2, Send, 
  RefreshCw, CheckCircle2, AlertTriangle, AlertOctagon, 
  Sparkles, Layers, ListFilter, FileText, Info
} from 'lucide-react';
import { customFetch } from '../api';
import { ConfirmModal } from './ui/ConfirmModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StorageStatus {
  usagePercentage: number;
  estimatedDocCount: number;
  maxDocCapacity: number;
  announcementsCount: number;
  resultsCount: number;
  watchlistStocksCount: number;
  watchlistsCount: number;
  logsCount: number;
  isQuotaExceeded: boolean;
  protectedDataRetention: string;
  autoCleanupActive: boolean;
  lastCleanupTime: number;
  alertThresholds: {
    alerted50: boolean;
    alerted90: boolean;
    alerted100: boolean;
  };
  storageBreakdownKB: {
    announcementsKB: number;
    calendarKB: number;
    logsKB: number;
    totalDiskKB: number;
  };
}

export function StorageManager({ onRefresh }: { onRefresh?: () => void } = {}) {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);
  const [testingAlertLevel, setTestingAlertLevel] = useState<number | null>(null);
  const [alertFeedback, setAlertFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [storageMode, setStorageMode] = useState<'AUTO' | 'FORCE_LOCAL' | 'FORCE_FIRESTORE'>('AUTO');
  const [isQuotaExceededState, setIsQuotaExceededState] = useState(false);
  const [isPermissionDeniedState, setIsPermissionDeniedState] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);

  // Admin Percentage Pruning State
  const [prunePercentage, setPrunePercentage] = useState<number>(50);
  const [adminPin, setAdminPin] = useState<string>('');
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean>(false);
  const [isPruning, setIsPruning] = useState<boolean>(false);
  const [showPruneConfirm, setShowPruneConfirm] = useState<boolean>(false);
  const [pruneResult, setPruneResult] = useState<{ success: boolean; msg: string } | null>(null);

  const checkPinStatus = async () => {
    try {
      const res = await customFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setHasPinConfigured(!!data.hasAppPin);
      }
    } catch (e) {}
  };

  const handleAdminPrunePercentage = async () => {
    setIsPruning(true);
    setPruneResult(null);
    try {
      const res = await customFetch('/api/admin/announcements/prune-percentage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          percentage: prunePercentage,
          pin: adminPin
        })
      });
      const data = await res.json();
      if (data.success) {
        setPruneResult({
          success: true,
          msg: `Successfully pruned ${data.prunedCount} oldest generic filings (${prunePercentage}% of candidate pool). Remaining live items: ${data.remainingCount} (Safe floor active). Reclaimed ~${data.reclaimedSpaceKB} KB. Watchlists & Earnings records 100% untouched.`
        });
        if (data.report) setStatus(data.report);
      } else {
        setPruneResult({
          success: false,
          msg: data.error || 'Pruning operation failed.'
        });
      }
    } catch (err: any) {
      setPruneResult({
        success: false,
        msg: `Prune error: ${err.message}`
      });
    } finally {
      setIsPruning(false);
    }
  };

  const fetchStorageStatus = async () => {
    try {
      setLoading(true);
      const res = await customFetch('/api/storage/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch storage status:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageMode = async () => {
    try {
      const res = await customFetch('/api/storage/quota-mode');
      if (res.ok) {
        const data = await res.json();
        setStorageMode(data.mode || 'AUTO');
        setIsQuotaExceededState(data.isQuotaExceeded || false);
        setIsPermissionDeniedState(data.isPermissionDenied || false);
      }
    } catch (e) {
      console.error("Failed to fetch quota mode:", e);
    }
  };

  useEffect(() => {
    fetchStorageStatus();
    fetchStorageMode();
    checkPinStatus();
  }, []);

  const handleSetStorageMode = async (mode: 'AUTO' | 'FORCE_LOCAL' | 'FORCE_FIRESTORE') => {
    setModeSaving(true);
    try {
      const res = await customFetch('/api/storage/quota-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        const data = await res.json();
        setStorageMode(data.mode);
        setIsQuotaExceededState(data.isQuotaExceeded);
        setIsPermissionDeniedState(data.isPermissionDenied || false);
        fetchStorageStatus();
      }
    } catch (e) {
      console.error("Failed to update storage mode:", e);
    } finally {
      setModeSaving(false);
    }
  };

  const handleResetQuota = async () => {
    try {
      const res = await customFetch('/api/storage/reset-quota', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsQuotaExceededState(data.isQuotaExceeded);
        setIsPermissionDeniedState(data.isPermissionDenied || false);
        fetchStorageStatus();
      }
    } catch (e) {
      console.error("Failed to reset quota flag:", e);
    }
  };

  const handleRunCleanup = async () => {
    setCleaning(true);
    setCleanResult(null);
    try {
      const res = await customFetch('/api/storage/cleanup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCleanResult(`Auto-cleanup complete: Pruned ${data.prunedAnnouncements} noise records and ${data.prunedLogs} old logs. Reclaimed ~${data.reclaimedSpaceKB} KB.`);
        if (data.report) setStatus(data.report);
      } else {
        setCleanResult(`Cleanup notice: ${data.error || 'No items required pruning'}`);
      }
    } catch (err: any) {
      setCleanResult(`Cleanup error: ${err.message}`);
    } finally {
      setCleaning(false);
    }
  };

  const handleTestAlert = async (level: 50 | 90 | 100) => {
    setTestingAlertLevel(level);
    setAlertFeedback(null);
    try {
      const res = await customFetch('/api/storage/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      });
      const data = await res.json();
      if (data.success) {
        setAlertFeedback({
          success: true,
          msg: `Delivered test ${level}% storage alert to your Telegram chat!`
        });
      } else {
        setAlertFeedback({
          success: false,
          msg: `Failed to send alert: ${data.error || 'Please verify Telegram Bot Token & Chat ID in settings.'}`
        });
      }
    } catch (e: any) {
      setAlertFeedback({ success: false, msg: `Alert error: ${e.message}` });
    } finally {
      setTestingAlertLevel(null);
    }
  };

  const pct = status?.usagePercentage || 0;

  return (
    <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-6 shadow-xs space-y-6">
      
      {/* Header with Title & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Cloud Storage & Free Quota Optimizer
              </h3>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300 dark:border-emerald-800">
                Continuous Protection
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automated retention manager for Free Firestore quota, 1-2 year results archive, and Telegram threshold alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStorageStatus}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh Storage Status"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={handleRunCleanup}
            disabled={cleaning || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className={cn("w-3.5 h-3.5", cleaning && "animate-spin")} />
            <span>{cleaning ? 'Optimizing...' : 'Run Auto-Cleanup Now'}</span>
          </button>
        </div>
      </div>

      {/* Guaranteed Data Protection Badge (English & Hindi) */}
      <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-extrabold text-emerald-900 dark:text-emerald-200">
            Strict Data Retention Guarantee (1-2 Year Result & Watchlist Preservation)
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong>Never Deleted:</strong> All Watchlists, Watchlist Stocks, and Financial Results (Category: RESULTS & Outcomes) are locked and retained for <strong>1-2 years</strong>. Auto-cleanup only purges generic non-watchlist noise filings older than 60 days and old debug logs to keep you inside the 100% Free Quota.
          </p>
        </div>
      </div>

      {/* Storage & Quota Mode Selector (Automatic vs Manual Local Override) */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-500" />
              <span>Storage Quota Operating Mode (Automatic &amp; Manual Override)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Active Storage Backend: <strong className="text-slate-800 dark:text-slate-200 font-mono">
                {storageMode === 'FORCE_LOCAL'
                  ? '📁 Local JSON Storage (Manual Override)'
                  : (isQuotaExceededState || isPermissionDeniedState)
                    ? `📁 Local JSON Storage (${isQuotaExceededState ? 'Quota Exceeded' : 'Permission Backoff'})`
                    : '☁️ Firebase Firestore'}
              </strong>
            </p>
          </div>

          {(isQuotaExceededState || isPermissionDeniedState) && (
            <button
              type="button"
              onClick={handleResetQuota}
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-lg border border-amber-300 dark:border-amber-700 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              title="Clear quota and permission backoff flags and test Firestore connection"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Flags &amp; Retry Cloud</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleSetStorageMode('AUTO')}
            disabled={modeSaving}
            className={cn(
              "p-3 rounded-lg border text-left transition-all cursor-pointer",
              storageMode === 'AUTO'
                ? "bg-white dark:bg-slate-800 border-emerald-500 shadow-sm ring-1 ring-emerald-500"
                : "bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                <span>🔄 Automatic Mode</span>
              </span>
              {storageMode === 'AUTO' && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">Active</span>}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Cloud first. Automatically fails over to local disk storage if Google Cloud quota is exhausted.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSetStorageMode('FORCE_LOCAL')}
            disabled={modeSaving}
            className={cn(
              "p-3 rounded-lg border text-left transition-all cursor-pointer",
              storageMode === 'FORCE_LOCAL'
                ? "bg-white dark:bg-slate-800 border-blue-500 shadow-sm ring-1 ring-blue-500"
                : "bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                <span>📁 Force Local Mode</span>
              </span>
              {storageMode === 'FORCE_LOCAL' && <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold">Active</span>}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Zero cloud writes. Stores all watchlists and disclosures directly in local disk JSON files.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSetStorageMode('FORCE_FIRESTORE')}
            disabled={modeSaving}
            className={cn(
              "p-3 rounded-lg border text-left transition-all cursor-pointer",
              storageMode === 'FORCE_FIRESTORE'
                ? "bg-white dark:bg-slate-800 border-purple-500 shadow-sm ring-1 ring-purple-500"
                : "bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                <span>☁️ Force Cloud Mode</span>
              </span>
              {storageMode === 'FORCE_FIRESTORE' && <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded font-bold">Active</span>}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Always attempt Firestore database sync across all operations.
            </p>
          </button>
        </div>
      </div>


      {/* Live Capacity Progress Bar with 50%, 90%, 100% Markers */}
      <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-slate-700 dark:text-slate-300">Free Tier Quota Usage:</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-black",
              pct >= 100 ? "bg-rose-500 text-white" :
              pct >= 90 ? "bg-amber-500 text-white" :
              pct >= 50 ? "bg-blue-500 text-white" :
              "bg-emerald-500 text-white"
            )}>
              {pct}% Capacity
            </span>
          </div>
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {status?.estimatedDocCount.toLocaleString()} / {status?.maxDocCapacity.toLocaleString()} items
          </span>
        </div>

        {/* Multi-segmented Progress Bar */}
        <div className="relative w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500",
              pct >= 95 ? "bg-gradient-to-r from-amber-500 to-rose-600" :
              pct >= 75 ? "bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" :
              pct >= 45 ? "bg-gradient-to-r from-emerald-500 to-blue-500" :
              "bg-gradient-to-r from-teal-500 to-emerald-500"
            )}
            style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
          />

          {/* Threshold markers */}
          <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-white/70 dark:bg-black/70 pointer-events-none" title="50% Milestone Alert Threshold" />
          <div className="absolute top-0 bottom-0 left-[90%] w-0.5 bg-white/70 dark:bg-black/70 pointer-events-none" title="90% Warning Alert Threshold" />
        </div>

        {/* Threshold Markers Legend */}
        <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 pt-0.5">
          <span>0% Normal</span>
          <span className={cn(pct >= 50 ? "text-blue-600 dark:text-blue-400 font-extrabold" : "")}>50% Notice Alert</span>
          <span className={cn(pct >= 90 ? "text-amber-600 dark:text-amber-400 font-extrabold" : "")}>90% Warning Alert</span>
          <span className={cn(pct >= 100 ? "text-rose-600 dark:text-rose-400 font-extrabold" : "")}>100% Critical Alert</span>
        </div>
      </div>

      {/* Storage Breakdown Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            <span>Financial Results:</span>
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white">
            {status?.resultsCount ?? 0}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            1-2 Yr Archive Protected
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ListFilter className="w-3.5 h-3.5 text-blue-500" />
            <span>Watchlist Stocks:</span>
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white">
            {status?.watchlistStocksCount ?? 0}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
            {status?.watchlistsCount ?? 1} Watchlists Safe
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Layers className="w-3.5 h-3.5 text-purple-500" />
            <span>Live Announcements:</span>
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white">
            {status?.announcementsCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-400">
            ~{status?.storageBreakdownKB.announcementsKB ?? 0} KB
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Database className="w-3.5 h-3.5 text-amber-500" />
            <span>Engine Logs:</span>
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white">
            {status?.logsCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-400">
            Capped at 300 items
          </div>
        </div>
      </div>

      {/* Admin Manual Percentage Disclosure Pruning Control */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Admin Manual Disclosure Percentage Pruning (BSE Live Disclosures)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Choose percentage of oldest general announcements to prune at once. 
              <strong className="text-emerald-600 dark:text-emerald-400 ml-1">Strict Safety Floor &amp; Watchlist Lockdown Active</strong>.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
            Admin Controlled
          </span>
        </div>

        {/* Safety Floor & Lockdown Notice */}
        <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg text-[11px] text-amber-900 dark:text-amber-300 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Hard Safety Thresholds &amp; Permanent Lockdown Rules:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
            <li><strong>Watchlists Never Deleted:</strong> Watchlists, stock priorities, and saved watchlist files are 100% locked &amp; excluded from pruning. (No option to delete watchlist data).</li>
            <li><strong>Financial Results Protected:</strong> All quarterly outcomes &amp; earnings filings are strictly preserved.</li>
            <li><strong>Minimum Live Floor (100 items):</strong> At least 100 recent live terminal disclosures are always preserved regardless of percentage.</li>
          </ul>
        </div>

        {/* Percentage Selector Buttons and Custom Slider */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Prune Volume: <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm">{prunePercentage}%</strong> of eligible past noise filings
            </span>
            <div className="flex items-center gap-1.5">
              {[25, 50, 75, 90].map(pctVal => (
                <button
                  key={pctVal}
                  type="button"
                  onClick={() => setPrunePercentage(pctVal)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-md border transition-all cursor-pointer",
                    prunePercentage === pctVal
                      ? "bg-rose-500 text-white border-rose-600 shadow-2xs"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  )}
                >
                  {pctVal}%
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={prunePercentage}
            onChange={(e) => setPrunePercentage(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>10% (Gentle Trim)</span>
            <span>50% (Standard Balance)</span>
            <span>90% (Maximum Safe Cap)</span>
          </div>
        </div>

        {/* Admin PIN and Execute Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
          {hasPinConfigured && (
            <div className="relative flex-1">
              <input
                type="password"
                placeholder="Enter Admin PIN to authorize..."
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowPruneConfirm(true)}
            disabled={isPruning || (hasPinConfigured && !adminPin.trim())}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
          >
            <Trash2 className={cn("w-3.5 h-3.5", isPruning && "animate-spin")} />
            <span>{isPruning ? `Pruning ${prunePercentage}%...` : `Execute ${prunePercentage}% Safe Prune`}</span>
          </button>
        </div>

        {/* Item 16: Confirmation Modal for Storage Prune */}
        <ConfirmModal
          isOpen={showPruneConfirm}
          title={`Confirm ${prunePercentage}% Storage Prune`}
          description={`Are you sure you want to prune ${prunePercentage}% of older non-starred announcements and logs? All protected financial results, starred alerts, and watchlist stocks will remain intact.`}
          confirmText="Yes, Prune Now"
          cancelText="Cancel"
          isDestructive={true}
          onConfirm={() => {
            setShowPruneConfirm(false);
            handleAdminPrunePercentage();
          }}
          onCancel={() => setShowPruneConfirm(false)}
        />

        {pruneResult && (
          <div className={cn(
            "p-3 rounded-lg text-xs font-medium flex items-center gap-2",
            pruneResult.success
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          )}>
            {pruneResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
            <span>{pruneResult.msg}</span>
          </div>
        )}
      </div>

      {/* Manual Telegram Alert Test Suite (50%, 90%, 100%) */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              <span>Telegram Storage Alert Dispatcher (50%, 90%, 100%)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              The engine automatically alerts Telegram at 50%, 90%, and 100%. You can test any alert notification level below:
            </p>
          </div>
        </div>

        {alertFeedback && (
          <div className={cn(
            "p-3 rounded-lg text-xs font-medium flex items-center gap-2",
            alertFeedback.success 
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          )}>
            {alertFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
            <span>{alertFeedback.msg}</span>
          </div>
        )}

        {cleanResult && (
          <div className="p-3 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {cleanResult}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleTestAlert(50)}
            disabled={testingAlertLevel !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className={cn("w-3 h-3", testingAlertLevel === 50 && "animate-spin")} />
            <span>{testingAlertLevel === 50 ? 'Dispatching...' : 'Test 50% Notice Alert'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTestAlert(90)}
            disabled={testingAlertLevel !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <AlertTriangle className={cn("w-3 h-3", testingAlertLevel === 90 && "animate-spin")} />
            <span>{testingAlertLevel === 90 ? 'Dispatching...' : 'Test 90% Warning Alert'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTestAlert(100)}
            disabled={testingAlertLevel !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <AlertOctagon className={cn("w-3 h-3", testingAlertLevel === 100 && "animate-spin")} />
            <span>{testingAlertLevel === 100 ? 'Dispatching...' : 'Test 100% Critical Alert'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
