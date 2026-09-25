import React, { useState } from 'react';
import { 
  Activity, Sparkles, RefreshCw, Trash2, AlertTriangle, 
  Filter, Search, XCircle, CheckCircle2, Info, Send, Radio, Check, Copy
} from 'lucide-react';
import { customFetch } from '../api';
import { ActionButton } from './ui/ActionButton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function LogsTab({ logs, onRefreshLogs }: { logs: any[]; onRefreshLogs?: () => void }) {
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const itemsPerPage = 60;

  // Counts for live telemetry
  const totalCount = logs.length;
  const geminiCount = logs.filter(l => (l.module || '').toUpperCase() === 'GEMINI').length;
  const errorCount = logs.filter(l => (l.level || '').toUpperCase() === 'ERROR' || (l.level || '').toUpperCase() === 'CRITICAL').length;
  const warningCount = logs.filter(l => (l.level || '').toUpperCase() === 'WARNING').length;
  const telegramCount = logs.filter(l => (l.module || '').toUpperCase() === 'TELEGRAM').length;
  const bseCount = logs.filter(l => (l.module || '').toUpperCase() === 'BSE').length;

  const filteredLogs = logs.filter((log: any) => {
    const logLev = (log.level || '').toUpperCase();
    const logMod = (log.module || '').toUpperCase();

    if (levelFilter !== 'ALL' && logLev !== levelFilter) return false;
    if (moduleFilter !== 'ALL' && logMod !== moduleFilter) return false;

    if (search) {
      const q = search.toLowerCase();
      return (log.message || '').toLowerCase().includes(q) || logMod.toLowerCase().includes(q) || logLev.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleCopyLog = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all engine activity logs?")) return;
    setIsClearing(true);
    try {
      await customFetch('/api/logs', { method: 'DELETE' });
      if (onRefreshLogs) onRefreshLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  };

  const handleTestAi = async () => {
    setIsTestingAi(true);
    try {
      await customFetch('/api/test-gemini', { method: 'POST' });
      if (onRefreshLogs) onRefreshLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsTestingAi(false);
    }
  };

  const modules = [
    { id: 'ALL', label: 'All Sources', count: totalCount },
    { id: 'GEMINI', label: 'Gemini AI', count: geminiCount },
    { id: 'BSE', label: 'BSE Stream', count: bseCount },
    { id: 'TELEGRAM', label: 'Telegram Bot', count: telegramCount },
    { id: 'MONITOR', label: 'Engine Monitor', count: logs.filter(l => (l.module || '').toUpperCase() === 'MONITOR').length },
    { id: 'SYSTEM', label: 'System', count: logs.filter(l => (l.module || '').toUpperCase() === 'SYSTEM').length },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <Activity className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <span>Engine Activity & Diagnostics</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Live operational logs for AI summarization, BSE feed ingestion, and Telegram alerts</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            onClick={handleTestAi}
            isLoading={isTestingAi}
            loadingText="Testing AI..."
            variant="primary"
            size="sm"
            className="text-xs font-bold"
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
          >
            Test Gemini AI
          </ActionButton>

          {onRefreshLogs && (
            <ActionButton
              onClick={onRefreshLogs}
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5 text-slate-400" />}
            >
              Refresh
            </ActionButton>
          )}

          <ActionButton
            onClick={handleClearLogs}
            isLoading={isClearing}
            loadingText="Clearing..."
            disabled={logs.length === 0}
            variant="danger"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Clear Logs
          </ActionButton>
        </div>
      </div>

      {/* Live Operational Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Summaries</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">{geminiCount}</div>
        </div>

        <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Errors & Quotas</span>
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">{errorCount}</div>
        </div>

        <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Warnings</span>
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">{warningCount}</div>
        </div>

        <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Total Log Records</span>
          </div>
          <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 font-mono">{totalCount}</div>
        </div>
      </div>

      {/* Categorized Filter Ribbons */}
      <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-3.5 shadow-xs space-y-3">
        {/* Module / Subsystem Categories */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Module Category:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {modules.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setModuleFilter(m.id); setPage(1); }}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  moduleFilter === m.id
                    ? "bg-slate-900 dark:bg-[#2A263D] text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#252233]"
                )}
              >
                <span>{m.label}</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  moduleFilter === m.id ? "bg-white/20 dark:bg-black/20 text-inherit" : "bg-white dark:bg-[#15141F] text-slate-500"
                )}>
                  {m.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Level and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-[#2D283E]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Level:</span>
            {[
              { id: 'ALL', label: 'All Levels' },
              { id: 'ERROR', label: 'Errors', bg: 'bg-rose-600 text-white' },
              { id: 'WARNING', label: 'Warnings', bg: 'bg-amber-600 text-white' },
              { id: 'SUCCESS', label: 'Success', bg: 'bg-slate-900 dark:bg-[#2A263D] text-white' },
              { id: 'INFO', label: 'Info', bg: 'bg-indigo-600 text-white' },
            ].map(lvl => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => { setLevelFilter(lvl.id); setPage(1); }}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  levelFilter === lvl.id
                    ? (lvl.bg || "bg-slate-900 text-white")
                    : "bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252233]"
                )}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search in log message or module..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 w-full sm:w-64 font-mono text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Logs Table / Stream Container */}
      <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-y-auto max-h-[580px] p-2 divide-y divide-slate-100 dark:divide-[#2D283E]/60 font-mono text-xs">
          {paginatedLogs.map((log: any, i: number) => {
            const isError = log.level === 'ERROR' || log.level === 'CRITICAL';
            const isSuccess = log.level === 'SUCCESS';
            const isWarning = log.level === 'WARNING';
            const mod = (log.module || '').toUpperCase();
            const isGemini = mod === 'GEMINI';
            const isTelegram = mod === 'TELEGRAM';
            const isBse = mod === 'BSE';

            const logId = log.id || `${log.timestamp}-${i}`;
            const isCopied = copiedId === logId;

            return (
              <div 
                key={logId} 
                className="py-2.5 px-2.5 flex flex-col sm:flex-row sm:items-start gap-2.5 hover:bg-slate-50 dark:hover:bg-[#222030]/60 rounded-lg transition-colors group"
              >
                {/* Time & Level Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400 text-[11px] font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>

                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] font-bold rounded-sm uppercase tracking-wider flex items-center gap-1",
                    isError ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                    isSuccess ? 'bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#38324E]' :
                    isWarning ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                    'bg-slate-100 dark:bg-[#201E2E] text-slate-600 dark:text-slate-400'
                  )}>
                    {isError ? <XCircle className="w-3 h-3" /> : isSuccess ? <CheckCircle2 className="w-3 h-3" /> : isWarning ? <AlertTriangle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                    <span>{log.level}</span>
                  </span>

                  {/* Module Badge */}
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase tracking-wider shrink-0 flex items-center gap-1",
                    isGemini ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800' :
                    isTelegram ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
                    isBse ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                    'bg-slate-100 dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2D283E]'
                  )}>
                    {isGemini && <Sparkles className="w-2.5 h-2.5 text-amber-500" />}
                    {isTelegram && <Send className="w-2.5 h-2.5 text-blue-500" />}
                    {isBse && <Radio className="w-2.5 h-2.5 text-amber-500" />}
                    <span>{log.module}</span>
                  </span>
                </div>

                {/* Message Body */}
                <div className="text-slate-800 dark:text-slate-200 break-words flex-1 leading-relaxed text-xs">
                  {log.message}
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => handleCopyLog(`[${new Date(log.timestamp).toISOString()}] [${log.level}] [${log.module}] ${log.message}`, logId)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                  title="Copy log entry"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}

          {paginatedLogs.length === 0 && (
            <div className="text-slate-400 py-16 text-center text-xs space-y-2">
              <Activity className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-500">No log entries match the current module or level filter.</p>
              <p className="text-[11px]">Click "All Sources" or clear the search query to see full engine logs.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 dark:bg-[#15141F] border-t border-slate-200 dark:border-[#2D283E] flex justify-between items-center text-xs">
            <button 
              onClick={() => setPage(Math.max(1, page - 1))} 
              disabled={page === 1} 
              className="px-3 py-1.5 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-md disabled:opacity-40 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs"
            >
              Previous
            </button>
            <span className="text-slate-500 font-mono font-medium">Page {page} of {totalPages} ({filteredLogs.length} entries)</span>
            <button 
              onClick={() => setPage(Math.min(totalPages, page + 1))} 
              disabled={page === totalPages} 
              className="px-3 py-1.5 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-md disabled:opacity-40 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
