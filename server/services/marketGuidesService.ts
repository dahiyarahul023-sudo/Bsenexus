/**
 * Server-side fail-safe Market Guides provider.
 * Guarantees server.ts never crashes even if frontend files are modified or deleted.
 */

export interface ServerMarketGuide {
  id: string;
  slug: string;
  title: string;
  category: string;
  readTime: string;
  summary: string;
  excerpt: string;
  date: string;
  publishedAt: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  content: {
    introduction: string;
    sections: Array<{
      heading?: string;
      title?: string;
      content?: string;
      body?: string[];
      callout?: {
        type: 'warning' | 'tip' | 'info';
        text: string;
      };
    }>;
    checklist?: string[];
    conclusion: string;
  };
}

export const FALLBACK_MARKET_GUIDES: ServerMarketGuide[] = [
  {
    id: 'sebi-lodr-regulation-30',
    slug: 'sebi-lodr-regulation-30',
    title: 'Demystifying SEBI LODR Regulation 30: Price-Sensitive BSE Disclosures',
    category: 'Regulatory',
    readTime: '6 min read',
    summary: 'A forensic guide for retail and institutional investors to decipher mandatory corporate filings within the 30-minute regulatory window.',
    excerpt: 'How SEBI LODR Regulation 30 mandates prompt disclosure of material events and how to identify price-sensitive catalysts on Dalal Street.',
    date: '2026-09-10',
    publishedAt: '2026-09-10T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Compliance & Equity Research',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Under the Securities and Exchange Board of India (Listing Obligations and Disclosure Requirements) Regulations, 2015, Regulation 30 represents the single most critical bridge between listed corporations and public market integrity. Any event that can materially impact price discovery must be disseminated to the exchanges without information asymmetry.',
      sections: [
        {
          heading: 'Mandatory Disclosure Timelines: The 30-Minute & 12-Hour Windows',
          title: 'Mandatory Disclosure Timelines: The 30-Minute & 12-Hour Windows',
          content: 'SEBI mandates strict timelines under the amended LODR framework. Events originating from a Board Meeting must be filed within 30 minutes of the meeting concluding.',
          body: [
            'Board Meeting outcomes must be disclosed within 30 minutes of adjournment.',
            'Events emanating from within the listed entity must be reported within 12 hours.',
            'Events emanating from outside the listed entity must be reported within 24 hours.'
          ],
          callout: {
            type: 'warning',
            text: 'Failure to file within specified timelines prompts immediate exchange surveillance alerts.'
          }
        },
        {
          heading: 'Qualitative vs Quantitative Materiality Thresholds',
          title: 'Qualitative vs Quantitative Materiality Thresholds',
          content: 'SEBI established strict objective thresholds for materiality: 2% of consolidated turnover, 2% of net worth, or 5% of 3-year average PAT.',
          body: [
            '2% of consolidated annual revenue/turnover based on last audited statements.',
            '2% of consolidated net worth.',
            '5% of the average absolute profit/loss after tax for the preceding three audited fiscal years.'
          ]
        }
      ],
      checklist: [
        'Verify if the filing is signed by the designated Company Secretary.',
        'Check whether the Board Meeting closure timestamp matches within 30 minutes.',
        'Evaluate the event value against the trailing 12-month consolidated turnover.'
      ],
      conclusion: 'By decoding Regulation 30 filings systematically, investors can differentiate between routine PR and authentic structural catalysts.'
    }
  },
  {
    id: 'board-meeting-results-guide',
    slug: 'board-meeting-results-guide',
    title: 'How to Audit Board Meeting Agendas & Quarterly Financial Results',
    category: 'Earnings',
    readTime: '8 min read',
    summary: 'Master the quarterly results season: from trading window closure and board notice agendas to segmental revenue and margin dissection.',
    excerpt: 'Step-by-step forensic framework for evaluating quarterly financial disclosures, board agendas, and dividend declarations on BSE.',
    date: '2026-09-08',
    publishedAt: '2026-09-08T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Forensic Accounting & Analysis',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Every quarter, Indian listed companies must file un-audited or audited financial results accompanied by a Limited Review Report (LRR) or Independent Auditor Report.',
      sections: [
        {
          heading: 'Trading Window Closure: The Insider Safeguard',
          title: 'Trading Window Closure: The Insider Safeguard',
          content: 'The trading window closes from the end of each quarter until 48 hours after financial results are made public.',
          body: [
            'Window closes on the final calendar day of each quarter.',
            'No promoter or director may transact in equity shares during this lock-in.',
            'Trading window reopens strictly 48 hours post-dissemination.'
          ]
        },
        {
          heading: 'Standalone vs Consolidated: Which Numbers Actually Matter?',
          title: 'Standalone vs Consolidated: Which Numbers Actually Matter?',
          content: 'For companies with active operating subsidiaries, consolidated numbers are the only true representation of business economics.',
          body: [
            'Look at Consolidated Net Profit and Cash Flow to detect loss-making subsidiaries.',
            'Compare Standalone Debt vs Consolidated Debt to detect off-balance-sheet leverage.'
          ]
        }
      ],
      checklist: [
        'Check if YoY revenue expansion is driven by volume growth or one-time gains.',
        'Examine EBITDA margin trends after accounting for input costs.',
        'Review the notes to accounts for non-operating Other Income.'
      ],
      conclusion: 'Earnings reports contain immense signal when dissected with discipline.'
    }
  },
  {
    id: 'auditor-resignations-red-flags',
    slug: 'auditor-resignations-red-flags',
    title: 'Forensic Red Flags: Auditor Resignations & Secretarial Qualifications',
    category: 'Governance',
    readTime: '7 min read',
    summary: 'Why mid-term statutory auditor exits are one of the most severe red flags in Indian equities, and how SEBI circulars protect minority shareholders.',
    excerpt: 'Detailed analysis of statutory auditor mid-term resignations, Reasons for Resignation filings, and forensic warning signs.',
    date: '2026-09-02',
    publishedAt: '2026-09-02T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Governance & Risk Assessment',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'A sudden statutory auditor resignation during the middle of a fiscal year is historically the sharpest warning sign of aggressive accounting or governance failure.',
      sections: [
        {
          heading: 'The SEBI Circular on Auditor Resignations',
          title: 'The SEBI Circular on Auditor Resignations',
          content: 'Under SEBI circular CIR/CFD/CMD1/114/2019, auditors must provide Annexure A disclosures detailing any scope limitations.',
          body: [
            'Auditors cannot walk away without issuing required quarterly audit reviews.',
            'The resigning auditor must submit a detailed Annexure A disclosure to exchanges.'
          ]
        }
      ],
      checklist: [
        'Inspect Annexure A of the resignation filing for mentions of scope limitation.',
        'Verify if the Audit Committee conducted an exit interview.'
      ],
      conclusion: 'When an auditor resigns abruptly, prudent risk management demands swift reassessment of exposure.'
    }
  },
  {
    id: 'insider-trading-pit-regulations',
    slug: 'insider-trading-pit-regulations',
    title: 'Tracking Promoters & Insiders: SEBI PIT Regulations & Creeping Acquisitions',
    category: 'Corporate',
    readTime: '6 min read',
    summary: 'How to decode Form C disclosures, SAST creeping acquisitions, and promoter share pledges to evaluate true insider conviction.',
    excerpt: 'Actionable techniques to monitor insider transactions, promoter pledge dynamics, and SAST Substantial Acquisition filings.',
    date: '2026-08-28',
    publishedAt: '2026-08-28T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Capital Markets & Trading Surveillance',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'SEBI PIT and SAST regulations provide a transparent paper trail of insider transactions.',
      sections: [
        {
          heading: 'Deciphering SEBI PIT Form C Disclosures',
          title: 'Deciphering SEBI PIT Form C Disclosures',
          content: 'Transactions exceeding ₹10 Lakhs must be disclosed within two trading days under Form C.',
          body: [
            'Differentiate between open market purchases and ESOP allotments.',
            'Open market purchases signify genuine insider conviction.'
          ]
        }
      ],
      checklist: [
        'Confirm if purchases were open market.',
        'Track promoter stake vs the 75% regulatory ceiling.'
      ],
      conclusion: 'Prioritize open market promoter buying with clean balance sheets.'
    }
  },
  {
    id: 'cash-flow-forensics-india',
    slug: 'cash-flow-forensics-india',
    title: 'Cash Flow Forensics: Operating Cash Flow vs Accounting Net Profit',
    category: 'Forensics',
    readTime: '9 min read',
    summary: 'A forensic guide to auditing Cash Flow from Operations (CFO), working capital bloat, and capital expenditure quality in Indian corporations.',
    excerpt: 'How to use cash flow statements to uncover aggressive revenue recognition, uncollected trade receivables, and genuine economic earnings.',
    date: '2026-08-20',
    publishedAt: '2026-08-20T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Forensic Accounting',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Profit is an accounting opinion; cash is an audited fact. Forensic cash flow analysis reveals whether reported earnings represent real money.',
      sections: [
        {
          heading: 'The CFO-to-PAT Divergence Test',
          title: 'The CFO-to-PAT Divergence Test',
          content: 'For a healthy enterprise, cumulative Cash Flow from Operations should equal or exceed Net Profit (PAT).',
          body: [
            'CFO / PAT > 1.0 indicates high-quality earnings.',
            'CFO / PAT < 0.7 indicates profits locked in unpaid receivables or unsold inventory.'
          ]
        }
      ],
      checklist: [
        'Calculate CFO / PAT across 3 consecutive fiscal years.',
        'Verify trade receivables growth does not outpace revenue growth.'
      ],
      conclusion: 'Forensic cash flow auditing cuts through accounting wizardry. Always follow the cash.'
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
    date: '2026-09-21',
    publishedAt: '2026-09-21T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Equity Research & Earnings Analysis',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'Every quarter on Dalal Street, over 4,000 listed enterprises on the Bombay Stock Exchange (BSE) undergo the most consequential corporate transparency audit in global emerging markets: the quarterly financial results cycle. For active equity investors, fundamental researchers, and quantitative trading desks, tracking upcoming earnings dates is not merely an administrative exercise—it represents the primary catalyst for severe price repricing, earnings surprises, volatility expansion, and institutional capital rotation. Understanding how Indian corporations schedule board meetings, disseminate unaudited financial statements, and comply with mandatory exchange disclosures gives market participants an unassailable edge over those who rely on lagging social media reports or delayed secondary aggregators.',
      sections: [
        {
          heading: '1. The Statutory Framework: SEBI LODR Regulation 33 & The 45-Day Timeline',
          title: '1. The Statutory Framework: SEBI LODR Regulation 33 & The 45-Day Timeline',
          content: 'The regulatory timeline governing corporate financial disclosures in India is strictly enforced under Regulation 33 of the Securities and Exchange Board of India (Listing Obligations and Disclosure Requirements) Regulations, 2015. Under this mandate, all listed companies must submit their quarterly standalone and consolidated financial results to the stock exchanges within precise calendar deadlines.',
          body: [
            'For the first three fiscal quarters—Q1 (April to June), Q2 (July to September), and Q3 (October to December)—companies are legally required to file unaudited financial statements accompanied by an independent Limited Review Report (LRR) within 45 days of the close of the quarter (August 14, November 14, and February 14 respectively).',
            'For Q4 (January to March), listed companies are granted a 60-day statutory window (until May 30) if they elect to submit comprehensive audited annual financial statements directly, rather than submitting an unaudited quarterly report followed by annual numbers later.',
            'Banking institutions and non-banking financial companies (NBFCs) must additionally adhere to Reserve Bank of India (RBI) asset classification disclosures, gross non-performing asset (GNPA) reporting, and provisioning schedules alongside Regulation 33 filings.'
          ],
          callout: {
            type: 'info',
            text: 'Key Milestone Dates: Q1 results must be submitted by August 14; Q2 by November 14; Q3 by February 14; and Q4 audited results by May 30.'
          }
        },
        {
          heading: '2. Regulation 29 Prior Intimations: Spotting Board Meeting Notices in Advance',
          title: '2. Regulation 29 Prior Intimations: Spotting Board Meeting Notices in Advance',
          content: 'Companies cannot convene surprise board meetings to approve quarterly earnings. Regulation 29 of SEBI LODR requires listed entities to give stock exchanges prior written notice of the scheduled board meeting date at least two clear working days in advance, excluding the date of the notification and the date of the meeting itself.',
          body: [
            'Prior intimations submitted under Regulation 29 are cataloged under the BSE announcement sub-category "Board Meeting Intimation" or "Board Meeting to consider Financial Results".',
            'Along with considering quarterly financial results, board notices frequently specify supplementary corporate actions on the agenda, such as interim dividends, special dividends, bonus share issues, employee stock options (ESOPs), or capital fundraising via qualified institutional placements (QIPs).',
            'When a company delays its board meeting towards the very end of the 45-day deadline or repeatedly reschedules its meeting date, institutional analysts treat this as an operational friction signal requiring elevated audit scrutiny.'
          ],
          callout: {
            type: 'warning',
            text: 'Repeated rescheduling or postponement of board meetings for results consideration often signals internal audit disputes or accounting reconciliations.'
          }
        },
        {
          heading: '3. The Trading Window Closure: Insiders Locked Out of the Market',
          title: '3. The Trading Window Closure: Insiders Locked Out of the Market',
          content: 'One of the most powerful institutional safeguards in Indian capital markets is the mandatory closure of the trading window under Clause 4 of Schedule B of the SEBI (Prohibition of Insider Trading) Regulations, 2015 (PIT Regulations).',
          body: [
            'The trading window automatically closes from the end of every calendar quarter (e.g., March 31, June 30, September 30, and December 31) for all Designated Persons, Key Managerial Personnel (KMPs), directors, and promoters.',
            'The window remains strictly closed throughout the preparation of financial numbers and only reopens 48 hours after the financial results are transmitted to and disseminated by the BSE and NSE stock exchanges.',
            'The 48-hour post-results cooling period ensures that retail and institutional investors have full price-discovery access to digest the financial statements before corporate insiders can execute any equity sales or purchases.'
          ]
        },
        {
          heading: '4. Forensic Dissection: Standalone vs Consolidated & Limited Review Reports',
          title: '4. Forensic Dissection: Standalone vs Consolidated & Limited Review Reports',
          content: 'When the BSE disseminates a financial result PDF, professional equity researchers immediately isolate three core elements beyond headline revenue and profit after tax (PAT):',
          body: [
            'Standalone vs Consolidated Metrics: Standalone numbers solely document parent company operations. Consolidated numbers incorporate all domestic and overseas operating subsidiaries, joint ventures, and associates. Large divergences where standalone profits surge while consolidated earnings plummet reveal cash drains or debt buildup in subsidiary vehicles.',
            'Auditor Limited Review Report (LRR) Qualifications: Always scroll to the statutory auditor report at the conclusion of the filing. An unmodified (clean) opinion is expected; any Emphasis of Matter or Qualified Opinion regarding uncollected receivables, disputed tax liabilities, or ongoing forensic investigations represents a material investment risk.',
            'Segmental Revenue & EBIT Dissection: Multi-division conglomerates disclose revenue and margins per business segment under Ind AS 108. Dissecting which specific business unit drove growth prevents confusing cyclical commodity upticks with structural core expansion.'
          ]
        },
        {
          heading: '5. How to Track BSE Upcoming Results Live on BSE Nexus',
          title: '5. How to Track BSE Upcoming Results Live on BSE Nexus',
          content: 'Navigating through hundreds of exchange PDFs during peak earnings season requires systematic filtering. The BSE Nexus Results Calendar terminal delivers instant clarity with zero latency:',
          body: [
            'Live 15-Second Polling: BSE Nexus polls exchange servers every 15 seconds to capture board meeting announcements, date changes, and declared result PDFs within seconds of filing.',
            'Comprehensive Scope Filters: Switch effortlessly between "Upcoming Board Meetings", "Today Results", and "Historical Ledger" to isolate scheduled events across your portfolio.',
            'Instant Calendar Sync: Download .ics calendar files or add upcoming board meeting dates directly to Google Calendar with a single click to ensure you never miss an earnings call.',
            'Telegram Push Notifications: Configure your private watchlist to receive instant push alerts on mobile the millisecond a board meeting outcome or quarterly PDF is posted.'
          ]
        },
        {
          heading: '6. Frequently Asked Questions (FAQ) About BSE Results Calendar',
          title: '6. Frequently Asked Questions (FAQ) About BSE Results Calendar',
          content: 'Essential regulatory and practical answers for tracking BSE corporate earnings releases:',
          body: [
            'Q1: How far in advance must an Indian company notify BSE before holding a results meeting? Answer: Under SEBI LODR Regulation 29, listed companies must provide at least two clear working days advance notice (excluding the intimation date and meeting date).',
            'Q2: What is the deadline for filing Q1, Q2, Q3, and Q4 financial results on BSE? Answer: Unaudited results for Q1 (June ending), Q2 (September ending), and Q3 (December ending) must be filed within 45 days of the quarter ending. Audited annual Q4 results (March ending) must be filed within 60 days.',
            'Q3: Where can I find the exact board meeting outcome document on BSE? Answer: Companies upload the board meeting outcome as an official PDF under Regulation 30/33 within 30 minutes of the board meeting adjourning. On BSE Nexus, these are streamed live in the Announcements Terminal.',
            'Q4: What happens if a company fails to disclose quarterly results within 45 days? Answer: The exchange issues warning notices, levies per-day financial penalties under SEBI circulars, moves the stock to surveillance or Z-group categories, and may ultimately suspend trading if non-compliance persists.'
          ]
        }
      ],
      checklist: [
        'Confirm if the board meeting agenda includes dividends, bonus shares, or stock splits.',
        'Verify trading window closure dates and ensure insider restrictions are respected.',
        'Compare standalone vs consolidated revenue, EBITDA, and net profit margins YoY.',
        'Review auditor Limited Review Report for any qualifications or emphasis of matter.',
        'Check notes to financial accounts for one-off exceptional items inflating headline PAT.'
      ],
      conclusion: 'The quarterly results calendar is Dalal Street’s ultimate reality check. By leveraging statutory timelines under SEBI LODR Regulation 33 and tracking board meeting dates via the BSE Nexus Results Calendar, investors can anticipate market volatility, audit operational momentum with institutional rigor, and make evidence-based capital allocation decisions.'
    }
  },
  {
    id: 'bse-shareholding-pattern-explained',
    slug: 'bse-shareholding-pattern-explained',
    title: 'How to Read BSE Shareholding Patterns: Decoding Promoters, FIIs, DIIs & Pledged Shares',
    category: 'Corporate',
    readTime: '9 min read',
    summary: 'A masterclass on reading quarterly BSE shareholding pattern filings under SEBI LODR Regulation 31. Learn how to decode promoter stakes, institutional FII/DII inflows, pledged share risks, and retail holding traps.',
    excerpt: 'Demystifying Regulation 31 shareholding reports on the Bombay Stock Exchange. Discover how smart money analyzes promoter share pledges, tracks institutional flows, and detects governance warning signs before market repricing.',
    date: '2026-09-21',
    publishedAt: '2026-09-21T09:00:00Z',
    author: {
      name: 'BSE Nexus Intelligence Team',
      role: 'Governance & Ownership Research',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    content: {
      introduction: 'In the Indian stock market, few regulatory disclosures provide as direct a window into fundamental conviction and corporate governance as the quarterly Shareholding Pattern filed under Regulation 31 of the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015. While financial statements reflect past operational performance and news headlines reflect current sentiment, shareholding patterns reveal where real capital is committed. Knowing who owns a company—and more crucially, who is quietly accumulating or distributing shares—allows retail investors to align their portfolios with disciplined institutional allocators while avoiding toxic governance traps.',
      sections: [
        {
          heading: '1. The Regulatory Mandate: SEBI LODR Regulation 31 Filing Requirements',
          title: '1. The Regulatory Mandate: SEBI LODR Regulation 31 Filing Requirements',
          content: 'SEBI mandates that every company listed on BSE and NSE submit a detailed, standardized shareholding pattern disclosure at specific statutory intervals:',
          body: [
            'Quarterly Filings: Within 21 calendar days of the end of each quarter (e.g., by April 21, July 21, October 21, and January 21).',
            'Capital Restructuring: At least one day prior to listing of shares pursuant to rights issues, bonus issues, preferential allotments, or conversion of warrants.',
            'Material Capital Shifts: Within 10 days of any change in capital structure that exceeds 2% of total paid-up share capital.',
            'The standardized XBRL and PDF format organizes equity ownership into three fundamental categories: Table II (Promoter & Promoter Group), Table III (Public Shareholder), and Table IV (Non-Promoter Non-Public Shareholders).'
          ],
          callout: {
            type: 'info',
            text: 'Filing Deadline: All listed companies must submit their quarterly shareholding patterns to BSE within 21 days from the end of each quarter.'
          }
        },
        {
          heading: '2. Table II: Auditing Promoter & Promoter Group Ownership',
          title: '2. Table II: Auditing Promoter & Promoter Group Ownership',
          content: 'The promoter holding represents the primary measure of skin-in-the-game. In India, minimum public shareholding rules require promoters to hold no more than 75% of total equity, ensuring at least 25% remains available for public market liquidity.',
          body: [
            'Promoter Conviction vs Stagnation: A stable or increasing promoter stake (through open market creeping acquisitions within the allowable 5% annual threshold under SEBI SAST Regulations) reflects strong insider conviction in long-term enterprise prospects.',
            'Promoter Group Fragmentation: Scrutinize whether promoter equity is held directly by individuals or through obscure private holding corporations, offshore trust structures, or overseas corporate bodies (OCBs).',
            'Successive Stake Dilution: Consistent quarter-on-quarter selling by promoters without clear explanations (such as debt deleveraging or statutory 75% compliance) is historically one of the most reliable warning signs of operational stagnation.'
          ]
        },
        {
          heading: '3. The Red Flag of Pledged Shares & Encumbrances',
          title: '3. The Red Flag of Pledged Shares & Encumbrances',
          content: 'Promoter share pledging is among the most catastrophic volatility accelerants on Dalal Street. Under Table II of Regulation 31, companies must explicitly disclose the number and percentage of promoter shares that have been pledged, encumbered, or subjected to Non-Disposal Undertakings (NDUs) as collateral for corporate loans.',
          body: [
            'The Mechanics of Pledging: Promoters pledge their equity holdings with Non-Banking Financial Companies (NBFCs) or banks to raise debt financing either for the listed entity or for private unlisted group ventures.',
            'The Liquidation Domino Effect: If the company’s stock price declines significantly, the value of the collateral drops below required loan-to-value (LTV) margin limits. If promoters cannot provide additional collateral or cash immediately, lenders invoke the pledge and dump millions of shares on the open market, triggering severe downward circuit limits.',
            'Safe Thresholds: Institutional investors typically mandate that pledged promoter shares should not exceed 5% of total promoter holding. A pledge ratio exceeding 20% to 30% indicates severe balance-sheet stress.'
          ],
          callout: {
            type: 'warning',
            text: 'High promoter pledge (>20%) coupled with a leveraged corporate balance sheet creates extreme downside tail risk during broader market corrections.'
          }
        },
        {
          heading: '4. Table III: Decoding Institutional Inflows (FIIs, DIIs & Mutual Funds)',
          title: '4. Table III: Decoding Institutional Inflows (FIIs, DIIs & Mutual Funds)',
          content: 'Public shareholding disclosures under Table III divide non-promoter equity into Institutional and Non-Institutional categories. This section contains immense institutional signal:',
          body: [
            'Foreign Institutional Investors (FIIs / FPIs): Tracks high-conviction foreign capital flows. Analyze whether institutional inflow is driven by sovereign wealth funds (e.g., GIC, Norges, Temasek) and renowned global asset managers, or anonymous offshore funds operating through single-jurisdiction shell entities.',
            'Domestic Institutional Investors (DIIs): Measures the equity held by Indian Mutual Funds, Alternative Investment Funds (AIFs), Insurance Companies (such as LIC), and scheduled commercial banks. Increasing mutual fund ownership over 3-4 consecutive quarters indicates strong domestic institutional backing.',
            'The 1% Disclosure Rule: Under SEBI regulations, any public shareholder holding 1% or more of total equity must be identified by name. Tracking notable Super Investors, prominent family offices, and renowned value investors holding >1% stakes provides high-probability research leads.'
          ]
        },
        {
          heading: '5. Non-Institutional Holdings: Spotting the Retail Traps',
          title: '5. Non-Institutional Holdings: Spotting the Retail Traps',
          content: 'The non-institutional section details holdings by Resident Individuals with nominal share capital up to ₹2 Lakhs (retail investors) and above ₹2 Lakhs (High-Net-Worth Individuals or HNIs):',
          body: [
            'The Classic Distribution Trap: When institutional FIIs and DIIs are actively exiting a troubled business while promoters are diluting their holdings, retail shareholding almost invariably surges from 10% to 25% or more as unsuspecting investors attempt to average down falling stock prices.',
            'High-Conviction Concentration: High-quality compounders typically exhibit tightly held equity where combined Promoter + FII + DII holding exceeds 75% to 85%, leaving a modest, disciplined float for public market trading.',
            'Employee Benefit Trusts & ESOP Pools: Inspect whether employee welfare trusts hold substantial equity, aligning managerial performance directly with shareholder value creation.'
          ]
        },
        {
          heading: '6. Frequently Asked Questions (FAQ) on BSE Shareholding Patterns',
          title: '6. Frequently Asked Questions (FAQ) on BSE Shareholding Patterns',
          content: 'Key questions answered about Indian equity shareholding patterns:',
          body: [
            'Q1: When must companies file their quarterly shareholding patterns on BSE? Answer: Under SEBI LODR Regulation 31, listed entities must submit their shareholding pattern within 21 days from the end of each calendar quarter.',
            'Q2: What is the maximum permissible promoter shareholding in an Indian listed company? Answer: Under SEBI minimum public shareholding (MPS) rules, promoters can hold a maximum of 75% equity. At least 25% must be held by the public to ensure fair trading liquidity.',
            'Q3: Why is a high percentage of pledged promoter shares dangerous? Answer: When promoters pledge shares to borrow capital, a sharp fall in stock prices can trigger margin calls. If promoters fail to provide extra collateral, lenders liquidate the pledged shares on the open market, causing extreme cascading price crashes.',
            'Q4: How can I identify individual marquee investors who own shares in a company? Answer: In Table III of the Regulation 31 disclosure, companies are legally required to list the specific names of all public shareholders who hold 1% or more of the total share capital.'
          ]
        }
      ],
      checklist: [
        'Verify if promoter stake has increased or remained stable over the last 4 quarters.',
        'Check Table II specifically for any pledged or encumbered promoter shares.',
        'Track combined FII and Mutual Fund holding trends to verify institutional sponsorship.',
        'Review the 1% public shareholder list for renowned value investors or family offices.',
        'Ensure retail shareholding is not surging while smart institutional capital is exiting.'
      ],
      conclusion: 'Shareholding patterns are the ultimate truth serum on Dalal Street. While management commentary can be polished and quarterly earnings can be shaped by accounting conventions, the physical movement of shares between promoters, institutions, and the public never lies. Integrating quarterly Regulation 31 audits into your investment checklist is essential for identifying high-governance compounders and preserving capital.'
    }
  }
];

export const MARKET_GUIDES: ServerMarketGuide[] = FALLBACK_MARKET_GUIDES;

export function getMarketGuides(): ServerMarketGuide[] {
  return MARKET_GUIDES;
}

export function getMarketGuideBySlug(slug: string): ServerMarketGuide | undefined {
  if (!slug) return undefined;
  const clean = slug.toLowerCase().trim();
  return MARKET_GUIDES.find(g => (g.slug && g.slug.toLowerCase() === clean) || (g.id && g.id.toLowerCase() === clean));
}
