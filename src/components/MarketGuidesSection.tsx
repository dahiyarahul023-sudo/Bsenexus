import React, { useState } from 'react';
import { Search, Clock, ArrowUpRight } from 'lucide-react';
import { MarketGuide } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { MarketGuide };

export const MARKET_GUIDES: MarketGuide[] = [
  {
    id: 'sebi-lodr-reg-30',
    slug: 'sebi-lodr-reg-30',
    title: 'Decoding SEBI LODR Regulation 30: Material Events & Timelines',
    category: 'SEBI Regulations',
    readTime: '6 min read',
    summary: 'A deep-dive handbook for Indian equity analysts and active investors on the statutory timelines, deemed materiality triggers, and disclosure obligations under Regulation 30 of SEBI (LODR) Regulations, 2015.',
    excerpt: 'Statutory timelines, deemed materiality triggers, and disclosure obligations under Regulation 30.',
    date: 'Sep 2024',
    publishedAt: 'Sep 2024',
    author: {
      name: 'BSE Nexus Research',
      role: 'Regulatory Intelligence Desk',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Under the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015, Regulation 30 represents the backbone of corporate transparency on the Bombay Stock Exchange (BSE) and National Stock Exchange (NSE). The 2023 amendments significantly tightened timelines to prevent asymmetric information leakage.',
      sections: [
        {
          heading: '1. Tightened Timelines: The 30-Minute to 12-Hour Mandate',
          content: 'SEBI now enforces strict reporting windows: board meetings concluding price-sensitive decisions must be disclosed within 30 minutes of meeting closure. Unplanned events emanating within the entity must be submitted within 12 hours, and events from third parties within 24 hours.',
          keyPoints: [
            'Board Meeting Outcomes: Within 30 minutes of conclusion',
            'Internal Material Events: Within 12 hours',
            'External/Third-Party Events: Within 24 hours'
          ],
          callout: {
            type: 'warning',
            text: 'A late disclosure filing after trading hours often triggers an immediate pre-market reaction the next trading morning.'
          }
        },
        {
          heading: '2. Quantitative Threshold for Materiality',
          content: 'Events are automatically deemed material if the financial impact exceeds the lower of: 2% of consolidated turnover, 2% of consolidated net worth, or 5% of average absolute consolidated profit/loss after tax over the preceding 3 financial years.',
          takeaways: [
            '2% of annual turnover threshold',
            '2% of net worth threshold',
            '5% of 3-year trailing average PAT threshold'
          ]
        }
      ],
      checklist: [
        'Check board meeting outcome filing stamp against market close',
        'Verify if quantitative materiality threshold is satisfied',
        'Inspect if the disclosure contains annexures with precise financial figures'
      ],
      conclusion: 'Tracking Regulation 30 filings with zero latency gives institutional and retail participants the earliest warning on structural shifts in public companies.'
    }
  },
  {
    id: 'forensic-quarterly-earnings',
    slug: 'forensic-quarterly-earnings',
    title: 'Forensic Analysis of Quarterly Corporate Earnings Disclosures',
    category: 'Earnings Analysis',
    readTime: '8 min read',
    summary: 'Learn how to dissect BSE quarterly financial submissions beyond top-line revenue and net profit: exceptional items, finance costs, other income distortion, and notes to accounts.',
    excerpt: 'Dissect quarterly submissions beyond revenue: exceptional items, other income, and auditor notes.',
    date: 'Aug 2024',
    publishedAt: 'Aug 2024',
    author: {
      name: 'Rahul Dahiya',
      role: 'Lead Quantitative Architect',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Press releases highlight EBITDA expansion, but the official BSE PDF attachment contains the unvarnished audited or limited review statements. Experienced market participants focus on cash flows, tax provisions, and audit qualifications.',
      sections: [
        {
          heading: '1. Deconstructing "Other Income" & Exceptional Items',
          content: 'A massive year-over-year surge in net profit can frequently stem from one-off asset sales, insurance claims, or reversal of prior provisions rather than core business operations.',
          keyPoints: [
            'Separate operational revenue from non-operating Treasury income',
            'Scrutinize exceptional items buried below operational EBITDA',
            'Verify margin trajectory excluding forex fluctuations'
          ],
          callout: {
            type: 'info',
            text: 'BSE Nexus automatically flags filings containing exceptional items exceeding 10% of reported PBT.'
          }
        },
        {
          heading: '2. Auditor Qualifications and Emphasis of Matter',
          content: 'The Auditor Report attachment holds the deepest signals. Look out for "Qualified Opinion", "Disclaimer of Opinion", or "Emphasis of Matter" paragraphs highlighting ongoing tax litigations, debt covenant breaches, or going concern doubts.',
          takeaways: [
            'Audit qualifications require immediate scrutiny',
            'Emphasis of matter often points to disputed statutory liabilities',
            'Changes in accounting policies distort YoY comparability'
          ]
        }
      ],
      checklist: [
        'Compare standalone vs. consolidated metrics',
        'Examine finance cost trajectory against debt disclosure',
        'Read Notes to the Financial Results (Notes 1 through 8)'
      ],
      conclusion: 'Relying purely on headline profit leads to value traps. Forensic reading of official BSE PDFs unveils underlying company health.'
    }
  },
  {
    id: 'promoter-pledging-insider-trades',
    slug: 'promoter-pledging-insider-trades',
    title: 'Tracking Promoter Pledges, Insider Trading & Shareholding Fluctuations',
    category: 'Corporate Actions',
    readTime: '5 min read',
    summary: 'How to monitor SAST Regulation 29, PIT Regulation 7 disclosures, and encumbrance filings to gauge promoter conviction and hidden leverage vulnerabilities.',
    excerpt: 'Monitor SAST & PIT disclosures to gauge promoter conviction and hidden leverage.',
    date: 'Jul 2024',
    publishedAt: 'Jul 2024',
    author: {
      name: 'BSE Nexus Research',
      role: 'Capital Markets Desk',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Promoter actions speak louder than conference call guidance. Monitoring Substantial Acquisition of Shares and Takeovers (SAST) and Prohibition of Insider Trading (PIT) disclosures helps catch institutional moves ahead of retail awareness.',
      sections: [
        {
          heading: '1. Decoding Encumbrance and Pledge Creation',
          content: 'When promoters pledge shares as collateral for loans, the company becomes exposed to margin call risk during market corrections. Revocation of pledges indicates deleveraging, whereas sudden spikes in pledge percentages can signal liquidity stress.',
          keyPoints: [
            'Pledge creations must be reported within 2 working days',
            'Pledge percentage exceeding 20% requires high caution',
            'Release of encumbrance is generally a positive catalyst'
          ]
        },
        {
          heading: '2. Open Market Insider Transactions',
          content: 'Under SEBI PIT regulations, trades exceeding ₹10 lakhs in value by designated persons must be disclosed. Open market purchases by founders, MDs, or key management personnel signal high insider conviction.',
          takeaways: [
            'Look for consistent open market buying over consecutive weeks',
            'Differentiate between ESOP allotments and real market purchases',
            'Watch for bulk sell-offs immediately following earnings releases'
          ]
        }
      ],
      conclusion: 'Keeping automated Telegram alerts on promoter filings provides actionable intelligence before the broader market digests the filings.'
    }
  },
  {
    id: 'ai-automated-filing-edge',
    slug: 'ai-automated-filing-edge',
    title: 'How Real-Time Alerts & AI Summarization Deliver a Market Edge',
    category: 'AI & Automation',
    readTime: '5 min read',
    summary: 'Discover how sub-second BSE polling combined with local AI parsing transforms dense 40-page corporate PDF documents into instant actionable trade catalysts.',
    excerpt: 'Sub-second BSE polling and AI parsing transform 40-page corporate PDFs into instant catalysts.',
    date: 'Sep 2024',
    publishedAt: 'Sep 2024',
    author: {
      name: 'Rahul Dahiya',
      role: 'Lead Quantitative Architect',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Over 800 corporate announcements are filed on the BSE daily. Over 70% represent routine administrative noise like loss of share certificates or newspaper clipping notices. Manually reading each filing creates cognitive fatigue and delayed reactions.',
      sections: [
        {
          heading: '1. Intelligent Noise Filtering',
          content: 'By categorizing filings into high-impact catalysts (mergers, orders, results, credit rating upgrades) versus routine procedural noise, traders can focus 100% of their attention on market-moving events.',
          keyPoints: [
            'Automated noise suppression for certificate loss filings',
            'Instant classification of high-impact regulatory disclosures',
            'Direct links to verified BSE repository attachments'
          ]
        },
        {
          heading: '2. Telegram Push & Voice Synthesizer',
          content: 'Speed is the ultimate alpha in event-driven trading. Push alerts to Telegram with formatted highlights ensure you receive the disclosure seconds before televised financial media broadcasts it.',
          takeaways: [
            'Direct Telegram alerts to personal or private channels',
            'Real-time sound chime feedback for hands-free trading desks',
            'Instant AI structured digest highlighting quantitative impact'
          ]
        }
      ],
      conclusion: 'BSE Nexus bridges the speed gap between institutional trading desks and retail investors with modern automation tools.'
    }
  }
];

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarketGuidesSectionProps {
  onSelectGuide: (guide: MarketGuide) => void;
}

export function MarketGuidesSection({ onSelectGuide }: MarketGuidesSectionProps) {
  const [guideSearch, setGuideSearch] = useState('');
  const [guideCategoryFilter, setGuideCategoryFilter] = useState('ALL');

  const filteredGuides = MARKET_GUIDES.filter(guide => {
    const matchesCat = guideCategoryFilter === 'ALL' || 
      guide.category.toLowerCase().includes(guideCategoryFilter.toLowerCase());
    const matchesQuery = !guideSearch || 
      guide.title.toLowerCase().includes(guideSearch.toLowerCase()) || 
      guide.summary.toLowerCase().includes(guideSearch.toLowerCase());
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide) => (
            <div
              key={guide.id}
              onClick={() => onSelectGuide(guide)}
              className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-lg transition-all cursor-pointer group"
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
                  {guide.author.avatar && (
                    <img 
                      src={guide.author.avatar} 
                      alt={guide.author.name} 
                      width={28}
                      height={28}
                      loading="lazy"
                      decoding="async"
                      className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-200">{guide.author.name}</div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400">{guide.date || guide.publishedAt}</div>
                  </div>
                </div>

                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Read Guide</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default MarketGuidesSection;
