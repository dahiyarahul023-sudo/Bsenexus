export type UserTier = 'guest' | 'free' | 'pro' | 'admin';

export type StockPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertPriorityFilter = 'HIGH_ONLY' | 'HIGH_MEDIUM' | 'ALL';
export type AlertScopeFilter = 'WATCHLIST_ONLY' | 'ALL_MARKET';
export type AlertCategoryFilter = 'ALL' | 'RESULTS_ONLY' | 'RESULTS_AND_CONCALLS' | 'RESULTS_AND_MATERIAL';

export interface WatchlistStockItem {
  symbol: string;
  priority: StockPriority;
  category?: string;
  notes?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  is_active: number;
  items: (string | WatchlistStockItem)[];
}

export interface UserNotificationPreferences {
  resultsAndEarnings: boolean;
  orderWinsAndExpansion: boolean;
  dividendsAndBonus: boolean;
  acquisitionsAndMergers: boolean;
  creditRatings: boolean;
  muteRoutineFilings: boolean;
  muteInAppNotifications?: boolean;
  // Granular notification toggles:
  stocksHighPriority: boolean;
  stocksMediumPriority: boolean;
  stocksLowPriority: boolean;
  concallsAndInvestorMeets: boolean;
  boardMeetingsAndOutcomes: boolean;
  insiderTradingAndSAST: boolean;
  creditRatingChanges: boolean;
  annualReportsAndAudits: boolean;
  telegramNewsAlerts?: boolean;
  telegramNewsSources?: string[];
  telegramNewsCategories?: string[];
  alertPriority: AlertPriorityFilter;
  alertScope: AlertScopeFilter;
  alertCategory: AlertCategoryFilter;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  username?: string | null;
  photoURL: string | null;
  tier: UserTier;
  proExpiresAt?: number | null;
  telegramChatId?: string | null;
  telegramUsername?: string | null;
  muteInAppNotifications?: boolean;
  notificationPreferences: UserNotificationPreferences;
  createdAt: number;
  lastLoginAt: number;
  maxWatchlistStocks: number;
}

export interface AnnouncementItem {
  id?: string;
  newsId: string;
  companyName: string;
  subject: string;
  details?: string;
  pdfLink?: string;
  bseTime?: string;
  category?: string;
  priority?: string;
  is_sent?: number;
  fetched_at?: number;
  scripCode?: string;
  symbol?: string;
  aiSummary?: string;
  financialMetrics?: {
    revenueYoY?: string;
    netProfitYoY?: string;
    operatingMargin?: string;
    eps?: string;
    quarter?: string;
  };
}

export interface StockNewsItem {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  timeAgo: string;
  source: string;
  snippet: string;
  symbol?: string;
  companyName?: string;
  category: 'market' | 'watchlist' | 'earnings' | 'regulatory' | 'corporate';
  sentiment?: 'positive' | 'negative' | 'neutral';
  isWatchlist?: boolean;
}

export interface MarketGuideSection {
  heading?: string;
  title?: string;
  body?: string[];
  content?: string;
  keyPoints?: string[];
  takeaways?: string[];
  callout?: {
    type: 'warning' | 'tip' | 'info';
    text: string;
  };
}

export interface MarketGuide {
  id: string;
  slug?: string;
  title: string;
  category: string;
  readTime: string;
  summary?: string;
  excerpt?: string;
  date?: string;
  publishedAt?: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  content: {
    introduction: string;
    sections: MarketGuideSection[];
    checklist?: string[];
    conclusion: string;
  };
}

