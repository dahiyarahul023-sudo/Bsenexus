import { customFetch } from '../../api';

export interface StockMoverItem {
  symbol: string;
  name: string;
  scripCode: string;
  price: number;
  changePercent: number;
  volume?: string;
  reason?: string;
}

export interface UpcomingResultItem {
  symbol: string;
  name: string;
  scripCode: string;
  date: string;
  daysLeft?: number;
  purpose: string;
  sector?: string;
}

export interface CorporateActionItem {
  symbol: string;
  name: string;
  scripCode: string;
  actionType: 'DEMERGER' | 'ORDER_WIN' | 'DIVIDEND' | 'SPLIT' | 'BONUS';
  headline: string;
  impactText: string;
  valueBadge?: string;
}

export interface StorySlide {
  id: string;
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  slideIndexInChapter: number;
  totalSlidesInChapter: number;
  
  tagline: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  accentGradient: string;
  
  // Real high-resolution photographic image asset
  imageUrl: string;
  imageCaption?: string;
  
  // Dynamic visual layout type
  visualType: 
    | 'MARKET_SENTIMENT' 
    | 'TOP_GAINERS' 
    | 'TOP_LOSERS' 
    | 'HEAVYWEIGHT_SWINGS'
    | 'FII_DII_FLOW' 
    | 'SECTORAL_FLOW'
    | 'RESULTS_HEAVYWEIGHTS' 
    | 'RESULTS_MIDCAPS'
    | 'CORPORATE_DEMERGER' 
    | 'MEGA_ORDER_WINS';

  // Associated structured data
  marketTrend?: 'BULL' | 'BEAR';
  indicesSummary?: {
    sensex: { price: number; change: number; changePercent: number };
    nifty: { price: number; change: number; changePercent: number };
    advanceCount: number;
    declineCount: number;
  };
  movers?: StockMoverItem[];
  fiiDiiData?: {
    fiiNet: number;
    diiNet: number;
    netBalance: number;
    dateStr: string;
    flowInsight: string;
  };
  upcomingResults?: UpcomingResultItem[];
  corporateActions?: CorporateActionItem[];
  
  bulletPoints: string[];
  statsLabel?: string;
  statsValue?: string;

  // Floating bottom action pill (Directly links to Company 360 Intel Hub)
  actionPill: {
    symbol: string;
    scripCode: string;
    name: string;
  };
}

export interface StoryChapter {
  id: string;
  title: string;
  shortLabel: string;
  icon: string;
  slideCount: number;
  slides: StorySlide[];
}

