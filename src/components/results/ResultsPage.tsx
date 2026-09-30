import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, ExternalLink, Loader2, AlertTriangle, CalendarDays } from 'lucide-react';
import { customFetch } from '../../api';
import { getSafePdfUrl } from '../../utils/pdfHelper';
import { resultsUrl, normalizeQuarterKey, parseShareablePath } from '../../utils/shareUrls';
import { ShareActionMenu } from '../ui/motion/ShareActionMenu';
import { SaveNoteButton } from '../notes/SaveNoteButton';
import { cn } from '../../lib/utils';

/**
 * Shareable results detail page — in-app interactive version of the SSR page
 * served at /results/:symbol/:quarterKey (public, no login required to view).
 * Matches the approved demo: quarter badge, headline, metrics, AI summary,
 * share + save note.
 */
export function ResultsPage({ onBack }: { onBack: () => void }) {
  const parsed = parseShareablePath(window.location.pathname);
  const symbol = parsed?.kind === 'results' ? parsed.symbol.toUpperCase() : '';
  const quarterKey = parsed?.kind === 'results' ? parsed.quarterKey : '';
  const targetKey = normalizeQuarterKey(quarterKey);

  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!symbol || !targetKey || !/^Q[1-4]FY\d{2}$/.test(targetKey)) {
      setError('This results link looks incomplete.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await customFetch(`/api/stock-results-history?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error('bad');
      const data = await res.json();
      const history: any[] = Array.isArray(data.history) ? data.history : [];
      const found = history.find((h: any) => normalizeQuarterKey(h.quarterKey || h.periodOrMeeting || '') === targetKey);
      if (!found) throw new Error('not-found');
      setItem(found);
    } catch {
      setError('We could not open these results. The quarter may not be declared yet.');
    } finally {
      setLoading(false);
    }
  }, [symbol, targetKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const companyName = item?.companyName || item?.companyShortName || symbol || 'Company';
  const meetingDate = item?.meetingDate || item?.boardMeetingDate || item?.declarationDate || '';
  const aiSummary = item?.aiSummary || item?.aiSummaryEn || '';
  const pdfLink = item?.pdfLink || item?.declaredDetails?.pdfUrl || '';
  const scripCode = item?.scripCode || '';
  const metrics = item?.financialMetrics || {};
  const pageUrl = symbol && targetKey ? resultsUrl(symbol, targetKey) : '';
  const isDeclared = item?.isOutcome || item?.status === 'DECLARED';

  const metricRows: Array<[string, string]> = [
    ['Revenue', metrics.revenueYoY],
    ['Net profit', metrics.netProfitYoY],
    ['Operating margin', metrics.operatingMargin],
    ['EPS', metrics.eps],
  ].filter(([, v]) => v) as Array<[string, string]>;

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-[#0F0E15]">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#171522]/90 backdrop-blur border-b border-slate-200/80 dark:border-[#2D283E]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to results calendar"
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-extrabold tracking-tight text-slate-900 dark:text-white">
            BSE <span className="text-emerald-500">Nexus</span>
          </span>
          <span className="ml-auto text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Results</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white dark:bg-[#171522] border border-slate-200/80 dark:border-[#2D283E] rounded-2xl p-10 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin text-violet-500" />
              <p className="text-sm font-medium">Opening results…</p>
            </div>
          </div>
        ) : error || !item ? (
          <div className="bg-white dark:bg-[#171522] border border-slate-200/80 dark:border-[#2D283E] rounded-2xl p-10 text-center">
            <AlertTriangle size={28} className="mx-auto text-amber-500 mb-3" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Results not available</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{error || 'These results could not be found.'}</p>
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity"
            >
              Back to results calendar
            </button>
          </div>
        ) : (
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-white dark:bg-[#171522] border border-slate-200/80 dark:border-[#2D283E] rounded-2xl p-5 sm:p-8 shadow-xs"
          >
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                {targetKey}
              </span>
              {isDeclared && (
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Declared
                </span>
              )}
              {symbol && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                  {symbol}
                </span>
              )}
              {meetingDate && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <CalendarDays size={13} />
                  {meetingDate}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug mb-2">
              {companyName}
            </h1>
            <h2 className="text-[15px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed pb-5 mb-5 border-b border-slate-200/80 dark:border-[#2D283E]">
              {targetKey} quarterly results{item?.subject ? ` — ${item.subject}` : ''}
            </h2>

            {metricRows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                {metricRows.map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 p-3 text-center">
                    <p className="text-[15px] font-extrabold text-slate-900 dark:text-white">{v}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{k} YoY</p>
                  </div>
                ))}
              </div>
            )}

            {aiSummary && (
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/30 border border-violet-200/70 dark:border-violet-800/50 p-4 sm:p-5 mb-5">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-violet-700 dark:text-violet-300 mb-2">
                  AI Summary
                </p>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{aiSummary}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {pdfLink && (
                <a
                  href={getSafePdfUrl(pdfLink, '', item.id || '', scripCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold',
                    'bg-slate-900 dark:bg-white text-white dark:text-slate-900',
                    'hover:opacity-90 transition-opacity cursor-pointer'
                  )}
                >
                  <FileText size={15} />
                  Open BSE PDF
                  <ExternalLink size={13} className="opacity-60" />
                </a>
              )}
              <SaveNoteButton
                variant="pill"
                link={{
                  type: 'result',
                  label: `${companyName} ${targetKey} results`,
                  symbol: symbol || undefined,
                }}
                label="Save note"
              />
              <ShareActionMenu
                title={`${companyName} (${symbol}) — ${targetKey} results`}
                headline={`${companyName} ${targetKey} quarterly results`}
                text={aiSummary ? String(aiSummary).slice(0, 140) : `${companyName} ${targetKey} results`}
                url={pageUrl}
                companyName={companyName}
                symbol={symbol}
                size="sm"
                buttonLabel="Share"
              />
            </div>
          </motion.article>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Disclosures sourced directly from BSE India public regulatory feeds.
        </p>
      </main>
    </div>
  );
}
