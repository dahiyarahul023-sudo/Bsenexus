import React, { useState } from 'react';
import { 
  FileText, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Calendar, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Flame,
  Zap,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  springSnappy, 
  containerStaggerVariants, 
  itemFadeUpVariants, 
  buttonTap,
  accordionTransition 
} from '../utils/motionTokens';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { CustomDropdown } from './ui/CustomDropdown';
import { HonestProgressBar } from './ui/HonestProgressBar';
import { ActionButton } from './ui/ActionButton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface FollowUpFiling {
  id: string;
  subject: string;
  timeStr: string;
  exactDateTimeStr?: string;
  timestamp?: number;
  pdfLink?: string;
  category?: string;
}

export interface QuarterlyResultCardItem {
  id: string;
  symbol?: string;
  companyName?: string;
  companyShortName?: string;
  scripCode?: string;
  quarterKey?: string;
  periodOrMeeting: string;
  meetingDate?: string;
  boardMeetingDate?: string;
  declarationDate?: string;
  declarationTime?: string;
  declaredAtFormatted?: string;
  exactDateTimeStr?: string;
  submissionTimestamp?: number;
  subject: string;
  details?: string;
  pdfLink?: string;
  aiSummary?: string;
  isOutcome: boolean;
  status: string;
  priority?: string;
  category?: string;
  isPreResultBoosted?: boolean;
  preResultAnnouncementsCount?: number;
  followUpFilings?: FollowUpFiling[];
  followUpCount?: number;
}

interface QuarterlyResultsLedgerProps {
  results: QuarterlyResultCardItem[];
  symbol?: string;
  scripCode?: string;
  companyName?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onFetchDeepHistory?: (years: number) => void;
  isFetchingDeep?: boolean;
  deepHistoryMsg?: string | null;
  onBoostPriority?: (resultDateStr: string, days: number) => void;
  isBoosting?: boolean;
}