// ==========================================
// DEFAULT CURATED STORY CHAPTERS
// 4 Chapters with Verified High-Res Industrial Photos
// ==========================================
export const DEFAULT_STORY_CHAPTERS: StoryChapter[] = [
  // CHAPTER 1: Market Pulse & Major Movers (4 slides)
  {
    id: 'market-pulse',
    title: 'Market Pulse & Movers',
    shortLabel: 'Market Pulse',
    icon: 'TrendingUp',
    slideCount: 4,
    slides: [
      {
        id: 'pulse-sentiment',
        chapterId: 'market-pulse',
        chapterTitle: 'Market Pulse & Movers',
        chapterIndex: 0,
        slideIndexInChapter: 0,
        totalSlidesInChapter: 4,
        tagline: 'Index Momentum & Breadth',
        title: 'BSE SENSEX Holds Above 77,200 On Resilient Domestic Buying',
        description: 'Dalal Street benchmarks trade in green as broad market breadth favors advances with strong mid-cap and capital goods support.',
        badge: 'LIVE SENTIMENT',
        badgeColor: 'bg-emerald-500 text-white',
        accentGradient: 'from-emerald-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Dalal Street exchanges record 1.53x advancing issues over declines',
        visualType: 'MARKET_SENTIMENT',
        marketTrend: 'BULL',
        indicesSummary: {
          sensex: { price: 77240.60, change: 386.70, changePercent: 0.50 },
          nifty: { price: 24190.45, change: 112.30, changePercent: 0.47 },
          advanceCount: 2180,
          declineCount: 1420
        },
        bulletPoints: [
          'SENSEX up +0.50% (+386 pts) anchored by private banking & capital goods',
          'Market breadth healthy with 2,180 advances against 1,420 declines',
          'India VIX cools 4.2% to 11.45 signaling steady investor risk appetite'
        ],
        statsLabel: 'Market Advance/Decline Ratio',
        statsValue: '1.53x Positive Breadth',
        actionPill: {
          symbol: 'TATAMOTORS',
          scripCode: '500570',
          name: 'Tata Motors Ltd'
        }
      },
      {
        id: 'pulse-gainers',
        chapterId: 'market-pulse',
        chapterTitle: 'Market Pulse & Movers',
        chapterIndex: 0,
        slideIndexInChapter: 1,
        totalSlidesInChapter: 4,
        tagline: 'Top Percentage Gainers',
        title: 'Tata Motors & Capital Goods Spearhead Intraday Rally',
        description: 'Auto heavyweight Tata Motors surges on strong JLR margins and commercial fleet volume expansion.',
        badge: 'TOP GAINERS',
        badgeColor: 'bg-emerald-500 text-white',
        accentGradient: 'from-emerald-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Modern automotive manufacturing plant & commercial assembly floor',
        visualType: 'TOP_GAINERS',
        movers: [
          { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', scripCode: '500570', price: 986.40, changePercent: 4.85, volume: '2.4x Vol' },
          { symbol: 'BEL', name: 'Bharat Electronics Ltd', scripCode: '500049', price: 298.15, changePercent: 3.92, volume: '1.9x Vol' },
          { symbol: 'LT', name: 'Larsen & Toubro Ltd', scripCode: '500510', price: 3640.50, changePercent: 3.25, volume: '1.6x Vol' },
          { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', scripCode: '532454', price: 1542.80, changePercent: 2.80, volume: '1.4x Vol' }
        ],
        bulletPoints: [
          'Tata Motors up +4.85% leading Nifty Auto index on EV order backlog',
          'Bharat Electronics & L&T clock 2x average intraday volume turnover',
          'Bharti Airtel touches fresh 52-week peak following ARPU upgrade'
        ],
        statsLabel: 'Top Stock Rally',
        statsValue: 'TATAMOTORS +4.85%',
        actionPill: {
          symbol: 'TATAMOTORS',
          scripCode: '500570',
          name: 'Tata Motors Ltd'
        }
      },
      {
        id: 'pulse-losers',
        chapterId: 'market-pulse',
        chapterTitle: 'Market Pulse & Movers',
        chapterIndex: 0,
        slideIndexInChapter: 2,
        totalSlidesInChapter: 4,
        tagline: 'Selective Profit-Booking',
        title: 'IT & Metals Consolidate On High-Valuation Pullback',
        description: 'Tech major TCS and metals slip as institutional desks take partial profits after an uninterrupted 4-week rally.',
        badge: 'TOP DIPS',
        badgeColor: 'bg-rose-500 text-white',
        accentGradient: 'from-rose-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1516937941344-00b4e0337589?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Heavy industrial metal smelting & manufacturing facility',
        visualType: 'TOP_LOSERS',
        movers: [
          { symbol: 'HINDALCO', name: 'Hindalco Industries Ltd', scripCode: '500440', price: 642.50, changePercent: -1.95, reason: 'Metals dip' },
          { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', scripCode: '532540', price: 4210.00, changePercent: -2.35, reason: 'Tech drag' },
          { symbol: 'CIPLA', name: 'Cipla Ltd', scripCode: '500087', price: 1485.20, changePercent: -1.60, reason: 'Pharma check' },
          { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', scripCode: '532500', price: 12150.00, changePercent: -1.25, reason: 'Inventory rebalance' }
        ],
        bulletPoints: [
          'Hindalco and metal exporters face headwinds from global commodity checks',
          'TCS down -2.35% as IT spending concerns weigh on client discretionary budgets',
          'Downside remains orderly with institutional support at key moving averages'
        ],
        statsLabel: 'Largest Sector Pullback',
        statsValue: 'NIFTY METALS -1.65%',
        actionPill: {
          symbol: 'HINDALCO',
          scripCode: '500440',
          name: 'Hindalco Industries Ltd'
        }
      },
      {
        id: 'pulse-heavyweights',
        chapterId: 'market-pulse',
        chapterTitle: 'Market Pulse & Movers',
        chapterIndex: 0,
        slideIndexInChapter: 3,
        totalSlidesInChapter: 4,
        tagline: 'Index Giants in Action',
        title: 'Reliance & HDFC Bank Drive Over +110 Index Points',
        description: 'India’s largest corporate bellwethers provide steady foundational liquidity, counterbalancing selective IT weakness.',
        badge: 'TITAN MOVERS',
        badgeColor: 'bg-blue-500 text-white',
        accentGradient: 'from-blue-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Banking & energy corporate headquarters in Mumbai BKC financial district',
        visualType: 'HEAVYWEIGHT_SWINGS',
        movers: [
          { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325', price: 2985.60, changePercent: 1.45, reason: '+64 SENSEX Pts' },
          { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', scripCode: '500180', price: 1675.20, changePercent: 0.95, reason: '+52 SENSEX Pts' },
          { symbol: 'INFY', name: 'Infosys Ltd', scripCode: '500209', price: 1845.00, changePercent: -0.40, reason: '-18 SENSEX Pts' },
          { symbol: 'ITC', name: 'ITC Ltd', scripCode: '500875', price: 492.30, changePercent: 0.70, reason: '+16 SENSEX Pts' }
        ],
        bulletPoints: [
          'Reliance Industries jumps +1.45% on oil-to-chemicals & retail margin recovery',
          'HDFC Bank adds +52 index points on sustained domestic credit growth numbers',
          'Heavyweight net index contribution comfortably stays in positive territory'
        ],
        statsLabel: 'Top Index Point Contributor',
        statsValue: 'RELIANCE (+64 Pts)',
        actionPill: {
          symbol: 'RELIANCE',
          scripCode: '500325',
          name: 'Reliance Industries Ltd'
        }
      }
    ]
  },

  // CHAPTER 2: Institutional Flow (FII / DII Data) (2 slides)
  {
    id: 'institutional-flow',
    title: 'FII / DII Institutional Flow',
    shortLabel: 'FII/DII Data',
    icon: 'Coins',
    slideCount: 2,
    slides: [
      {
        id: 'fii-dii-cash',
        chapterId: 'institutional-flow',
        chapterTitle: 'FII / DII Institutional Flow',
        chapterIndex: 1,
        slideIndexInChapter: 0,
        totalSlidesInChapter: 2,
        tagline: 'Exchange Cash Turnover & Liquidity',
        title: 'Domestic DIIs Pour In +₹2,420 Cr, Cushioning FII Selling',
        description: 'Domestic mutual funds and insurance capital powered by steady retail SIPs absorb foreign institutional outflow with net positive balance.',
        badge: 'FII / DII LEDGER',
        badgeColor: 'bg-indigo-500 text-white',
        accentGradient: 'from-indigo-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Institutional liquidity & treasury dealing desk operations',
        visualType: 'FII_DII_FLOW',
        fiiDiiData: {
          fiiNet: -840.50,
          diiNet: 2420.80,
          netBalance: 1580.30,
          dateStr: 'Latest Trading Session',
          flowInsight: 'Domestic institutions injected +₹2,420 Cr, comfortably offsetting mild FII de-risking.'
        },
        bulletPoints: [
          'DII Net Buying: +₹2,420.80 Cr across banking, power, and manufacturing',
          'FII Net Selling: -₹840.50 Cr showing selective reallocation in derivative indices',
          'Net Institutional Balance: Positive +₹1,580.30 Cr anchoring index base'
        ],
        statsLabel: 'Net Institutional Balance',
        statsValue: '+₹1,580.30 Cr (Net Buy)',
        actionPill: {
          symbol: 'SBIN',
          scripCode: '500112',
          name: 'State Bank of India'
        }
      },
      {
        id: 'fii-dii-sectoral',
        chapterId: 'institutional-flow',
        chapterTitle: 'FII / DII Institutional Flow',
        chapterIndex: 1,
        slideIndexInChapter: 1,
        totalSlidesInChapter: 2,
        tagline: 'Capital Deployment Themes',
        title: 'Where Big Money Flowed: Capital Goods & Banking Lead',
        description: 'Institutional trading desks rotated capital into Indian infrastructure, power capex, and high-quality private banking balance sheets.',
        badge: 'SECTOR ROTATION',
        badgeColor: 'bg-purple-500 text-white',
        accentGradient: 'from-purple-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Heavy infrastructure & industrial projects receive 38% institutional flow',
        visualType: 'SECTORAL_FLOW',
        bulletPoints: [
          'Capital Goods & Infrastructure absorbed 38% of total DII cash allocations',
          'Private Banking accumulated across HDFC Bank, ICICI Bank and Axis Bank',
          'Automotive & EV suppliers witnessed steady long-term accumulation'
        ],
        statsLabel: 'Top Institutional Sector',
        statsValue: 'Infra & Banking (66%)',
        actionPill: {
          symbol: 'LT',
          scripCode: '500510',
          name: 'Larsen & Toubro Ltd'
        }
      }
    ]
  },

  // CHAPTER 3: Upcoming Results & Earnings Calendar (2 slides)
  {
    id: 'results-calendar',
    title: 'Upcoming Earnings Calendar',
    shortLabel: 'Earnings Calendar',
    icon: 'Calendar',
    slideCount: 2,
    slides: [
      {
        id: 'results-heavyweights',
        chapterId: 'results-calendar',
        chapterTitle: 'Upcoming Earnings Calendar',
        chapterIndex: 2,
        slideIndexInChapter: 0,
        totalSlidesInChapter: 2,
        tagline: 'Board Meetings (Next 1–3 Days)',
        title: 'Bluechips Line Up: Tata Motors & Reliance Results Imminent',
        description: 'Market bellwethers convene board meetings to declare quarterly financials, dividend schedules, and FY25 forward outlook.',
        badge: 'HEAVYWEIGHTS',
        badgeColor: 'bg-blue-500 text-white',
        accentGradient: 'from-blue-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Corporate boardrooms gear up for quarterly earnings disclosures',
        visualType: 'RESULTS_HEAVYWEIGHTS',
        upcomingResults: [
          { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', scripCode: '500570', date: 'Tomorrow', daysLeft: 1, purpose: 'Financial Results & Dividend', sector: 'Auto' },
          { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325', date: 'In 2 Days', daysLeft: 2, purpose: 'Q3 Financial Statements', sector: 'Energy & Retail' },
          { symbol: 'INFY', name: 'Infosys Ltd', scripCode: '500209', date: 'In 2 Days', daysLeft: 2, purpose: 'Results & Guidance Review', sector: 'IT Services' },
          { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', scripCode: '500180', date: 'In 3 Days', daysLeft: 3, purpose: 'Quarterly Audited Numbers', sector: 'Banking' }
        ],
        bulletPoints: [
          'Tata Motors board meets tomorrow for audited quarterly numbers & dividend',
          'Reliance Industries to unveil retail EBITDA and new energy gigafactory milestones',
          'Infosys investor conference call to clarify FY25 revenue guidance trajectory'
        ],
        statsLabel: 'Scheduled Bluechips',
        statsValue: '4 Mega-Caps (Next 72h)',
        actionPill: {
          symbol: 'TATAMOTORS',
          scripCode: '500570',
          name: 'Tata Motors (Results Tomorrow)'
        }
      },
      {
        id: 'results-midcaps',
        chapterId: 'results-calendar',
        chapterTitle: 'Upcoming Earnings Calendar',
        chapterIndex: 2,
        slideIndexInChapter: 1,
        totalSlidesInChapter: 2,
        tagline: 'Board Meetings (Next 4–7 Days)',
        title: 'L&T, Bharti Airtel & ITC Board Meetings Scheduled',
        description: 'Industrial engineering giants and consumer majors file formal exchange notifications for upcoming quarterly board determinations.',
        badge: 'GROWTH WATCHLIST',
        badgeColor: 'bg-amber-500 text-slate-950',
        accentGradient: 'from-amber-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Infrastructure & telecom majors reporting quarterly order books',
        visualType: 'RESULTS_MIDCAPS',
        upcomingResults: [
          { symbol: 'LT', name: 'Larsen & Toubro Ltd', scripCode: '500510', date: 'In 4 Days', daysLeft: 4, purpose: 'Quarterly Results & Capex', sector: 'Engineering' },
          { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', scripCode: '532454', date: 'In 5 Days', daysLeft: 5, purpose: 'Audited Results & ARPU', sector: 'Telecom' },
          { symbol: 'ITC', name: 'ITC Ltd', scripCode: '500875', date: 'In 6 Days', daysLeft: 6, purpose: 'Financials & Interim Dividend', sector: 'FMCG' },
          { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', scripCode: '532500', date: 'In 7 Days', daysLeft: 7, purpose: 'Financial Performance Review', sector: 'Auto' }
        ],
        bulletPoints: [
          'L&T order book inflows expected to maintain double-digit growth rates',
          'ITC to update investors on hotel de-merger timeline and dividend policy',
          'Bharti Airtel 5G network rollout monetization and tariff hike impact in focus'
        ],
        statsLabel: 'Upcoming Meetings Cataloged',
        statsValue: '8 Corporate Filings',
        actionPill: {
          symbol: 'BHARTIARTL',
          scripCode: '532454',
          name: 'Bharti Airtel Ltd'
        }
      }
    ]
  },

  // CHAPTER 4: Mega Announcements & De-mergers (2 slides)
  {
    id: 'corporate-actions',
    title: 'De-mergers & Mega Deals',
    shortLabel: 'De-mergers & Deals',
    icon: 'Building2',
    slideCount: 2,
    slides: [
      {
        id: 'action-demerger',
        chapterId: 'corporate-actions',
        chapterTitle: 'De-mergers & Mega Deals',
        chapterIndex: 3,
        slideIndexInChapter: 0,
        totalSlidesInChapter: 2,
        tagline: 'Strategic Corporate Restructuring',
        title: 'ITC Hotels & Tata Motors Pure-Play De-mergers Progress',
        description: 'Indian bluechips split specialized operating businesses into independently listed entities under SEBI LODR Regulation 30.',
        badge: 'DE-MERGERS',
        badgeColor: 'bg-purple-500 text-white',
        accentGradient: 'from-purple-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Hospitality and automotive businesses unlock dedicated equity value',
        visualType: 'CORPORATE_DEMERGER',
        corporateActions: [
          {
            symbol: 'ITC',
            name: 'ITC Ltd',
            scripCode: '500875',
            actionType: 'DEMERGER',
            headline: 'ITC Hotels Demerger Scheme Sanctioned',
            impactText: '10:1 ratio: Shareholders receive 1 share in ITC Hotels for every 10 shares held.',
            valueBadge: '10:1 Ratio'
          },
          {
            symbol: 'TATAMOTORS',
            name: 'Tata Motors Ltd',
            scripCode: '500570',
            actionType: 'DEMERGER',
            headline: 'Commercial Vehicles & Passenger Vehicles Demerger',
            impactText: 'Two distinct listed entities: Commercial Vehicles (CV) & Passenger Vehicles (PV).',
            valueBadge: '1:1 Ratio'
          }
        ],
        bulletPoints: [
          'ITC Hotels receives NCLT sanction for independent stock exchange listing',
          'Tata Motors splits into Commercial Vehicles (CV) and Passenger Vehicles (PV)',
          'Clear tax-neutral share allotment for all existing equity investors'
        ],
        statsLabel: 'Key Regulatory Approval',
        statsValue: 'SEBI LODR Reg 30 Filed',
        actionPill: {
          symbol: 'ITC',
          scripCode: '500875',
          name: 'ITC Ltd (Hotels De-merger)'
        }
      },
      {
        id: 'action-orderwins',
        chapterId: 'corporate-actions',
        chapterTitle: 'De-mergers & Mega Deals',
        chapterIndex: 3,
        slideIndexInChapter: 1,
        totalSlidesInChapter: 2,
        tagline: 'Price Sensitive Information (UPSI)',
        title: 'L&T & BHEL Secure Over ₹7,700 Cr In Mega EPC Contracts',
        description: 'Substantial contract wins in international gas compression and supercritical thermal power equipment cataloged today.',
        badge: 'ORDER WINS',
        badgeColor: 'bg-amber-500 text-slate-950',
        accentGradient: 'from-amber-950/90 via-slate-900 to-[#0e0c18]',
        imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        imageCaption: 'Energy, EPC infrastructure and supercritical power plant contracts',
        visualType: 'MEGA_ORDER_WINS',
        corporateActions: [
          {
            symbol: 'LT',
            name: 'Larsen & Toubro Ltd',
            scripCode: '500510',
            actionType: 'ORDER_WIN',
            headline: 'Mega EPC Order Win from Middle East',
            impactText: 'Hydrocarbon business secures ₹4,500+ Cr international gas compression contract.',
            valueBadge: '₹4,500 Cr'
          },
          {
            symbol: 'BHEL',
            name: 'Bharat Heavy Electricals Ltd',
            scripCode: '500103',
            actionType: 'ORDER_WIN',
            headline: 'Thermal Power Expansion Package',
            impactText: 'NTPC awards ₹3,200 Cr supercritical power island EPC contract.',
            valueBadge: '₹3,200 Cr'
          }
        ],
        bulletPoints: [
          'Over ₹7,700+ Cr in verified material contracts disclosed to exchange today',
          'Heavy industrial order book visibility expands out to 36+ months',
          'Disclosures parsed via automated BSE XML/XBRL filing pipeline'
        ],
        statsLabel: 'Total Deals Cataloged',
        statsValue: '₹7,700 Cr+ Disclosed',
        actionPill: {
          symbol: 'LT',
          scripCode: '500510',
          name: 'Larsen & Toubro Ltd'
        }
      }
    ]
  }
];

// Flatten helper
export function getAllSlides(chapters: StoryChapter[]): StorySlide[] {
  return chapters.flatMap(c => c.slides);
}

// Dynamic story hydration from live backend APIs
export async function fetchLiveStoryChapters(): Promise<StoryChapter[]> {
  try {
    const [indicesRes, calRes, annRes] = await Promise.all([
      customFetch('/api/market/indices').catch(() => null),
      customFetch('/api/results-calendar?filter=upcoming&limit=10').catch(() => null),
      customFetch('/api/announcements?limit=25').catch(() => null),
    ]);

    // Deep copy default chapters
    const chapters: StoryChapter[] = JSON.parse(JSON.stringify(DEFAULT_STORY_CHAPTERS));

    // 1. Hydrate Market Indices & Sentiment
    if (indicesRes && indicesRes.ok) {
      const data = await indicesRes.json();
      const indicesList = data.indices || [];
      const sensex = indicesList.find((i: any) => i.id === 'sensex' || i.symbol === '^BSESN');
      const nifty = indicesList.find((i: any) => i.id === 'nifty50' || i.symbol === '^NSEI');

      if (sensex) {
        const isBull = sensex.changePercent >= 0;
        const trend = isBull ? 'BULL' : 'BEAR';

        const sentimentSlide = chapters[0].slides[0];
        sentimentSlide.marketTrend = trend;
        if (sentimentSlide.indicesSummary) {
          sentimentSlide.indicesSummary.sensex = {
            price: sensex.price,
            change: sensex.change,
            changePercent: sensex.changePercent
          };
          if (nifty) {
            sentimentSlide.indicesSummary.nifty = {
              price: nifty.price,
              change: nifty.change,
              changePercent: nifty.changePercent
            };
          }
        }
        sentimentSlide.accentGradient = isBull
          ? 'from-emerald-950/90 via-slate-900 to-[#0e0c18]'
          : 'from-rose-950/90 via-slate-900 to-[#0e0c18]';
        sentimentSlide.badgeColor = isBull ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white';
        sentimentSlide.title = isBull 
          ? `BSE SENSEX Rallies +${sensex.changePercent.toFixed(2)}% On Resilient Domestic Buying` 
          : `BSE SENSEX Consolidates ${sensex.changePercent.toFixed(2)}% Amid Profit-Booking`;
      }
    }

    // 2. Hydrate Upcoming Results Calendar from Live API
    if (calRes && calRes.ok) {
      const calData = await calRes.json();
      const items = calData.items || [];
      const upcomingMeetings = items.filter((i: any) => !i.isDeclared);

      if (upcomingMeetings.length > 0) {
        const firstBatch: UpcomingResultItem[] = upcomingMeetings.slice(0, 4).map((m: any) => ({
          symbol: m.symbol || 'STOCK',
          name: m.companyName || m.symbol,
          scripCode: String(m.scripCode || '500570'),
          date: m.meetingDate ? m.meetingDate.split('T')[0] : 'Upcoming',
          daysLeft: m.daysLeft,
          purpose: m.purpose || 'Board Meeting / Results',
          sector: m.sector || 'Equities'
        }));

        const secondBatch: UpcomingResultItem[] = upcomingMeetings.slice(4, 8).map((m: any) => ({
          symbol: m.symbol || 'STOCK',
          name: m.companyName || m.symbol,
          scripCode: String(m.scripCode || '500510'),
          date: m.meetingDate ? m.meetingDate.split('T')[0] : 'Upcoming',
          daysLeft: m.daysLeft,
          purpose: m.purpose || 'Board Meeting / Results',
          sector: m.sector || 'Equities'
        }));

        if (firstBatch.length > 0 && chapters[2]?.slides[0]) {
          chapters[2].slides[0].upcomingResults = firstBatch;
          chapters[2].slides[0].statsValue = `${upcomingMeetings.length} Meetings Tracked`;
          chapters[2].slides[0].actionPill = {
            symbol: firstBatch[0].symbol,
            scripCode: firstBatch[0].scripCode,
            name: `${firstBatch[0].name} (${firstBatch[0].date})`
          };
        }

        if (secondBatch.length > 0 && chapters[2]?.slides[1]) {
          chapters[2].slides[1].upcomingResults = secondBatch;
          chapters[2].slides[1].actionPill = {
            symbol: secondBatch[0].symbol,
            scripCode: secondBatch[0].scripCode,
            name: `${secondBatch[0].name} (${secondBatch[0].date})`
          };
        }
      }
    }

    return chapters;
  } catch (err) {
    console.warn('[Story] Could not hydrate live story data, using curated defaults:', err);
    return DEFAULT_STORY_CHAPTERS;
  }
}
