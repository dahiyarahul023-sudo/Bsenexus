import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface FAQItem {
  question: string;
  answer: string;
}

export const COMMON_QUESTIONS: FAQItem[] = [
  {
    question: 'What is BSE Nexus and what services does it provide?',
    answer: 'BSE Nexus structures official BSE India corporate announcements into a searchable feed — filings, quarterly results, board meeting notices, and company pages. It adds AI-generated filing summaries, a results calendar, watchlists, and Telegram alerts on top of the official disclosures.'
  },
  {
    question: 'How do I check upcoming BSE quarterly results and board meetings?',
    answer: 'Open the Results Calendar (/results-calendar) or the Live BSE Docket on the homepage. Meeting dates, quarterly periods, dividend agendas, and board meeting notices are synced from official BSE India disclosures.'
  },
  {
    question: 'How does BSE Nexus process SEBI LODR Regulation 30 corporate announcements?',
    answer: 'Listed companies disclose material events — dividends, acquisitions, order wins, financial results — under SEBI LODR Regulations 30 and 33. BSE Nexus parses the official PDF filings from bseindia.com and extracts key figures like revenue, PAT, and EBITDA into readable summaries.'
  },
  {
    question: 'Where can I find research guides on Indian stock market filings?',
    answer: 'The Market Research Guides (/guides) cover how to read balance sheets, track promoter shareholding, decode auditor resignations, and interpret insider trading disclosures.'
  },
  {
    question: 'Can I track announcements for specific stocks like Reliance Industries or TCS?',
    answer: 'Yes. Search any listed BSE scrip or open a dedicated company page (such as /company/RELIANCE or /company/TCS) for its filings history, upcoming board meetings, price data, and peer comparisons.'
  },
  {
    question: 'Is BSE Nexus affiliated with the Bombay Stock Exchange or Nexus Select Trust?',
    answer: 'No. BSE Nexus is not affiliated with BSE India Ltd, SEBI, or Nexus Select Trust (REIT Scrip: 543913). All disclosures shown here originate from official BSE India filings — always verify critical filings on bseindia.com.'
  }
];

export function CommonQuestionsFAQ({
  className,
  id = 'common-questions-faq',
  title = 'Common questions',
  compact = false
}: {
  className?: string;
  id?: string;
  title?: string;
  compact?: boolean;
}) {
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true
  });

  const toggleItem = (index: number) => {
    setOpenItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': COMMON_QUESTIONS.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': item.answer
      }
    }))
  };

  return (
    <section id={id} className={clsx('w-full', className)} aria-labelledby={`${id}-heading`}>
      {/* FAQPage JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className={clsx(
        'rounded-2xl border transition-all',
        compact 
          ? 'p-4 sm:p-5 bg-slate-50/70 dark:bg-[#14121F]/80 border-slate-200 dark:border-slate-800' 
          : 'p-6 sm:p-8 bg-white dark:bg-[#13121F] border-slate-200 dark:border-slate-800 shadow-sm'
      )}>
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 id={`${id}-heading`} className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Factual, verified answers to frequent investor &amp; research queries
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {COMMON_QUESTIONS.map((item, idx) => {
            const isOpen = openItems[idx];
            return (
              <div
                key={idx}
                className="border border-slate-200/90 dark:border-slate-800/90 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#1A1828]/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(idx)}
                  className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Q{idx + 1}.
                    </span>
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 inline m-0">{item.question}</h3>
                  </span>
                  <ChevronDown
                    className={clsx(
                      'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180 text-emerald-500'
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
