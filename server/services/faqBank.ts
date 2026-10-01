/**
 * Curated FAQ answer bank for the public AI FAQ section.
 *
 * Layer 1 of the abuse defence: questions matching a bank entry are answered
 * instantly with ZERO Gemini API cost and WITHOUT consuming the visitor's
 * daily AI quota. Only unmatched questions fall through to the AI (Layer 2),
 * which is server-side rate limited per IP / account.
 *
 * This module is intentionally dependency-free (no imports) so that
 * server/tests/faqBank.test.ts can import it without pulling in env-gated
 * server modules. Keep every answer factual — prices Durations etc. must
 * match server/config/plans.ts and src/config/plans.ts.
 */

export interface FaqBankEntry {
  id: string;
  /** important terms that identify this question (lowercase, no punctuation) */
  keywords: string[];
  /**
   * decisive terms — when matched they score 4 instead of 1, so that a
   * discriminating word (e.g. "hindi" for the language question) beats a
   * generic family phrase (e.g. "ai summaries").
   */
  strong?: string[];
  /** example phrasings visitors use */
  phrases: string[];
  answer: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',
  'when', 'where', 'why', 'how', 'can', 'could', 'would', 'should', 'will',
  'shall', 'may', 'might', 'must', 'to', 'of', 'in', 'on', 'at', 'for',
  'with', 'about', 'as', 'by', 'from', 'or', 'and', 'but', 'if', 'then',
  'than', 'so', 'such', 'no', 'not', 'only', 'own', 'same', 'too', 'very',
  'just', 'now', 'here', 'there', 'kya', 'hai', 'ka', 'ki', 'ke', 'ko', 'me',
  'ne', 'se', 'par', 'bhi', 'aur', 'ya',
]);

/** Tiny stemmer: enough for plurals and verb forms (expires→expire, plans→plan). */
function stem(t: string): string {
  if (t.length <= 3) return t;
  if (t.endsWith('sses')) return t.slice(0, -2); // classes → class
  if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y'; // summaries → summary
  // -es → strip "es" only after s/x/z/ch/sh (charges→charg); otherwise strip just "s"
  // so that "expires"→"expire" still matches the keyword "expire".
  if (t.endsWith('es') && t.length > 4) {
    if (/(s|x|z|ch|sh)es$/.test(t)) return t.slice(0, -2);
    return t.slice(0, -1);
  }
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1); // plans → plan
  return t;
}

/**
 * Shared normalization for questions AND keywords: lowercase, drop
 * punctuation, drop stopwords, stem. Keywords go through the same pipeline
 * so "what is bsenexus" matches the tokens [bse, nexus].
 */
function normTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9₹\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => (t.length > 1 || /^\d+$/.test(t)) && !STOPWORDS.has(t))
    .map(stem);
}

/** Lowercase, strip punctuation, drop stopwords, stem. Keeps numeric tokens. */
export function faqTokens(text: string): string[] {
  return normTokens(text);
}

