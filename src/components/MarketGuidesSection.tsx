import React, { useState, useEffect } from 'react';
import { Search, Clock, ArrowUpRight } from 'lucide-react';
import { MarketGuide } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const MARKET_GUIDES: MarketGuide[] = [
  {
    id: 'sebi-lodr-reg-30',
    slug: 'sebi-lodr-reg-30-disclosures',
    title: 'Mastering SEBI LODR Regulation 30: How to Spot High-Impact Corporate Disclosures',
    category: 'SEBI Regulations',
    readTime: '6 min read',
    summary: 'A forensic guide to understanding Regulation 30 filings, materiality thresholds, 30-minute disclosure rules, and how smart capital reacts to undisclosed price-sensitive information.',
    excerpt: 'A forensic guide to understanding Regulation 30 filings, materiality thresholds, and disclosure timelines.',
    date: 'Sep 12, 2026',
    publishedAt: 'Sep 12, 2026',
    author: {
      name: 'BSE Nexus Intelligence Desk',
      role: 'Regulatory & Market Research',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Regulation 30 of the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015 is the backbone of transparency in Indian financial markets. It mandates listed companies to promptly notify stock exchanges of any event or information which, in the opinion of the board of directors, is material.',
      sections: [
        {
          heading: '1. What Qualifies as Material under Regulation 30?',
          content: 'SEBI categorizes disclosures into two primary parts: Para A (events deemed material without any discretion, such as board meeting outcomes for dividends, mergers, or debt default) and Para B (events that require companies to evaluate quantitative materiality criteria based on turnover or net worth thresholds).',
          keyPoints: [
            'Para A events: Mandatory instant disclosure within prescribed statutory timelines.',
            'Quantitative materiality: Impact exceeding 2% of turnover, 2% of net worth, or 5% of average 3-year profit/loss.',
            'Prompt rumor verification: Top 100/250 companies must confirm or deny market rumors within strict time limits.'
          ],
          callout: {
            type: 'info',
            text: 'Recent SEBI amendments mandate disclosures of outcome of board meetings within 30 minutes of meeting conclusion.'
          }
        },
        {
          heading: '2. The 30-Minute Timeline & Intraday Price Moves',
          content: 'When a board meeting closes during market hours, the company has precisely 30 minutes to submit the PDF disclosure to BSE and NSE. Algorithms scrape these exchange feeds at millisecond speed to capture unexpected dividend declarations, rights issues, or management changes.',
          takeaways: [
            'Check the "BSE Timestamp" against the board meeting closure time.',
            'Watch out for conditional approvals that depend on shareholder or regulatory consent.'
          ]
        },
        {
          heading: '3. Red Flags in Late-Evening Filings',
          content: 'Companies often disclose adverse news—such as director resignations, auditor qualifications, or tax notices—late on Friday evenings after market close. Understanding the sub-category of Regulation 30 helps filter genuine operational developments from reputational damage control.',
          callout: {
            type: 'warning',
            text: 'Filings made after 8:00 PM on Friday require extra scrutiny for potential corporate governance concerns.'
          }
        }
      ],
      checklist: [
        'Verify if filing falls under Schedule III Part A (mandatory) or Part B (materiality based)',
        'Check exchange timestamp and transmission latency',
        'Read original PDF attachments rather than summary tables',
        'Verify promoter or key managerial personnel (KMP) involvement'
      ],
      conclusion: 'Mastering Regulation 30 enables investors and analysts to react ahead of the crowd with factual clarity rather than speculative market noise.'
    }
  },
  {
    id: 'reading-quarterly-financial-results',
    slug: 'reading-quarterly-financial-results',
    title: 'How to Read Quarterly Financial Results & Balance Sheets in 5 Minutes',
    category: 'Earnings Analysis',
    readTime: '8 min read',
    summary: 'A step-by-step blueprint for scanning corporate earnings filings, distinguishing between consolidated vs. standalone numbers, operating EBITDA vs. other income, and free cash flow conversion.',
    excerpt: 'A step-by-step blueprint for scanning corporate earnings filings and spotting margin quality.',
    date: 'Sep 08, 2026',
    publishedAt: 'Sep 08, 2026',
    author: {
      name: 'Aditya Sen, CFA',
      role: 'Head of Quantitative Research',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Every quarter, thousands of Indian companies file earnings statements with the BSE and NSE. The vast majority of retail participants get caught looking solely at top-line revenue and bottom-line Net Profit, ignoring critical accounting adjustments.',
      sections: [
        {
          heading: '1. Consolidated vs. Standalone: Where the Real Truth Lies',
          content: 'Always prioritize Consolidated financial statements unless the listed entity has zero subsidiaries or joint ventures. Standalone statements frequently hide debt obligations and losses inside unlisted special purpose vehicles (SPVs).',
          keyPoints: [
            'Consolidated statements capture group-wide liabilities and associate earnings.',
            'Watch for significant divergences between standalone revenues and consolidated margins.'
          ]
        },
        {
          heading: '2. Operating Profit vs. "Other Income" Trickery',
          content: 'A company reporting 40% YoY Net Profit growth might appear phenomenal until you inspect "Other Income". Non-operational windfalls from land sales, mutual fund redemptions, or foreign currency adjustments do not represent sustainable business expansion.',
          callout: {
            type: 'warning',
            text: 'Subtract Other Income from EBITDA to compute true Operational Core Margin.'
          }
        },
        {
          heading: '3. Finance Costs & Debt Servicing',
          content: 'In higher-interest rate environments, rising finance costs erode margins rapidly. Compare EBITDA growth with Finance Cost trajectory to ensure the Interest Coverage Ratio remains safely above 3.5x.',
          takeaways: [
            'Interest coverage ratio = EBITDA / Finance Costs.',
            'Look out for deferred tax asset (DTA) write-backs inflating net earnings.'
          ]
        }
      ],
      checklist: [
        'Always check Consolidated figures first',
        'Compute Operational EBITDA excluding Other Income',
        'Verify cash generated from operations (CFO) matches reported PAT',
        'Check auditor remarks (Qualified vs. Unmodified opinion)'
      ],
      conclusion: 'A disciplined 5-minute earnings checklist protects your portfolio against valuation traps and accounting illusions.'
    }
  },
  {
    id: 'corporate-actions-mergers-buybacks',
    slug: 'corporate-actions-mergers-buybacks',
    title: 'Corporate Actions Demystified: Buybacks, Mergers, Demergers & Bonus Shares',
    category: 'Corporate Actions',
    readTime: '7 min read',
    summary: 'Understand tender offer vs. open market buybacks, tax arbitrage, record dates, entitlement ratios for retail investors, and demerger price discovery.',
    excerpt: 'Understand tender offer vs. open market buybacks, tax implications, and record dates.',
    date: 'Sep 01, 2026',
    publishedAt: 'Sep 01, 2026',
    author: {
      name: 'Meera Nambiar',
      role: 'Senior Financial Strategist',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Corporate actions directly alter the share capital structure and shareholder equity. While retail investors frequently view bonus shares as "free money", institutional players focus on the strategic tax and capital allocation signals embedded in each filing.',
      sections: [
        {
          heading: '1. Buyback Mechanisms: Tender Offer vs. Open Market',
          content: 'Tender offer buybacks allow companies to repurchase shares directly from existing shareholders on a proportionate basis with a reserved 15% retail quota (for portfolios valued under Rs 2 Lakhs on the record date). In contrast, open market buybacks take place via exchange order books without any guaranteed price.',
          keyPoints: [
            'Tender offer buybacks feature guaranteed record dates and entitlement ratios.',
            'Retail quota arbitrage often delivers high acceptance ratios in under-tracked mid-caps.'
          ]
        },
        {
          heading: '2. Demergers & Unlocking Hidden SOTP Value',
          content: 'When a diversified conglomerate spins off a high-growth division into a separately listed entity, it creates distinct pure-play investment vehicles. The price discovery session on the demerger effective date often yields lucrative re-rating opportunities.',
          callout: {
            type: 'tip',
            text: 'Ex-date pricing adjusts automatically during the special pre-open session on the exchange.'
          }
        }
      ],
      checklist: [
        'Identify whether buyback is via Tender Offer or Open Market route',
        'Check the Record Date and ex-date settlement timeline (T+1)',
        'Verify if promoter participation is permitted under the tender scheme'
      ],
      conclusion: 'Tracking corporate actions methodically unlocks non-directional trading setups and structural value creation.'
    }
  },
  {
    id: 'ai-automation-exchange-alerts',
    slug: 'ai-automation-exchange-alerts',
    title: 'Automating BSE & NSE Announcements with AI & Instant Alerts',
    category: 'AI & Automation',
    readTime: '5 min read',
    summary: 'How quantitative funds and retail traders use LLMs, semantic extraction, and Webhook bots to digest multi-page corporate PDFs in seconds.',
    excerpt: 'How to use AI semantic extraction and instant alerts to parse multi-page filings.',
    date: 'Aug 26, 2026',
    publishedAt: 'Aug 26, 2026',
    author: {
      name: 'Karan Malhotra',
      role: 'Principal Systems Architect',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Exchange filings in India are published as raw PDF documents—frequently scanned or formatted inconsistently. Modern traders combine optical character recognition (OCR) and lightweight LLMs to extract core operational figures in under 3 seconds.',
      sections: [
        {
          heading: '1. The Latency Gap between Filing and News Wire',
          content: 'Traditional news agencies often take 5 to 15 minutes to manually read, verify, and write an article about an exchange filing. By using automated BSE feed watchers, investors receive direct notifications within seconds of the exchange posting.',
          keyPoints: [
            'Direct exchange feed consumption minimizes information asymmetry.',
            'AI summarization highlights key order values, client names, and execution horizons.'
          ]
        },
        {
          heading: '2. Guarding against False Positives',
          content: 'Not every corporate disclosure matters. Keyword filters often trigger on routine compliance notices (such as loss of share certificates). Smart classification filters out non-material updates to prevent alert fatigue.',
          callout: {
            type: 'info',
            text: 'BSE Nexus uses contextual priority categorization to separate routine clerical updates from high-impact announcements.'
          }
        }
      ],
      checklist: [
        'Configure alerts for high-priority categories like earnings and order wins',
        'Enable Telegram notifications for zero-latency mobile delivery',
        'Filter out routine filings such as loss of share certificates'
      ],
      conclusion: 'Automated intelligence turns the firehose of market filings into an organized, high-conviction decision stream.'
    }
  },
  {
    id: 'sebi-sast-insider-trading',
    slug: 'sebi-sast-insider-trading',
    title: 'Insider Trading Regulations & SAST Takeover Code Decoded',
    category: 'SEBI Regulations',
    readTime: '7 min read',
    summary: 'Track promoter share pledges, open market purchases, Regulation 7(2) disclosures, and creeping acquisitions under the SEBI SAST Regulations.',
    excerpt: 'Track promoter share pledges, open market purchases, and creeping acquisitions.',
    date: 'Aug 18, 2026',
    publishedAt: 'Aug 18, 2026',
    author: {
      name: 'BSE Nexus Intelligence Desk',
      role: 'Regulatory & Market Research',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Promoter buying in the secondary market is widely recognized as one of the strongest organic signals of managerial confidence. The SEBI (Prohibition of Insider Trading) Regulations, 2015 and SEBI SAST Regulations govern these disclosures.',
      sections: [
        {
          heading: '1. Form C under PIT Regulations: The 2-Day Reporting Rule',
          content: 'Any promoter, director, or designated person who executes trades exceeding Rs 10 Lakhs in a calendar quarter must disclose the transaction to the company and the exchange within two trading days.',
          keyPoints: [
            'Look for consistent open-market purchases across multiple quarters.',
            'Distinguish between ESOP allotments and genuine cash market buying.'
          ]
        },
        {
          heading: '2. The Danger of High Promoter Pledge',
          content: 'When promoters pledge their shareholding to raise corporate loans, market volatility introduces margin call risks. A sharp price decline can trigger forced open-market liquidations by NBFC lenders.',
          callout: {
            type: 'warning',
            text: 'Promoter pledge levels exceeding 20% warrant heightened caution during macro drawdowns.'
          }
        }
      ],
      checklist: [
        'Check whether trade mode is Open Market, Off Market, or ESOP',
        'Verify total percentage of promoter holding pledged with lenders',
        'Observe price reaction around trading window closure periods'
      ],
      conclusion: 'Following insider capital flows reveals where those closest to the company are placing their own capital.'
    }
  },
  {
    id: 'forensic-auditor-resignation-red-flags',
    slug: 'forensic-auditor-resignation-red-flags',
    title: 'Auditor Resignations & Forensic Red Flags in Listed Companies',
    category: 'Earnings Analysis',
    readTime: '6 min read',
    summary: 'Recognize early warning signals: statutory auditor resignations, qualified audit opinions, related-party transaction surges, and inventory discrepancies.',
    excerpt: 'Recognize early warning signals: statutory auditor resignations and qualified audit opinions.',
    date: 'Aug 10, 2026',
    publishedAt: 'Aug 10, 2026',
    author: {
      name: 'Aditya Sen, CFA',
      role: 'Head of Quantitative Research',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Capital preservation is the first rule of successful investing. Forensic analysis of exchange filings frequently reveals governance breakdowns months before the stock experiences a catastrophic sell-off.',
      sections: [
        {
          heading: '1. Mid-Term Auditor Resignations',
          content: 'Under SEBI norms, statutory auditors who resign prematurely must submit detailed reasons to the stock exchanges within 24 hours. Citations of "pre-occupation" or "lack of management information sharing" are classic red flags.',
          keyPoints: [
            'Resignation immediately preceding annual audit sign-off is a high-severity warning.',
            'Verify the reputation and pedigree of the incoming replacement audit firm.'
          ]
        },
        {
          heading: '2. Related-Party Transactions (RPTs)',
          content: 'Channeling corporate funds to unlisted promoter-owned entities through excessive royalty payments, loans, or advances is the primary vehicle for capital leakage in listed micro and mid-caps.',
          callout: {
            type: 'warning',
            text: 'Review the annual Related Party Transactions disclosure under Regulation 23 for loan write-offs.'
          }
        }
      ],
      checklist: [
        'Verify reason given in Annexure A of auditor resignation filing',
        'Check for adverse or qualified opinions in the Independent Auditor Report',
        'Scan for abrupt changes in Chief Financial Officer (CFO) or Company Secretary'
      ],
      conclusion: 'Prioritizing governance hygiene keeps your capital safely positioned in resilient, high-integrity businesses.'
    }
  },
  {
    id: 'bse-quarterly-results-calendar-guide',
    slug: 'bse-quarterly-results-calendar-guide',
    title: 'BSE Results Calendar Guide: How to Track Dalal Street Earnings & Board Meeting Dates',
    category: 'Earnings',
    readTime: '10 min read',
    summary: 'A complete institutional and retail guide to tracking BSE quarterly earnings dates, decoding Regulation 29 board meeting notices, trading window closures, and Limited Review Reports on Dalal Street.',
    excerpt: 'Master the quarterly results season on the Bombay Stock Exchange (BSE). Learn how to track upcoming board meeting dates, audit financial releases under SEBI LODR Regulation 33, and capture earnings moves before the broader market.',
    date: 'Sep 21, 2026',
    publishedAt: '2026-09-21T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Equity Research & Earnings Analysis',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Every quarter on Dalal Street, over 4,000 listed enterprises on the Bombay Stock Exchange (BSE) undergo the most consequential corporate transparency audit in global emerging markets: the quarterly financial results cycle. Understanding how Indian corporations schedule board meetings, disseminate unaudited financial statements, and comply with mandatory exchange disclosures gives market participants an unassailable edge.',
      sections: [
        {
          heading: '1. The Statutory Framework: SEBI LODR Regulation 33 & The 45-Day Timeline',
          content: 'Under Regulation 33, listed companies must file unaudited financial statements accompanied by an independent Limited Review Report (LRR) within 45 days of the close of Q1, Q2, and Q3, and within 60 days for audited annual Q4 numbers.',
          callout: {
            type: 'info',
            text: 'Milestone Timelines: Q1 results by August 14, Q2 by November 14, Q3 by February 14, and Q4 audited results by May 30.'
          }
        },
        {
          heading: '2. Regulation 29 Prior Intimations: Board Meeting Notices',
          content: 'Companies must give stock exchanges prior written notice of the scheduled board meeting date at least two clear working days in advance, excluding the notification date and meeting date.',
          callout: {
            type: 'warning',
            text: 'Repeated rescheduling or postponement of board meetings often signals internal accounting reconciliations.'
          }
        },
        {
          heading: '3. Trading Window Closure Protocol Under SEBI PIT Rules',
          content: 'The trading window closes from the end of each quarter until 48 hours after financial results are disclosed to BSE and NSE, preventing designated insiders from trading on unpublished price-sensitive information.'
        }
      ],
      checklist: [
        'Confirm if the board meeting agenda includes dividends or bonus issues',
        'Verify trading window closure dates and ensure insider restrictions are respected',
        'Compare standalone vs consolidated revenue and profit margins YoY'
      ],
      conclusion: 'By leveraging statutory timelines and tracking board meeting dates via the BSE Nexus Results Calendar, investors can anticipate volatility and make evidence-based decisions.'
    }
  },
  {
    id: 'bse-shareholding-pattern-explained',
    slug: 'bse-shareholding-pattern-explained',
    title: 'How to Read BSE Shareholding Patterns: Decoding Promoters, FIIs, DIIs & Pledged Shares',
    category: 'Corporate',
    readTime: '9 min read',
    summary: 'A masterclass on reading quarterly BSE shareholding pattern filings under SEBI LODR Regulation 31. Learn how to decode promoter stakes, institutional FII/DII inflows, pledged share risks, and retail holding traps.',
    excerpt: 'Demystifying Regulation 31 shareholding reports on the Bombay Stock Exchange. Discover how smart money analyzes promoter share pledges, tracks institutional flows, and detects governance warning signs.',
    date: 'Sep 21, 2026',
    publishedAt: '2026-09-21T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Governance & Ownership Research',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'In the Indian stock market, few regulatory disclosures provide as direct a window into fundamental conviction and corporate governance as the quarterly Shareholding Pattern filed under Regulation 31 of SEBI LODR Regulations.',
      sections: [
        {
          heading: '1. Regulatory Mandate: SEBI LODR Regulation 31',
          content: 'SEBI mandates submission within 21 calendar days of the end of each quarter. Ownership is organized into Table II (Promoter), Table III (Public), and Table IV (Non-Promoter Non-Public).'
        },
        {
          heading: '2. The Danger of Promoter Share Pledging',
          content: 'Promoters pledging shares as collateral for loans can trigger catastrophic margin calls if stock prices fall, leading lenders to dump shares and trigger downward circuits.',
          callout: {
            type: 'warning',
            text: 'High promoter pledge (>20%) coupled with high debt creates extreme downside risk during corrections.'
          }
        },
        {
          heading: '3. Tracking Institutional Capital (FIIs, DIIs & Mutual Funds)',
          content: 'Under Table III, any public shareholder owning 1% or more must be named. Tracking marquee institutional funds and Super Investors reveals high-probability investment ideas.'
        }
      ],
      checklist: [
        'Verify if promoter stake has increased or remained stable over the last 4 quarters',
        'Check Table II specifically for any pledged or encumbered promoter shares',
        'Track combined FII and Mutual Fund holding trends over time'
      ],
      conclusion: 'Shareholding patterns are the ultimate truth serum on Dalal Street. Integrating quarterly Regulation 31 audits preserves capital and spots compounders.'
    }
  }
];

