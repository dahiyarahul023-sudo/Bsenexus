import { SeoSkillMetadata } from "./types";

export const SEO_SKILLS: SeoSkillMetadata[] = [
  {
    id: 'page-audit',
    command: '/page-audit',
    name: 'Full Page & SERP Audit',
    shortDesc: 'Audits page content, competitive position, and outputs a 70-point scorecard with top quick wins.',
    fullDesc: 'Analyzes a specific page URL or content draft against top SERP competitors. Computes a 6-dimension scorecard (Information Gain, Semantic Depth, EEAT, Structure, Technical SEO, Conversion), detailed diagnostic findings, top 5 quick wins, and rewritten meta/hook elements.',
    category: 'Audit & Analysis',
    icon: 'FileSearch',
    badgeColor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40',
    exampleData: {
      url: 'https://mokobara.com/collections/luggage-all',
      keyword: 'Buy Premium Travel Luggage & Cabin Trolley Bags Online India',
      competitors: 'Uppercase, ICON, Nasher Miles, Safari',
      content: `Mokobara Luggage Collection: Premium Travel Luggage & Cabin Trolley Bags. Discover our lightweight polycarbonate cabin luggage with Japanese Hinomoto wheels, unbreakable shell, and custom compartments. 30-day trial and 6-year warranty.`
    }
  },
  {
    id: 'eeat-audit',
    command: '/eeat-audit',
    name: 'E-E-A-T Signals Audit',
    shortDesc: 'Scores Experience, Expertise, Authoritativeness, and Trustworthiness against Google Quality Rater guidelines.',
    fullDesc: 'Reads the page and scores the four quality dimensions (out of 40). Checks author credentials, schema markups, first-party testing evidence, citation trust, and generates a rewritten high-authority author bio.',
    category: 'Audit & Analysis',
    icon: 'Award',
    badgeColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40',
    exampleData: {
      url: 'https://example.com/guide/financial-planning-retire-early',
      author: 'Rahul Sharma, CFA (12+ years asset allocation research)',
      content: 'Early retirement index investing strategies: How to calculate safe withdrawal rates and manage asset allocation for capital preservation in emerging markets.'
    }
  },
  {
    id: 'semantic-gap',
    command: '/semantic-gap',
    name: 'Semantic Gap Analysis',
    shortDesc: 'Compares your page against top 3 ranking competitors to discover missing entities and vocabulary.',
    fullDesc: 'Maps out Entity -> Attribute -> Dimension relationships. Detects sub-topics competitors rank for that your page is omitting, while protecting your unique brand tone and providing ready-to-paste content addition drafts.',
    category: 'Audit & Analysis',
    icon: 'Network',
    badgeColor: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/40',
    exampleData: {
      keyword: 'Cabin baggage size limit indigo india',
      competitors: 'Skyscanner, MakeMyTrip, Cleartrip, Air India Guidelines',
      content: 'Cabin baggage rules for domestic flights: Maximum 7kg weight and standard dimensions (55 x 35 x 25 cm). One laptop bag or handbag allowed under personal items.'
    }
  },
  {
    id: 'keyword-deep-dive',
    command: '/keyword-deep-dive',
    name: 'Keyword Deep Dive & SERP Intel',
    shortDesc: 'Dissects search intent, ranking difficulty, SERP features, and calculates realistic ranking timelines.',
    fullDesc: 'Performs deep-intent SERP classification (Commercial vs Informational), pinpoints what top 3 ranking winners are doing differently, outputs secondary semantic variations, and projects an actionable 90-120 day ranking blueprint.',
    category: 'Strategy & Authority',
    icon: 'Compass',
    badgeColor: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40',
    exampleData: {
      keyword: 'Best index funds for SIP investment in India',
      topic: 'Personal Finance & Mutual Funds'
    }
  },
  {
    id: 'content-brief',
    command: '/content-brief',
    name: 'Production Content Brief',
    shortDesc: 'Constructs an editorial-grade writing brief with target word counts, spoke lists, and H2/H3 architecture.',
    fullDesc: 'Builds a complete, battle-tested content roadmap: searcher persona, tone parameters, secondary LSI keywords, internal linking spoke list, and heading-by-heading outline with required elements and snippet hooks.',
    category: 'Content & Copy',
    icon: 'BookOpen',
    badgeColor: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40',
    exampleData: {
      keyword: 'Best cabin luggage for international flights',
      topic: 'Travel Gear & Luggage Guide'
    }
  },
  {
    id: 'topic-cluster',
    command: '/topic-cluster',
    name: 'Topic Cluster Architecture',
    shortDesc: 'Plans a complete Pillar & Spoke content ecosystem with bidirectional internal linking rules.',
    fullDesc: 'Maps out your core Pillar Hub Page and 5-8 tactical Spoke Articles organized across ToFU, MoFU, and BoFU stages, with precise internal anchor text guidelines and lateral linking rules.',
    category: 'Strategy & Authority',
    icon: 'Layers',
    badgeColor: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40',
    exampleData: {
      topic: 'BSE Corporate Actions, Dividend Records & Stock Splits Guide',
      url: 'bse-nexus.com'
    }
  },
  {
    id: 'write-content',
    command: '/write-content',
    name: 'Anti-AI Slop Content Writer',
    shortDesc: 'Generates full publish-ready articles strictly enforcing anti-slop rules (no clichés, genuine expert voice).',
    fullDesc: 'Produces complete, high-density copy without generic filler ("delve into", "supercharge", "testament to"). Incorporates varied rhythm, concrete numbers, real-world case examples, Markdown comparison tables, and key takeaways.',
    category: 'Content & Copy',
    icon: 'PenTool',
    badgeColor: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40',
    exampleData: {
      topic: 'How to Read a Company Quarterly Balance Sheet and Cash Flow Statement in 15 Minutes',
      keyword: 'read quarterly financial results balance sheet bse guide',
      content: 'Outline: 1. Executive Summary 2. P&L vs Cash Flow 3. Operating Margin Trap 4. Checklist Table'
    }
  },
  {
    id: 'improve-content',
    command: '/improve-content',
    name: 'Content Refresh & Decay Fixer',
    shortDesc: 'Diagnoses why an existing article dropped in rankings and outputs exact section rewrites.',
    fullDesc: 'Analyzes content decay, intent shifts, and competitor leapfrogging. Pinpoints sections to delete, sections to expand, provides an uncopyable fresh Information Gain module, and updates metadata hooks.',
    category: 'Content & Copy',
    icon: 'Sparkles',
    badgeColor: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/40',
    exampleData: {
      keyword: 'BSE Quarterly Results Calendar & Earnings Dates',
      content: 'Here is a list of BSE earnings dates for 2023. Companies report their earnings every quarter. You can check the corporate announcements on the exchange website.'
    }
  },
  {
    id: 'featured-snippet',
    command: '/featured-snippet',
    name: 'Position 0 Snippet Optimizer',
    shortDesc: 'Engineers 42-55 word definition answers, tables, and ordered lists to win Google Featured Snippets.',
    fullDesc: 'Re-engineers your core content to match Google NLP extraction algorithms. Delivers concise 45-word snippet answers, comparison tables, or structured step-by-step lists that leapfrog position 1.',
    category: 'Content & Copy',
    icon: 'Target',
    badgeColor: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40',
    exampleData: {
      keyword: 'What is Ex-Dividend Date vs Record Date in Indian Stock Market?',
      content: 'The ex-dividend date is the day on which a stock starts trading without the dividend benefit. To be eligible for the dividend, an investor must own shares before the ex-date. The record date is the date on which the company verifies its shareholder register.'
    }
  },
  {
    id: 'linkbuilding',
    command: '/linkbuilding',
    name: 'Link Building & PR Outreach',
    shortDesc: 'Classifies domain authority phase, builds Skyscraper playbooks, and crafts high-converting PR pitches.',
    fullDesc: 'Assesses site authority phase (Foundation vs Dominance), pinpoints competitor asset vulnerabilities to execute the Skyscraper technique, creates data-backed digital PR hooks, and drafts personalized cold outreach email templates.',
    category: 'Strategy & Authority',
    icon: 'Link',
    badgeColor: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/40',
    exampleData: {
      topic: 'Comprehensive Market Study on Nifty 50 Shareholding Patterns & Retail Investor Runup',
      niche: 'FinTech & Capital Markets Research',
      competitors: 'Moneycontrol, Economic Times, LiveMint Research'
    }
  },
  {
    id: 'expert-interview',
    command: '/expert-interview',
    name: 'Expert Interview Extractor',
    shortDesc: 'Extracts non-Googleable, proprietary first-party expertise to inject unassailable E-E-A-T.',
    fullDesc: 'Formulates provocative, deep interview questionnaires for subject-matter experts. Uncovers operational numbers, failure modes, and contrarian insights, with templates for weaving quotes directly into articles.',
    category: 'Strategy & Authority',
    icon: 'UserCheck',
    badgeColor: 'text-pink-600 bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800/40',
    exampleData: {
      topic: 'Algorithmic High-Frequency Execution in Indian Options Markets',
      author: 'Head of Quantitative Trading & Risk Management'
    }
  }
];
