import React, { useState, useEffect } from 'react';
import { 
  Activity, ShieldCheck, AlertTriangle, Smartphone, Laptop, Tablet, 
  RefreshCw, Trash2, Send, Clock, Globe, Cpu, Wifi, 
  ExternalLink, Search, Check, AlertCircle, BarChart3, ChevronRight, X, Copy, Zap,
  BellOff, Bell, Shield, Plus, CheckCircle2, Sliders, Filter
} from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';

interface ApprovedBugRule {
  id: string;
  pattern: string;
  name: string;
  reason?: string;
  createdAt: number;
}

interface DiagnosticsData {
  systemHealth: {
    status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
    score: number;
    totalEvents: number;
    totalErrors: number;
    totalPageViews: number;
    crashFreeRate: number;
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
  recentErrors: any[];
  recentEvents: any[];
  backendServices?: {
    bse: { status: string; latency?: number };
    telegram: { status: string; latency?: number };
    database: { status: string; storageMode?: string };
  };
}

export function AdminDiagnostics() {
  const { isAdmin, adminUnlocked } = useAuth();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedError, setSelectedError] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'ERROR'>('ALL');
  const [copiedStack, setCopiedStack] = useState(false);
  const [testAlertLoading, setTestAlertLoading] = useState(false);
  const [testAlertToast, setTestAlertToast] = useState<{ msg: string; success: boolean } | null>(null);