export type { MarketGuide };

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarketGuidesSectionProps {
  onSelectGuide: (guide: MarketGuide) => void;
}

export function MarketGuidesSection({ onSelectGuide }: MarketGuidesSectionProps) {
  const [guideSearch, setGuideSearch] = useState('');
  const [guideCategoryFilter, setGuideCategoryFilter] = useState('ALL');
  const [guides, setGuides] = useState<MarketGuide[]>(MARKET_GUIDES);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/market-guides')
      .then(res => res.json())
      .then(data => {
        if (isMounted && data?.success && Array.isArray(data.guides) && data.guides.length > 0) {
          setGuides(data.guides);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const safeGuides = Array.isArray(guides) ? guides : MARKET_GUIDES;
  const filteredGuides = safeGuides.filter(guide => {
    if (!guide) return false;
    const cat = (guide.category || '').toLowerCase();
    const title = (guide.title || '').toLowerCase();
    const summary = (guide.summary || guide.excerpt || '').toLowerCase();
    const query = guideSearch.toLowerCase().trim();

    const matchesCat = guideCategoryFilter === 'ALL' || cat.includes(guideCategoryFilter.toLowerCase()) || guideCategoryFilter.toLowerCase().includes(cat);
    const matchesQuery = !query || 
      title.includes(query) || 
      summary.includes(query) || 
      cat.includes(query) ||
      (guide.slug && guide.slug.toLowerCase().includes(query)) ||
      (guide.id && guide.id.toLowerCase().includes(query));
    return matchesCat && matchesQuery;
  });

  return (
    <section id="market-guides" className="py-16 sm:py-24 border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              Educational Knowledge Base
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Market insights, earnings analysis, and BSE filing guides
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Master the nuances of SEBI LODR Regulation 30, forensic financial reading, and high-speed corporate event analysis.
            </p>
          </div>

          {/* Search Input for Guides */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              value={guideSearch}
              onChange={(e) => setGuideSearch(e.target.value)}
              placeholder="Search guides & articles..."
              aria-label="Search guides and educational articles"
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans text-slate-900 dark:text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 mb-6 text-xs">
          {['ALL', 'SEBI Regulations', 'Earnings Analysis', 'Corporate Actions', 'AI & Automation'].map(cat => (
            <button
              key={cat}
              onClick={() => setGuideCategoryFilter(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap",
                guideCategoryFilter === cat
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              )}
            >
              {cat === 'ALL' ? 'All Guides' : cat}
            </button>
          ))}
        </div>

        {/* Guides Cards Grid */}
        {filteredGuides.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGuides.map((guide) => (
              <a
                key={guide.id}
                href={`/guides/${guide.slug || guide.id}`}
                onClick={(e) => {
                  if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    onSelectGuide(guide);
                  }
                }}
                className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-lg transition-all cursor-pointer group text-decoration-none"
              >
                <div className="space-y-3">
                  {/* Category & Time */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                      {guide.category}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {guide.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {guide.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {guide.summary || guide.excerpt}
                  </p>
                </div>

                {/* Author & Read Link Footer */}
                <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {guide.author?.avatar ? (
                      <img 
                        src={guide.author.avatar} 
                        alt={guide.author.name || 'Author'} 
                        width={28}
                        height={28}
                        loading="lazy"
                        decoding="async"
                        className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/40">
                        {(guide.author?.name || 'BSE')[0]}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-200">{guide.author?.name || 'Research Desk'}</div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400">{guide.date || guide.publishedAt || 'Market Insights'}</div>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Read Guide</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No market guides matching "{guideSearch}"
            </p>
            <button
              onClick={() => {
                setGuideSearch('');
                setGuideCategoryFilter('ALL');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Reset Filters & View All
            </button>
          </div>
        )}

      </div>
    </section>
  );
}

export default MarketGuidesSection;
