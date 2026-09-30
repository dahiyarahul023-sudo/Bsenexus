import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { customFetch } from '../../api';
import { getSafePdfUrl } from '../../utils/pdfHelper';
import { filingUrl, parseShareablePath } from '../../utils/shareUrls';
import { ShareActionMenu } from '../ui/motion/ShareActionMenu';
import { SaveNoteButton } from '../notes/SaveNoteButton';
import { cn } from '../../lib/utils';

/**
 * Shareable filing detail page — in-app interactive version of the SSR page
 * served at /filing/:symbol/:newsId (public, no login required to view).
 * Matches the approved demo: headline, meta, AI summary, PDF, save note,
 * share, related filings.
 */
export function FilingPage({ onBack }: { onBack: () => void }) {
  const parsed = parseShareablePath(window.location.pathname);
  const symbol = parsed?.kind === 'filing' ? parsed.symbol.toUpperCase() : '';
  const newsId = parsed?.kind === 'filing' ? parsed.newsId : '';

  const [item, setItem] = useState<any | null>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!symbol || !newsId) {
      setError('This filing link looks incomplete.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await customFetch(`/api/announcements/${encodeURIComponent(newsId)}`);
      if (!res.ok) throw new Error('not-found');
      const data = await res.json();
      const itemSymbol = String(data.symbol || data.scrip_id || '').toUpperCase();
      if (itemSymbol && itemSymbol !== symbol) throw new Error('mismatch');
      setItem(data);
      // Related filings for the same company.
      try {
        const rres = await customFetch(`/api/announcements?symbols=${encodeURIComponent(symbol)}&limit=6`);
        if (rres.ok) {
          const arr = await rres.json();
          const me = data.id || data.newsId;
          setRelated((Array.isArray(arr) ? arr : []).filter((a: any) => (a.id || a.newsId) !== me).slice(0, 4));
        }
      } catch { /* related is best-effort */ }
    } catch {
      setError('We could not open this filing. It may have expired from the feed.');
    } finally {
      setLoading(false);
    }
  }, [symbol, newsId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const companyName = item?.companyName || item?.SLONGNAME || symbol || 'BSE Listed Company';
  const subject = item?.subject || item?.NEWSSUB || 'Corporate Announcement';
  const category = item?.category || 'CORPORATE_ACTION';
  const bseTime = item?.bseTime || '';
  const aiSummary = item?.aiSummary || item?.aiSummaryEn || '';
  const details = item?.details || '';
  const pdfLink = item?.pdfLink || item?.ATTACHMENTNAME || item?.attachmentName || '';
  const scripCode = item?.scripCode || item?.scrip_cd || item?.SCRIP_CD || '';
  const pageUrl = symbol && newsId ? filingUrl(symbol, newsId) : '';

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-[#0F0E15]">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#171522]/90 backdrop-blur border-b border-slate-200/80 dark:border-[#2D283E]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to feed"
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-extrabold tracking-tight text-slate-900 dark:text-white">
            BSE <span className="text-emerald-500">Nexus</span>
          </span>
          <span className="ml-auto text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Filing</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white dark:bg-[#171522] border border-slate-200/80 dark:border-[#2D283E] rounded-2xl p-10 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
              <p className="text-sm font-medium">Opening filing…</p>
            </div>
          </div>
        ) : error || !item ? (
          <div className="bg-white dark:bg-[#171522] border border-slate-200/80 dark:border-[#2D283E] rounded-2xl p-10 text-center">
            <AlertTriangle size={28} className="mx-auto text-amber-500 mb-3" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Filing not available</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{error || 'This filing could not be found.'}</p>
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity"
            >
              Back to announcements
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
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {String(category).replace(/_/g, ' ')}
              </span>
              {scripCode && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                  BSE: {scripCode}
                </span>
              )}
              {symbol && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                  {symbol}
                </span>
              )}
              {bseTime && <time className="ml-auto text-xs text-slate-400">{bseTime}</time>}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug mb-2">
              {companyName}
            </h1>
            <h2 className="text-[15px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed pb-5 mb-5 border-b border-slate-200/80 dark:border-[#2D283E]">
              {subject}
            </h2>

            {aiSummary && (
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/70 dark:border-emerald-800/50 p-4 sm:p-5 mb-5">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-2">
                  AI Summary
                </p>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{aiSummary}</p>
              </div>
            )}

            {details && details !== subject && (
              <div className="mb-5">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                  Filing details
                </p>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{details}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {pdfLink && (
                <a
                  href={getSafePdfUrl(pdfLink, '', item.id || newsId, scripCode)}
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
                  type: 'filing',
                  label: `${companyName} · ${subject.slice(0, 60)}`,
                  symbol: symbol || undefined,
                  newsId: item.id || item.newsId || newsId,
                  url: pdfLink || undefined,
                }}
                label="Save note"
              />
              <ShareActionMenu
                title={`${companyName} (${symbol})`}
                headline={subject}
                text={aiSummary ? String(aiSummary).slice(0, 140) : subject}
                url={pageUrl}
                companyName={companyName}
                symbol={symbol}
                newsId={item.id || item.newsId || newsId}
                category={category}
                pdfUrl={pdfLink}
                size="sm"
                buttonLabel="Share"
              />
            </div>

            {related.length > 0 && (
              <div className="mt-8">
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                  Related filings — {companyName}
                </p>
                <div className="divide-y divide-slate-200/70 dark:divide-[#2D283E] border-t border-b border-slate-200/70 dark:border-[#2D283E]">
                  {related.map((r: any) => {
                    const rid = r.id || r.newsId;
                    return (
                      <button
                        key={rid}
                        type="button"
                        onClick={() => {
                          if (rid && symbol) {
                            const path = new URL(filingUrl(symbol, rid)).pathname;
                            window.history.pushState(null, '', path);
                            window.dispatchEvent(new PopStateEvent('popstate'));
                            window.scrollTo(0, 0);
                          }
                        }}
                        className="w-full flex items-center justify-between gap-3 py-3 text-left cursor-pointer group"
                      >
                        <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-snug line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {r.subject || r.NEWSSUB || 'Corporate Announcement'}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">{r.bseTime || ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.article>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Disclosures sourced directly from BSE India public regulatory feeds.
        </p>
      </main>
    </div>
  );
}