  // Bug Muting & Whitelist State
  const [muteCrashAlerts, setMuteCrashAlerts] = useState(false);
  const [isTogglingMute, setIsTogglingMute] = useState(false);
  const [approvedRulesModalOpen, setApprovedRulesModalOpen] = useState(false);
  const [approvedRules, setApprovedRules] = useState<ApprovedBugRule[]>([]);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleReason, setNewRuleReason] = useState('');
  const [isAddingRule, setIsAddingRule] = useState(false);

  useBodyScrollLock(Boolean(selectedError || approvedRulesModalOpen));

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      const res = await customFetch('/api/admin/diagnostics');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (typeof json.muteCrashAlerts === 'boolean') {
          setMuteCrashAlerts(json.muteCrashAlerts);
        }
      }

      // Fetch settings to get mute status
      const settingsRes = await customFetch('/api/settings');
      if (settingsRes.ok) {
        const setJson = await settingsRes.json();
        if (typeof setJson.muteCrashAlerts === 'boolean') {
          setMuteCrashAlerts(setJson.muteCrashAlerts);
        }
      }
    } catch (e) {
      console.error("Failed to fetch diagnostics:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedRules = async () => {
    try {
      const res = await customFetch('/api/admin/diagnostics/approved-bugs');
      if (res.ok) {
        const json = await res.json();
        setApprovedRules(json.rules || []);
      }
    } catch (e) {
      console.error("Failed to fetch approved bug rules:", e);
    }
  };

  useEffect(() => {
    if (!isAdmin && !adminUnlocked) return;
    fetchDiagnostics();
    fetchApprovedRules();
  }, [isAdmin, adminUnlocked]);

  useVisibilityInterval(fetchDiagnostics, 15000, Boolean((isAdmin || adminUnlocked) && autoRefresh));

  const handleToggleMuteAlerts = async () => {
    try {
      setIsTogglingMute(true);
      const nextState = !muteCrashAlerts;
      // Optimistically update UI
      setMuteCrashAlerts(nextState);
      
      const res = await customFetch('/api/admin/diagnostics/toggle-mute-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mute: nextState })
      });
      if (res.ok) {
        const json = await res.json();
        setMuteCrashAlerts(Boolean(json.muteCrashAlerts));
        setTestAlertToast({
          msg: json.muteCrashAlerts 
            ? "🔕 Bug alerts to Telegram are now MUTED globally." 
            : "🔔 Bug alerts to Telegram are now UNMUTED (Live).",
          success: true
        });
        setTimeout(() => setTestAlertToast(null), 4000);
      }
    } catch (err) {
      alert("Failed to toggle bug alerts muting");
    } finally {
      setIsTogglingMute(false);
    }
  };

  const handleApproveBug = async (pattern: string, name?: string, reason?: string) => {
    if (!pattern.trim()) return;
    try {
      setIsAddingRule(true);
      // Optimistically filter from state immediately
      setData((prev: any) => {
        if (!prev) return prev;
        const filtered = (prev.recentErrors || []).filter((err: any) => {
          const msg = (err.error?.message || '').toLowerCase();
          return !msg.includes(pattern.trim().toLowerCase());
        });
        return {
          ...prev,
          recentErrors: filtered,
          systemHealth: {
            ...prev.systemHealth,
            totalErrors: Math.max(0, (prev.systemHealth?.totalErrors || 1) - 1)
          }
        };
      });

      const res = await customFetch('/api/admin/diagnostics/approved-bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: pattern.trim(),
          name: name || pattern.substring(0, 40),
          reason: reason || 'Approved & Muted as safe by Admin'
        })
      });
      if (res.ok) {
        const json = await res.json();
        setApprovedRules(json.rules || []);
        setTestAlertToast({
          msg: `✅ Bug pattern "${pattern.substring(0, 30)}..." approved and muted!`,
          success: true
        });
        setTimeout(() => setTestAlertToast(null), 4000);
        setSelectedError(null);
        fetchDiagnostics();
        fetchApprovedRules();
      }
    } catch (err) {
      alert("Failed to approve bug pattern");
    } finally {
      setIsAddingRule(false);
    }
  };

  const handleDeleteApprovedRule = async (ruleId: string) => {
    try {
      const res = await customFetch(`/api/admin/diagnostics/approved-bugs/${ruleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const json = await res.json();
        setApprovedRules(json.rules || []);
      }
    } catch (err) {
      alert("Failed to remove rule");
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all diagnostics and crash logs?")) return;
    try {
      const res = await customFetch('/api/admin/diagnostics/clear', { method: 'POST' });
      if (res.ok) {
        fetchDiagnostics();
      }
    } catch (e) {
      alert("Failed to clear logs");
    }
  };

  const handleSendTestAlert = async () => {
    try {
      setTestAlertLoading(true);
      const res = await customFetch('/api/admin/diagnostics/test-alert', { method: 'POST' });
      const json = await res.json();
      setTestAlertToast({ msg: json.message, success: json.success });
      setTimeout(() => setTestAlertToast(null), 5000);
    } catch (e: any) {
      setTestAlertToast({ msg: e.message || "Failed to trigger test alert", success: false });
      setTimeout(() => setTestAlertToast(null), 5000);
    } finally {
      setTestAlertLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStack(true);
    setTimeout(() => setCopiedStack(false), 2000);
  };

  if (!isAdmin && !adminUnlocked) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin Access Required</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          System Health, Bug Diagnostics & Performance Telemetry are strictly reserved for the Administrator.
        </p>
      </div>
    );
  }

  const errors = (data?.recentErrors || []).filter(err => {
    const msg = err.error?.message || '';
    const dev = `${err.device?.os || ''} ${err.device?.browser || ''} ${err.device?.type || ''}`;
    const matchesSearch = msg.toLowerCase().includes(searchQuery.toLowerCase()) || dev.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSev = severityFilter === 'ALL' ? true : err.error?.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast alert */}
      {testAlertToast && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg transition-all ${
          testAlertToast.success 
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" 
            : "bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2.5">
            {testAlertToast.success ? <Check className="w-5 h-5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
            <span>{testAlertToast.msg}</span>
          </div>
          <button onClick={() => setTestAlertToast(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#1A1926] p-5 rounded-2xl border border-slate-200/90 dark:border-[#2D283E] shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-500" />
              System Health & Diagnostics Center
            </h1>
            <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Admin Exclusive
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-Time Bug Diagnostics • Telegram Crash Alert Control • Whitelist Safe Bugs
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Mute Bug Reports Toggle */}
          <button
            onClick={handleToggleMuteAlerts}
            disabled={isTogglingMute}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${
              muteCrashAlerts
                ? "bg-amber-500 text-white border-amber-600 dark:bg-amber-600 dark:border-amber-700 shadow-xs"
                : "bg-slate-100 dark:bg-[#252236] hover:bg-slate-200 dark:hover:bg-[#2F2B44] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#352F48]"
            }`}
            title="Toggle Telegram alerts for frontend bug & crash telemetry"
          >
            {muteCrashAlerts ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4 text-emerald-500" />}
            <span>{muteCrashAlerts ? "Bug Alerts: MUTED" : "Bug Alerts: ACTIVE"}</span>
          </button>

          {/* Manage Approved / Safe Bugs */}
          <button
            onClick={() => {
              fetchApprovedRules();
              setApprovedRulesModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all cursor-pointer active:scale-95"
            title="Manage whitelist of approved and muted bugs that do not trigger alerts"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Approved Bugs ({approvedRules.length})</span>
          </button>

          <button
            onClick={handleSendTestAlert}
            disabled={testAlertLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Sends a simulated crash test alert to your configured Telegram Chat"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testAlertLoading ? "Sending..." : "Test Alert"}</span>
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer active:scale-95 ${
              autoRefresh 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" 
                : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#2A263D] dark:text-slate-300 dark:border-[#3E3854]"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            <span>{autoRefresh ? "Live 15s" : "Off"}</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-rose-50 dark:bg-[#242033] dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200 dark:border-[#3E3854] hover:border-rose-200 dark:hover:border-rose-800 transition-all cursor-pointer active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 4 Core Health Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health Score */}
        <div className="bg-white dark:bg-[#1A1926] p-4.5 rounded-2xl border border-slate-200/90 dark:border-[#2D283E] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-400">
            <span>HEALTH SCORE</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
              data?.systemHealth?.status === 'OPTIMAL' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' :
              data?.systemHealth?.status === 'DEGRADED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' :
              'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
            }`}>
              {data?.systemHealth?.status || 'OPTIMAL'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {data?.systemHealth?.score ?? 99}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Engine Stability</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#2A263D] h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${data?.systemHealth?.score ?? 99}%` }}
            />
          </div>
        </div>

        {/* Crash Free Rate */}
        <div className="bg-white dark:bg-[#1A1926] p-4.5 rounded-2xl border border-slate-200/90 dark:border-[#2D283E] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-400">
            <span>CRASH-FREE SESSIONS</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {data?.systemHealth?.crashFreeRate ?? 99.8}%
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Clean Runs</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Muted benign bugs are excluded
          </p>
        </div>

        {/* Average Page Load Time */}
        <div className="bg-white dark:bg-[#1A1926] p-4.5 rounded-2xl border border-slate-200/90 dark:border-[#2D283E] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-400">
            <span>AVG LOAD SPEED</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {data?.systemHealth?.averageLoadTimeMs ?? 420}<span className="text-sm font-bold text-slate-400">ms</span>
            </span>
            <span className="text-[11px] font-bold px-1.5 py-0.2 rounded text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
              ⚡ Fast
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Navigation Timing & DOM Interactive
          </p>
        </div>

        {/* Active Users Device Ratio */}
        <div className="bg-white dark:bg-[#1A1926] p-4.5 rounded-2xl border border-slate-200/90 dark:border-[#2D283E] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-400">
            <span>DEVICE SPLIT</span>
            <Smartphone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-3 text-xs font-bold">
            <span className="flex items-center gap-1 text-slate-900 dark:text-white">
              <Smartphone className="w-3.5 h-3.5 text-blue-500" /> {data?.deviceBreakdown?.mobilePct ?? 65}% Mob
            </span>
            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
              <Laptop className="w-3.5 h-3.5 text-emerald-500" /> {data?.deviceBreakdown?.desktopPct ?? 35}% PC
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Live client screen & OS telemetry
          </p>
        </div>
      </div>

      {/* Live Bug & Crash Log Table */}
      <div className="bg-white dark:bg-[#1A1926] p-5 rounded-2xl border border-slate-200/90 dark:border-[#2D283E] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Live Bug & Crash Reports
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Captured real-time from user devices. Click any error to inspect or approve/mute it.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search error, device, or OS..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#252236] border border-slate-200 dark:border-[#352F48] rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 w-48 sm:w-64"
              />
            </div>

            <select
              value={severityFilter}
              onChange={(e: any) => setSeverityFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-slate-50 dark:bg-[#252236] border border-slate-200 dark:border-[#352F48] rounded-xl text-slate-800 dark:text-slate-200 font-bold"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="ERROR">Errors Only</option>
            </select>
          </div>
        </div>

        {errors.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-[#201E2E] rounded-xl border border-dashed border-slate-200 dark:border-[#302B42] space-y-2">
            <Check className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Zero Active Crashes / Bugs</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              All client sessions are running smoothly across mobile and desktop devices.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#2D283E] overflow-x-auto">
            {errors.map((err, idx) => (
              <div 
                key={err.id || idx}
                onClick={() => setSelectedError(err)}
                className="py-3.5 px-2 hover:bg-slate-50 dark:hover:bg-[#221F33] rounded-xl transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      err.error?.severity === 'CRITICAL' 
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    }`}>
                      {err.error?.severity || 'ERROR'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {err.error?.message || 'Unknown Exception'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-slate-400" />
                      {err.device?.os || 'Unknown OS'} • {err.device?.browser || 'Unknown'} ({err.device?.screen || 'N/A'})
                    </span>
                    <span>•</span>
                    <span>{new Date(err.timestamp).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span className="text-purple-600 dark:text-purple-400 font-mono text-[10px]">
                      {err.error?.url || '/'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveBug(err.error?.message || '', undefined, 'Approved from crash log');
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-all border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                    title="Approve this error message so it never triggers crash alerts"
                  >
                    <Shield className="w-3 h-3" />
                    <span>Approve & Mute</span>
                  </button>

                  <button className="px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center gap-1">
                    <span>Inspect</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Details Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-white dark:bg-[#1A1926] max-w-2xl w-full rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 overscroll-contain">
            {/* Modal Header */}
            <div className="p-4.5 border-b border-slate-100 dark:border-[#2D283E] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Bug Diagnostics & Trace</h3>
              </div>
              <button 
                onClick={() => setSelectedError(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Error Message & Details */}
              <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-xl space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  {selectedError.error?.severity || 'ERROR'} MESSAGE
                </span>
                <p className="text-sm font-bold text-rose-900 dark:text-rose-200 font-mono">
                  {selectedError.error?.message}
                </p>
              </div>

              {/* Device Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-slate-50 dark:bg-[#221F33] rounded-xl border border-slate-200/70 dark:border-[#2E2942] space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Device Type</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{selectedError.device?.type}</p>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-[#221F33] rounded-xl border border-slate-200/70 dark:border-[#2E2942] space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">OS</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{selectedError.device?.os}</p>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-[#221F33] rounded-xl border border-slate-200/70 dark:border-[#2E2942] space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Browser</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{selectedError.device?.browser}</p>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-[#221F33] rounded-xl border border-slate-200/70 dark:border-[#2E2942] space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Resolution</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{selectedError.device?.screen}</p>
                </div>
              </div>

              {/* User Breadcrumbs */}
              {selectedError.error?.breadcrumbs && selectedError.error.breadcrumbs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    User Click Breadcrumbs (Before Crash)
                  </span>
                  <div className="p-3 bg-slate-50 dark:bg-[#221F33] rounded-xl border border-slate-200/70 dark:border-[#2E2942] space-y-1.5">
                    {selectedError.error.breadcrumbs.map((b: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="text-slate-400 font-mono text-[10px]">{i + 1}.</span>
                        <span className="font-semibold">{b.action}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-[#342E4C] text-slate-600 dark:text-slate-300">
                          {b.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {selectedError.error?.stack && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Stack Trace</span>
                    <button
                      onClick={() => copyToClipboard(selectedError.error.stack)}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      {copiedStack ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedStack ? "Copied" : "Copy Trace"}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                    {selectedError.error.stack}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer with Direct Approve Button */}
            <div className="p-4 border-t border-slate-100 dark:border-[#2D283E] bg-slate-50/50 dark:bg-[#201D2E] flex items-center justify-between gap-3">
              <button
                onClick={() => handleApproveBug(selectedError.error?.message || '', undefined, 'Approved from crash inspector')}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Approve & Mute This Bug</span>
              </button>

              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-[#2D283E] dark:hover:bg-[#3E3854] text-slate-800 dark:text-white rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approved Bugs & Whitelist Modal */}
      {approvedRulesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-white dark:bg-[#1A1926] max-w-2xl w-full rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 overscroll-contain">
            <div className="p-4.5 border-b border-slate-100 dark:border-[#2D283E] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Approved & Muted Bug Rules</h3>
              </div>
              <button 
                onClick={() => setApprovedRulesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 overscroll-contain">
              {/* Add New Rule Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#221F33] border border-slate-200/80 dark:border-[#352F48] space-y-3">
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5 text-blue-500" />
                  Add Custom Bug Pattern To Whitelist
                </h4>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Error text or pattern e.g., 'ResizeObserver loop' or 'Network timeout'"
                    value={newRulePattern}
                    onChange={e => setNewRulePattern(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#3E3854] rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Rule Title / Nickname (Optional)"
                      value={newRuleName}
                      onChange={e => setNewRuleName(e.target.value)}
                      className="px-3 py-2 text-xs bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#3E3854] rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Reason e.g., Harmless benign drop"
                      value={newRuleReason}
                      onChange={e => setNewRuleReason(e.target.value)}
                      className="px-3 py-2 text-xs bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#3E3854] rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    disabled={!newRulePattern.trim() || isAddingRule}
                    onClick={() => {
                      handleApproveBug(newRulePattern, newRuleName, newRuleReason);
                      setNewRulePattern('');
                      setNewRuleName('');
                      setNewRuleReason('');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isAddingRule ? "Saving..." : "Add to Whitelist (Mute)"}
                  </button>
                </div>
              </div>

              {/* Active Rules List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Active Approved Rules ({approvedRules.length})
                </span>

                {approvedRules.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No approved bug rules active.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-[#2D283E]">
                    {approvedRules.map(rule => (
                      <div key={rule.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{rule.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold">
                              MUTED / SAFE
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            Pattern: "{rule.pattern}"
                          </p>
                          {rule.reason && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              Reason: {rule.reason}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteApprovedRule(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all cursor-pointer shrink-0"
                          title="Unmute / Remove this rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-[#2D283E] bg-slate-50/50 dark:bg-[#201D2E] flex justify-end">
              <button
                onClick={() => setApprovedRulesModalOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-[#2D283E] dark:hover:bg-[#3E3854] text-slate-800 dark:text-white rounded-xl transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