export const QuarterlyResultsLedger: React.FC<QuarterlyResultsLedgerProps> = ({
  results = [],
  symbol = '',
  scripCode = '',
  companyName = '',
  isLoading = false,
  onRefresh,
  onFetchDeepHistory,
  isFetchingDeep = false,
  deepHistoryMsg = null,
  onBoostPriority,
  isBoosting = false
}) => {
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [filterMode, setFilterMode] = useState<'declared' | 'all'>('declared');
  const [selectedYears, setSelectedYears] = useState<number>(1);

  const toggleAccordion = (id: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const declaredResults = results.filter(r => r.isOutcome || r.status === 'Declared' || r.status === 'Outcome Declared');
  const displayItems = filterMode === 'declared' ? (declaredResults.length > 0 ? declaredResults : results) : results;

  const displaySymbol = symbol || (results[0]?.symbol) || '';
  const displayShortName = companyName || results[0]?.companyShortName || results[0]?.companyName || displaySymbol;

  return (
    <div className="w-full space-y-4 font-sans text-slate-200">
      {/* Top Controls & Sync Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Declared vs All Filter Tabs */}
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 relative select-none">
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setFilterMode('declared')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer select-none min-h-[36px]",
                filterMode === 'declared'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <CheckCircle2 size={13} />
              <span>DECLARED ({declaredResults.length})</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setFilterMode('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer select-none min-h-[36px]",
                filterMode === 'all'
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Filter size={13} />
              <span>ALL QUARTERS ({results.length})</span>
            </motion.button>
          </div>
        </div>

        {/* Deep Archive Fetcher (1 - 5 Years) */}
        {onFetchDeepHistory && scripCode && (
          <div className="flex items-center gap-2">
            <CustomDropdown
              options={[
                { value: 1, label: '1 Year (4 Qtrs)' },
                { value: 2, label: '2 Years (8 Qtrs)' },
                { value: 3, label: '3 Years (12 Qtrs)' },
                { value: 5, label: '5 Years (20 Qtrs)' }
              ]}
              value={selectedYears}
              onChange={(val) => setSelectedYears(Number(val))}
              disabled={isFetchingDeep}
              size="xs"
              menuWidth="w-40"
              align="right"
            />

            <ActionButton
              onClick={() => onFetchDeepHistory(selectedYears)}
              isLoading={isFetchingDeep}
              loadingText="Syncing BSE..."
              variant="primary"
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono"
            >
              Sync {selectedYears}Y BSE History
            </ActionButton>
          </div>
        )}
      </div>

      {isFetchingDeep && (
        <div className="animate-in fade-in duration-200">
          <HonestProgressBar
            color="amber"
            isRunning={true}
            simulatedSteps={[
              { label: `Accessing BSE financial registry for ${selectedYears}Y records...`, durationMs: 1500 },
              { label: 'Parsing standalone & consolidated financial statements...', durationMs: 2500 },
              { label: 'Calculating YoY & QoQ variance and PAT margins...', durationMs: 2200 },
              { label: 'Indexing board meeting timestamps & release latency...', durationMs: 1200 }
            ]}
          />
        </div>
      )}

      {deepHistoryMsg && (
        <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-xs text-amber-300 flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={14} className="shrink-0 text-amber-400" />
          <span>{deepHistoryMsg}</span>
        </div>
      )}

      {/* Loading state - Show shape not spin */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono px-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Loading verified quarterly financial results...</span>
            </span>
            <span className="text-[11px] text-slate-400">Rendering ledger...</span>
          </div>
          {[1, 2, 3].map((sk) => (
            <div
              key={`quarter-skeleton-${sk}`}
              className="p-4 rounded-xl border border-slate-200/80 dark:border-[#2D283E] bg-white dark:bg-[#181624] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-4 w-28 bg-slate-200/70 dark:bg-slate-800/70 rounded" />
                </div>
                <div className="h-4 w-16 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                {[1, 2, 3, 4].map((col) => (
                  <div key={col} className="p-2 rounded bg-slate-50 dark:bg-[#14131E] space-y-1">
                    <div className="h-2.5 w-12 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="p-6 sm:p-7 text-left bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2 max-w-lg">
          <div className="text-sm font-bold text-slate-200">No quarterly results indexed yet for {displaySymbol || 'this stock'}.</div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click <strong className="text-slate-200">Sync BSE History</strong> above to automatically pull and parse the last 1 to 5 years of verified financial result filings and release timestamps.
          </p>
        </div>
      ) : (
        /* Results Cards List */
        <motion.div
          key={`ledger-${filterMode}-${displayItems.length}`}
          variants={containerStaggerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {displayItems.map((item, idx) => {
            const cardId = `${item.quarterKey || 'q'}-${item.id || 'card'}-${idx}`;
            const isExpanded = Boolean(expandedCards[cardId]);
            const isDeclared = item.isOutcome || item.status === 'Declared' || item.status === 'Outcome Declared';
            const followUps = item.followUpFilings || [];
            const followUpCount = item.followUpCount !== undefined ? item.followUpCount : followUps.length;

            const cardSymbol = item.symbol || displaySymbol;
            const rawCompany = item.companyShortName || item.companyName || displayShortName;
            const cardCompany = rawCompany && rawCompany.toUpperCase() !== cardSymbol.toUpperCase() ? rawCompany : (item.companyName || displayShortName || '');
            
            // Format quarter badge e.g. "Q3 FY26", "Q2 FY26", "Q1 FY26", "Q4 FY25"
            let cardQuarter = item.quarterKey || '';
            const fyMatch = cardQuarter.match(/^FY(\d{2})-(Q[1-4])$/i);
            if (fyMatch) {
              cardQuarter = `${fyMatch[2].toUpperCase()} FY${fyMatch[1]}`;
            } else {
              const yrMatch = cardQuarter.match(/^(\d{4})-(Q[1-4])$/i);
              if (yrMatch) {
                const y = parseInt(yrMatch[1], 10);
                const q = yrMatch[2].toUpperCase();
                const fy = q === 'Q4' ? (y % 100) : (y % 100) + 1;
                cardQuarter = `${q} FY${fy < 10 ? '0' + fy : fy}`;
              } else if (!cardQuarter && item.periodOrMeeting) {
                const qm = item.periodOrMeeting.match(/\b(Q[1-4]\s*FY\d{2})\b/i);
                if (qm) cardQuarter = qm[1].toUpperCase();
              }
            }

            const boardMeetingDate = item.boardMeetingDate || item.meetingDate || item.declarationDate || 'N/A';
            const declaredAt = item.declaredAtFormatted || (item.declarationTime ? `${item.declarationDate || boardMeetingDate}, ${item.declarationTime}` : (isDeclared ? boardMeetingDate : null));

            const safePdf = item.pdfLink ? getSafePdfUrl(item.pdfLink, undefined, item.id, item.scripCode || scripCode) : null;

            // Status border redline indicator
            const statusBorder = isDeclared
              ? "border-l-4 border-l-emerald-500"
              : item.status === 'Meeting Today'
              ? "border-l-4 border-l-amber-500"
              : "border-l-4 border-l-blue-500";

            return (
              <motion.div
                key={cardId}
                variants={itemFadeUpVariants}
                transition={springSnappy}
                className={cn(
                  "bg-white dark:bg-[#1A1926] hover:bg-slate-50/80 dark:hover:bg-[#1F1D2E] border border-slate-200/90 dark:border-[#2D283E] hover:border-slate-300 dark:hover:border-[#3E3854] rounded-xl p-4 transition-all shadow-xs space-y-3",
                  statusBorder
                )}
              >
                {/* Row 1: Monogram Avatar, Symbol, Company Short Name, Quarter Pill (Left) & Status Badge (Right) */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#252233] border border-slate-200 dark:border-[#352F48] text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center font-display shrink-0 select-none shadow-2xs">
                      {(cardSymbol || 'ST').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-display">
                        {cardSymbol}
                      </span>
                      {cardCompany && cardCompany !== cardSymbol && (
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {cardCompany}
                        </span>
                      )}
                    </div>
                    {cardQuarter && (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-mono tracking-wide whitespace-nowrap select-none">
                        {cardQuarter}
                      </span>
                    )}
                  </div>

                  {/* Status Pill with Icon Container Protection */}
                  <div className="shrink-0">
                    {isDeclared ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70 whitespace-nowrap select-none">
                        <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Declared</span>
                      </span>
                    ) : item.status === 'Meeting Today' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 animate-pulse whitespace-nowrap select-none">
                        <Clock size={12} className="text-amber-600 dark:text-amber-400" />
                        <span>Meeting Today</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70 whitespace-nowrap select-none">
                        <Calendar size={12} className="text-sky-600 dark:text-sky-400" />
                        <span>{item.status || 'Upcoming'}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Board Meeting Date (Left) & Declared At Exact Time (Right) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs pt-1 border-t border-slate-100 dark:border-[#2D283E]">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span>Board meeting:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono">{boardMeetingDate}</span>
                  </div>

                  {declaredAt && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span>Declared at:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{declaredAt}</span>
                    </div>
                  )}
                </div>

                {/* Row 3: Headline Subject with Protected PDF Button */}
                <div className="flex items-start justify-between gap-3 text-xs bg-slate-50 dark:bg-[#15141E] p-3 rounded-lg border border-slate-200/80 dark:border-[#2D283E]">
                  <div className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed min-w-0 flex-1">
                    {item.subject || item.details || 'Financial Results & Board Meeting Outcome'}
                  </div>

                  {safePdf && (
                    <motion.a
                      whileTap={buttonTap}
                      transition={springSnappy}
                      href={safePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-3 py-1.5 min-h-[36px] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 hover:text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap select-none shadow-2xs"
                      title="Open official BSE PDF Filing"
                    >
                      <FileText size={12} className="text-rose-600 dark:text-rose-400" />
                      <span>PDF</span>
                      <ExternalLink size={11} className="opacity-70" />
                    </motion.a>
                  )}
                </div>

                {/* Row 4: Collapsible Follow-up Filings & Category Pill */}
                <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  {/* Same-day Follow-up Filings Accordion */}
                  {followUpCount > 0 ? (
                    <motion.button
                      type="button"
                      whileTap={buttonTap}
                      onClick={() => toggleAccordion(cardId)}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer py-1 min-h-[36px] sm:min-h-[32px]"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-amber-500" />
                      ) : (
                        <ChevronRight size={14} className="text-slate-400" />
                      )}
                      <span>
                        {followUpCount} {followUpCount === 1 ? 'follow-up filing' : 'follow-up filings'} same day
                      </span>
                    </motion.button>
                  ) : (
                    <div className="text-[11px] text-slate-500 dark:text-slate-500 font-mono">
                      Single direct outcome filing
                    </div>
                  )}

                  {/* Category Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#352F48] whitespace-nowrap select-none">
                      Results
                    </span>
                  </div>
                </div>

                {/* Expanded Follow-up Filings Sub-List */}
                <AnimatePresence>
                  {isExpanded && followUps.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={accordionTransition}
                      className="overflow-hidden mt-2 pl-3 border-l-2 border-amber-500/40 space-y-2 bg-slate-950/40 p-2.5 rounded-r-lg"
                    >
                      <div className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wider">
                        Same-day Related Disclosures:
                      </div>
                      <div className="space-y-1.5">
                        {followUps.map((f, fIdx) => {
                          const fPdf = f.pdfLink ? getSafePdfUrl(f.pdfLink, undefined, f.id, item.scripCode || scripCode) : null;
                          return (
                            <div
                              key={`${f.id || 'f'}-${fIdx}`}
                              className="flex items-center justify-between gap-2 text-xs p-2 bg-slate-900/80 rounded border border-slate-800/80"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="font-medium text-slate-300 truncate">
                                  {f.subject}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                  <Clock size={10} />
                                  <span>{f.exactDateTimeStr || f.timeStr}</span>
                                </div>
                              </div>

                              {fPdf && (
                                <a
                                  href={fPdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded flex items-center gap-1 shrink-0"
                                >
                                  <span>PDF</span>
                                  <ExternalLink size={9} />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};
