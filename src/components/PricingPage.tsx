import React, { useEffect } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  Zap, 
  ArrowRight, 
  ShieldCheck, 
  CreditCard, 
  Clock, 
  HelpCircle,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { SocialIconsRow } from './ui/SocialLinks';

interface PricingPageProps {
  onEnterTerminal: (tab?: string) => void;
  onOpenProModal: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ 
  onEnterTerminal, 
  onOpenProModal 
}) => {
  useEffect(() => {
    document.title = 'Pricing & Plans — 100% Free Launch Access | BSE Nexus';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Explore BSE Nexus transparent pricing. 100% Free access to Community and Pro intelligence features during launch: real-time BSE filings, Gemini AI summaries, and Telegram alerts.');
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://bsenexus.in/pricing');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-white flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Banner */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a 
              href="/" 
              onClick={(e) => {
                e.preventDefault();
                onEnterTerminal('home');
              }}
              className="flex items-center gap-2 group text-decoration-none"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                N
              </div>
              <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">
                BSE<span className="text-emerald-500">NEXUS</span>
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <a href="/pricing" className="text-emerald-600 dark:text-emerald-400 font-bold">Pricing</a>
              <a href="/guides" className="hover:text-emerald-500 transition-colors">Market Guides</a>
              <a href="/faq" className="hover:text-emerald-500 transition-colors">FAQ</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>Launch Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              <Zap className="w-3.5 h-3.5 fill-emerald-500" />
              <span>Launch Special • 100% Free Access</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Institutional Speed, Free For All Early Users
            </h1>
            
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              We are currently giving 100% free access to all Pro features — including unlimited watchlists, instant Telegram alerts, and neural Gemini AI financial breakdowns. No credit card required.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {/* Free Tier Card */}
            <div className="bg-white dark:bg-[#15141E] rounded-3xl border border-slate-200 dark:border-[#2D283E] p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Community Free</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">For retail traders & individual investors</p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Forever Free
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white font-mono">₹0</span>
                  <span className="text-xs text-slate-500 font-semibold">/ month</span>
                </div>

                <ul className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Real-time BSE Announcements (15s polling cycle)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Full coverage across all 5,000+ BSE Equities</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Standard Gemini AI Financial Summaries</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Custom Ticker Watchlists</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Personal Telegram Alert connection</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Board Meeting & Earnings Calendar</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => onEnterTerminal('dashboard')}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                >
                  <span>Launch Terminal (Free)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pro Tier Card */}
            <div className="bg-white dark:bg-[#1A1926] rounded-3xl border-2 border-emerald-500 p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 font-black text-[10px] px-3.5 py-1 rounded-bl-xl uppercase tracking-wider">
                1-WEEK FREE TRIAL
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Pro Intelligence</span>
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">For serious traders, research desks & Telegram channels</p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl line-through text-slate-400 font-mono">₹499</span>
                  <span className="text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400 font-mono">₹0</span>
                  <span className="text-xs text-slate-500 font-semibold">/ 1st week (then ₹499/mo)</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold ml-1 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    1 Week Free Trial
                  </span>
                </div>

                <ul className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Everything in Free, plus:</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Unlimited Watchlists & Priority Ticker Groups</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Broadcast to Personal & Channel Telegram</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Unlimited High-Priority Gemini AI Financial Extraction</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Filter & Mute Routine Administrative Filings</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Export Watchlists & Financial Summaries (CSV / JSON)</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <button
                  onClick={onOpenProModal}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Claim 1-Week Free Trial — ₹0</span>
                </button>
              </div>
            </div>
          </div>

          {/* Zero-Risk Guarantees & Features */}
          <div className="max-w-4xl mx-auto mb-16">
            <h2 className="text-xl sm:text-2xl font-black text-center text-slate-900 dark:text-white mb-8">
              Zero-Risk Guarantee & Operational Trust
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#15141E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <CreditCard className="w-6 h-6 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">No Credit Card Required</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Start analyzing BSE corporate disclosures immediately with zero payment method on file.
                </p>
              </div>

              <div className="bg-white dark:bg-[#15141E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">BSE & SEBI Compliant</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Direct processing of exchange feeds adhering strictly to SEBI LODR Regulation 30 & 33 frameworks.
                </p>
              </div>

              <div className="bg-white dark:bg-[#15141E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <Clock className="w-6 h-6 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">7-Day Money-Back Policy</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Should you ever subscribe to any paid plan in the future, you are covered by our 7-day refund guarantee.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-center text-slate-900 dark:text-white mb-8">
              Frequently Asked Questions About Pricing
            </h2>
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#15141E] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  How does the 1-Week Free Trial work?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Sign in with your genuine Google account to activate 1 week (7 days) of Free Pro access with full features (unlimited watchlists, AI summaries, Telegram alerts) at ₹0. After the 7-day trial, Pro is available for ₹499/month.
                </p>
              </div>

              <div className="bg-white dark:bg-[#15141E] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  Will I be automatically billed when the launch offer ends?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Never. We do not require or collect credit cards or debit cards for early access. You will never be surprised by unexpected charges or recurring billing.
                </p>
              </div>

              <div className="bg-white dark:bg-[#15141E] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  Can I use BSE Nexus Telegram alerts for group channels?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Yes! With Pro intelligence, you can connect your Telegram bot token and dispatch high-priority corporate filings directly to your private or broadcast Telegram channels.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="flex justify-center gap-4 font-semibold flex-wrap">
            <a href="/" onClick={(e) => { e.preventDefault(); onEnterTerminal('home'); }} className="hover:text-emerald-500">Home</a>
            <a href="/pricing" className="text-emerald-500">Pricing</a>
            <a href="/companies" className="hover:text-emerald-500">Companies</a>
            <a href="/guides" className="hover:text-emerald-500">Market Guides</a>
            <a href="/about" className="hover:text-emerald-500">About</a>
            <a href="/contact" className="hover:text-emerald-500">Contact</a>
            <a href="/disclaimer" className="hover:text-emerald-500">Disclaimer</a>
            <a href="/privacy-policy" className="hover:text-emerald-500">Privacy</a>
            <a href="/terms" className="hover:text-emerald-500">Terms</a>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500">Sitemap</a>
          </div>
          <div className="flex justify-center">
            <SocialIconsRow size={20} />
          </div>
          <p className="text-[11px] text-slate-400 max-w-xl mx-auto">
            BSE Nexus is an informational research terminal. We are not SEBI registered investment advisors. Financial metric summaries and AI extractions are for research purposes only.
          </p>
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} BSE Nexus Technologies. Real-time Indian Equity Intelligence.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