export const FAQ_BANK: FaqBankEntry[] = [
  // ---------------------------------------------------------------- pricing
  {
    id: 'pro-cost',
    keywords: ['cost', 'price', 'pricing', 'charge', 'plans', 'rate', 'fee'],
    phrases: ['how much does pro cost', 'what is the price', 'pricing plans', 'kitna charge hai'],
    answer:
      'Pro has 4 one-time plans: Weekly ₹59 (7 days), Monthly ₹199 (30 days, most popular), 6-Month ₹999 (180 days), and Yearly ₹1,799 (365 days, best value). No subscription — you pay once per plan.',
  },
  {
    id: 'monthly-price',
    keywords: ['monthly', 'month', '199'],
    phrases: ['monthly plan price', 'how much per month', 'cost for one month'],
    answer:
      'Pro Monthly is ₹199 for 30 days — it is the most popular plan. It is a one-time payment; nothing renews automatically.',
  },
  {
    id: 'weekly-price',
    keywords: ['weekly', 'week', '59'],
    phrases: ['weekly plan price', 'cheapest short plan', 'price for one week'],
    answer: 'Pro Weekly is ₹59 for 7 days — the cheapest way to try full Pro. One-time payment, no auto-renewal.',
  },
  {
    id: 'yearly-price',
    keywords: ['yearly', 'annual', 'year', '1799'],
    phrases: ['yearly plan price', 'yearly plan cost', 'annual subscription cost', 'price for one year'],
    answer:
      'Pro Yearly is ₹1,799 for 365 days — the best-value plan at roughly ₹150/month. One-time payment, no auto-renewal.',
  },
  {
    id: 'halfyearly-price',
    keywords: ['half', '6-month', '6 month', '999', 'six'],
    phrases: ['6 month plan price', 'half yearly cost'],
    answer: 'The 6-Month Pro plan is ₹999 for 180 days. One-time payment, no auto-renewal.',
  },
  {
    id: 'cheapest-plan',
    keywords: ['cheapest', 'lowest', 'minimum', 'sasta'],
    phrases: ['which is the cheapest plan', 'lowest price plan', 'minimum cost'],
    answer: 'The cheapest plan is Pro Weekly at ₹59 for 7 days.',
  },
  {
    id: 'best-value',
    keywords: ['best', 'value', 'recommend', 'which plan', 'suggest'],
    phrases: ['which plan is best', 'which plan should i take', 'best value plan', 'recommend a plan'],
    answer:
      'Yearly (₹1,799) is the best value — about ₹150/month, roughly 25% cheaper than paying monthly. Monthly (₹199) is the most popular if you prefer short commitment.',
  },
  {
    id: 'discount',
    keywords: ['discount', 'coupon', 'offer', 'promo', 'deal', 'sale'],
    phrases: ['any discount available', 'do you have coupons', 'is there an offer'],
    answer:
      'The Monthly plan shows a 60% launch discount (₹199 instead of ₹499). Every new account also gets a 7-day free Pro trial with no card required.',
  },
  {
    id: 'payment-methods',
    keywords: ['upi', 'card', 'netbanking', 'net banking', 'pay', 'payment method', 'gpay', 'phonepe'],
    phrases: ['how can i pay', 'which payment methods', 'can i pay with upi', 'do you accept cards'],
    answer: 'Payments go through Cashfree and support UPI, credit/debit cards, and netbanking.',
  },
  {
    id: 'one-time',
    keywords: ['subscription', 'recurring', 'auto-renew', 'auto renew', 'autorenew', 'auto debit', 'renewal'],
    phrases: ['is it a subscription', 'will i be charged every month', 'does it auto renew', 'is there auto debit'],
    answer:
      'No. All plans are one-time payments for their duration — there is no subscription and no auto-renewal. When a plan ends, Pro simply switches off.',
  },
  {
    id: 'refund',
    keywords: ['refund', 'money back', 'return'],
    phrases: ['what is the refund policy', 'can i get a refund', 'money back'],
    answer:
      'Plans are one-time payments. If your payment did not activate Pro, use the "restore with Order ID" option in Settings → Subscription & Billing, or contact support with your order ID.',
  },
  {
    id: 'free-tier',
    keywords: ['free', 'without paying', 'zero'],
    phrases: ['is there a free plan', 'what is free', 'can i use for free', 'free tier features'],
    answer:
      'Yes — the Free tier (₹0) includes live BSE announcements, the results calendar, and one one-time AI filing-summary demo. Watchlists and Telegram alerts need Pro.',
  },
  // ---------------------------------------------------------------- trial
  {
    id: 'trial-length',
    keywords: ['trial', 'free trial'],
    phrases: ['how long is the free trial', 'trial duration', 'free trial kitne din'],
    answer: 'The free trial is 7 days with full Pro access.',
  },
  {
    id: 'trial-card',
    keywords: ['card', 'credit card', 'debit card', 'card required'],
    phrases: ['do i need a card for trial', 'is card required for free trial'],
    answer: 'No card is required for the 7-day free trial.',
  },
  {
    id: 'trial-after',
    keywords: ['after trial', 'trial ends', 'trial over', 'trial expires'],
    phrases: ['what happens after trial ends', 'what happens when trial is over'],
    answer:
      'When the trial ends you move to the Free tier automatically. Nothing is ever charged — there is no card on file to charge.',
  },
  {
    id: 'trial-included',
    keywords: ['trial includes', 'trial features', 'trial access'],
    phrases: ['what is included in trial', 'what do i get in free trial'],
    answer:
      'The trial unlocks everything in Pro for 7 days: unlimited watchlists, Telegram alerts, AI filing summaries, smart filters, and exports.',
  },
  {
    id: 'trial-start',
    keywords: ['start trial', 'activate trial', 'begin trial'],
    phrases: ['how to start free trial', 'how do i activate trial'],
    answer: 'Sign in with Google — your 7-day free Pro trial starts automatically. No card, no payment step.',
  },
  {
    id: 'trial-vs-pro',
    keywords: ['trial vs pro', 'trial versus pro', 'difference trial'],
    phrases: ['difference between trial and pro', 'trial vs paid'],
    answer:
      'The trial is 7 days of full Pro, free, with no card. Pro is the same feature set on a paid one-time plan (Weekly/Monthly/6-Month/Yearly) after the trial.',
  },
  // ---------------------------------------------------------------- account
  {
    id: 'signup',
    keywords: ['sign up', 'signup', 'create account', 'register', 'new account'],
    phrases: ['how to create an account', 'how to sign up', 'how to register'],
    answer: 'Tap Sign In and continue with Google — your account is created instantly. No separate password needed.',
  },
  {
    id: 'login',
    keywords: ['log in', 'login', 'sign in', 'signin'],
    phrases: ['how to log in', 'how to sign in'],
    answer: 'Use the Sign In button and continue with Google.',
  },
  {
    id: 'guest-mode',
    keywords: ['guest', 'without login', 'without account', 'skip login'],
    phrases: ['can i use without login', 'is guest mode available', 'use without account'],
    answer:
      'You can continue as a guest to explore, but watchlists, Telegram alerts, and Pro features need a signed-in account.',
  },
  {
    id: 'no-password',
    keywords: ['password', 'forgot password', 'reset password'],
    phrases: ['i forgot my password', 'how to reset password'],
    answer: 'Bsenexus uses Google sign-in, so there is no Bsenexus password to reset. Recover access via your Google account.',
  },
  {
    id: 'delete-account',
    keywords: ['delete account', 'remove account', 'close account'],
    phrases: ['how to delete my account', 'remove my account'],
    answer: 'You can request account deletion from Settings or by contacting support — your data is removed with the account.',
  },
  // ---------------------------------------------------------------- watchlists
  {
    id: 'watchlist-what',
    keywords: ['watchlist', 'watchlists'],
    phrases: ['what is a watchlist', 'what are watchlists', 'watchlist meaning'],
    answer:
      'A watchlist is your personal list of stocks. Bsenexus builds a live filings feed for each stock on it, so you never miss an announcement for companies you follow.',
  },
  {
    id: 'watchlist-create',
    keywords: ['create watchlist', 'add stock', 'new watchlist', 'add scrip'],
    phrases: ['how to create a watchlist', 'how to add stocks to watchlist'],
    answer:
      'Open the Watchlists tab, create a list, then search any BSE scrip and add it. Watchlists are a Pro feature (included in the free trial).',
  },
  {
    id: 'watchlist-limit',
    keywords: ['how many watchlists', 'watchlist limit', 'stocks limit'],
    phrases: ['how many watchlists can i create', 'is there a limit on watchlists'],
    answer: 'Pro supports unlimited watchlists with unlimited stocks in each.',
  },
  {
    id: 'watchlist-priority',
    keywords: ['priority', 'high', 'medium', 'low'],
    phrases: ['what is stock priority', 'what does high med low mean'],
    answer:
      'Each stock in a watchlist gets a priority — HIGH, MED, or LOW — which controls how prominently its alerts surface. A stock in multiple lists uses its highest priority.',
  },
  {
    id: 'watchlist-free',
    keywords: ['watchlist free', 'free watchlist'],
    phrases: ['are watchlists free', 'watchlist on free tier', 'free me watchlist'],
    answer: 'Watchlists need Pro (or the 7-day free trial). The Free tier does not include watchlists.',
  },
  // ---------------------------------------------------------------- telegram
  {
    id: 'telegram-what',
    keywords: ['telegram', 'telegram notification'],
    phrases: ['what are telegram alerts', 'telegram alerts meaning', 'what is telegram notification'],
    answer:
      'Telegram alerts message you the moment a stock on your watchlist files a new BSE announcement — results, dividends, board meetings, and more.',
  },
  {
    id: 'telegram-setup',
    keywords: ['link telegram', 'connect telegram', 'setup telegram', 'telegram setup'],
    phrases: ['how to link telegram', 'how to connect telegram', 'how to set up telegram alerts'],
    answer: 'Go to Settings → Telegram and link your Telegram account via the bot. Then alerts for your watchlists start flowing. It is a Pro feature.',
  },
  {
    id: 'telegram-events',
    keywords: ['which alerts', 'alert types', 'what events'],
    phrases: ['which events trigger alerts', 'what will i get alerts for'],
    answer:
      'You get alerts for new filings on your watched stocks: quarterly results, dividends, board meetings, acquisitions, and other material announcements.',
  },
  {
    id: 'telegram-free',
    keywords: ['telegram free', 'free telegram'],
    phrases: ['are telegram alerts free', 'telegram on free tier'],
    answer: 'Telegram alerts are a Pro feature (included in the 7-day free trial). The Free tier does not include them.',
  },
  {
    id: 'telegram-channel',
    keywords: ['channel', 'group'],
    phrases: ['can alerts go to a channel', 'telegram channel alerts', 'send alerts to group'],
    answer: 'Yes — Pro can broadcast alerts to your personal chat as well as your Telegram channels and groups.',
  },
  // ---------------------------------------------------------------- filings & data
  {
    id: 'what-is',
    keywords: ['what is bsenexus', 'about', 'app kya hai'],
    phrases: ['what is bsenexus', 'tell me about bsenexus', 'what does bsenexus do'],
    answer:
      'Bsenexus structures official BSE India corporate announcements into a searchable feed — filings, quarterly results, and board meetings — with AI filing summaries, a results calendar, watchlists, and Telegram alerts on top.',
  },
  {
    id: 'data-source',
    keywords: ['data source', 'where data', 'source of data', 'filings from'],
    phrases: ['where does the data come from', 'what is the source of filings', 'where do you get data'],
    answer: 'All disclosures come from official BSE India filings (bseindia.com). Always verify critical figures on bseindia.com.',
  },
  {
    id: 'coverage',
    keywords: ['how many companies', 'coverage', 'stocks covered', 'scrips'],
    phrases: ['how many companies covered', 'which stocks are covered', 'coverage of stocks'],
    answer: 'Bsenexus covers 5,000+ BSE-listed scrips — effectively the full BSE equity universe.',
  },
  {
    id: 'update-frequency',
    keywords: ['update', 'real time', 'real-time', 'live', 'how fast', 'delay'],
    phrases: ['how often is data updated', 'is it real time', 'how fast are filings updated'],
    answer: 'Filings are synced continuously from BSE India, so new announcements appear on the site shortly after the company discloses them.',
  },
  {
    id: 'results-calendar',
    keywords: ['results calendar', 'earnings calendar', 'result dates', 'board meeting'],
    phrases: ['what is results calendar', 'where are earnings dates', 'board meeting dates'],
    answer:
      'The Results Calendar tab shows upcoming board meetings, quarterly result periods, and dividend agendas, synced from official BSE disclosures.',
  },
  {
    id: 'lodr',
    keywords: ['lodr', 'regulation 30', 'regulation 33', 'sebi'],
    phrases: ['what is lodr', 'what is regulation 30', 'sebi disclosure rules'],
    answer:
      'Under SEBI LODR Regulations 30 and 33, listed companies must disclose material events — results, dividends, acquisitions. Bsenexus parses these official PDF filings into readable summaries.',
  },
  {
    id: 'company-page',
    keywords: ['company page', 'reliance', 'tcs', 'stock page', 'scrip page'],
    phrases: ['how to check a company', 'where is reliance page', 'company filings page'],
    answer:
      'Search any BSE scrip or open its company page (e.g. /company/RELIANCE) for filings history, upcoming board meetings, price data, and peer comparison.',
  },
  // ---------------------------------------------------------------- AI summaries
  {
    id: 'ai-summary-what',
    keywords: ['ai summary', 'ai summaries', 'summary'],
    phrases: ['what are ai summaries', 'what is ai filing summary', 'how do ai summaries work'],
    answer:
      'AI summaries turn long official filing PDFs into short readable briefs — key figures like revenue, PAT, and EBITDA extracted automatically by Gemini AI.',
  },
  {
    id: 'ai-language',
    keywords: ['language', 'hindi', 'hinglish', 'english'],
    strong: ['language', 'hindi', 'hinglish', 'english'],
    phrases: ['what language are summaries in', 'are summaries in hindi', 'summaries in hindi', 'hinglish summary'],
    answer: 'AI summaries generate in English by default, with a Hinglish toggle beside the AI digest.',
  },
  {
    id: 'ai-free-demo',
    keywords: ['ai demo', 'free ai', 'one-time demo', 'try ai'],
    phrases: ['is there a free ai demo', 'can i try ai summary free'],
    answer: 'Yes — the Free tier includes exactly one one-time AI filing-summary demo. Unlimited summaries need Pro.',
  },
  {
    id: 'ai-accuracy',
    keywords: ['accurate', 'reliable', 'trust', 'correct'],
    phrases: ['are ai summaries accurate', 'can i trust ai summaries'],
    answer:
      'Summaries are generated directly from the official filing text, but AI can misread. Always verify critical figures on bseindia.com before acting.',
  },
  // ---------------------------------------------------------------- pro features
  {
    id: 'export',
    keywords: ['export', 'csv', 'download', 'json'],
    phrases: ['can i export data', 'export watchlist csv', 'download data'],
    answer: 'Pro lets you export watchlists and financial summaries as CSV or JSON.',
  },
  {
    id: 'smart-mute',
    keywords: ['mute', 'filter', 'routine', 'administrative', 'hide'],
    phrases: ['can i mute routine filings', 'filter administrative announcements', 'hide routine filings'],
    answer: 'Pro includes a smart filter that mutes routine administrative filings so your feed shows only meaningful disclosures.',
  },
  {
    id: 'docket-export',
    keywords: ['docket', 'docket download'],
    phrases: ['what is docket export', 'export results docket'],
    answer: 'Pro includes results-docket export from the Results Calendar — handy for tracking earnings season offline.',
  },
  {
    id: 'priority-server',
    keywords: ['priority server', 'faster', 'speed'],
    phrases: ['what is priority server', 'is pro faster'],
    answer: 'Pro runs on priority ingestion servers, so filings and AI summaries reach you faster than on the Free tier.',
  },
  // ---------------------------------------------------------------- support & misc
  {
    id: 'contact-support',
    keywords: ['contact', 'support', 'help', 'email support', 'customer care'],
    phrases: ['how to contact support', 'support email', 'need help', 'contact us'],
    answer: 'Use the Help / Support option in Settings to reach us — include your order ID for payment issues.',
  },
  {
    id: 'affiliated',
    keywords: ['affiliated', 'official', 'real bse', 'genuine', 'fraud', 'scam', 'legit'],
    strong: ['affiliated', 'fraud', 'scam'],
    phrases: ['is bsenexus official', 'are you affiliated with bse', 'is this genuine'],
    answer:
      'Bsenexus is not affiliated with BSE India Ltd, SEBI, or Nexus Select Trust. All disclosures shown originate from official BSE India filings.',
  },
  {
    id: 'pro-expire',
    keywords: ['expire', 'expiry', 'ends', 'over', 'after pro'],
    phrases: ['what happens when pro expires', 'what happens after plan ends', 'pro expiry'],
    answer:
      'Your Pro badge and paid features switch off automatically on expiry — no action needed. Watchlists and settings stay saved for when you return.',
  },
];

/** Best entry whose score clears the threshold, else null. */
export function findBankAnswer(question: string): { id: string; answer: string; score: number } | null {
  const qTokens = faqTokens(question);
  if (qTokens.length === 0) return null;
  const qSet = new Set(qTokens);
  const qNorm = ' ' + qTokens.join(' ') + ' ';

  let best: { id: string; answer: string; score: number } | null = null;

  for (const entry of FAQ_BANK) {
    // 1) keyword hits over normalized (stopword-stripped, stemmed) tokens.
    //    "strong" keywords score 4 — they disambiguate within a family
    //    (e.g. "hindi" routes to the language answer, not the generic
    //    AI-summary answer). Duplicate stemmed forms count once.
    let kwScore = 0;
    const strongSet = new Set((entry.strong || []).flatMap((s) => normTokens(s)));
    const seenKw = new Set<string>();
    for (const kw of entry.keywords) {
      const kwTokens = normTokens(kw);
      if (kwTokens.length === 0) continue;
      const key = kwTokens.join(' ');
      if (seenKw.has(key)) continue;
      seenKw.add(key);
      if (kwTokens.every((t) => qSet.has(t))) {
        const base = kwTokens.length >= 2 ? 2 : 1; // multi-word keyword = stronger signal
        const isStrong = kwTokens.some((t) => strongSet.has(t));
        kwScore += isStrong ? 4 : base;
      } else if (qNorm.includes(' ' + kw.toLowerCase() + ' ')) {
        kwScore += 0.75;
      }
    }
    if (kwScore === 0) continue;

    // 2) phrase bonus: token-overlap with the closest example phrasing
    let phraseBonus = 0;
    for (const phrase of entry.phrases) {
      const pTokens = new Set(faqTokens(phrase));
      if (pTokens.size === 0) continue;
      let inter = 0;
      for (const t of qSet) if (pTokens.has(t)) inter++;
      const overlap = (2 * inter) / (qSet.size + pTokens.size);
      phraseBonus = Math.max(phraseBonus, overlap * 4);
    }

    const score = kwScore + phraseBonus;
    if (!best || score > best.score) best = { id: entry.id, answer: entry.answer, score };
  }

  // Threshold: needs a real signal, not one stray keyword.
  if (best && best.score >= 2.5) return best;
  return null;
}

/** How many curated entries the bank holds (surfaced in health/debug). */
export function faqBankSize(): number {
  return FAQ_BANK.length;
}
