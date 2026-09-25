import React, { useEffect } from 'react';
import { Compass, ArrowRight, Home, BookOpen, CreditCard, HelpCircle } from 'lucide-react';
import { SocialIconsRow } from './ui/SocialLinks';

interface NotFoundPageProps {
  onEnterTerminal: (tab?: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onEnterTerminal }) => {
  useEffect(() => {
    document.title = 'Page Not Found (404) | BSE Nexus';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'The page you are looking for does not exist on BSE Nexus. Return to live corporate announcements or browse market guides.');
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://bsenexus.in/404');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-white flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Banner */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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

          <button
            onClick={() => onEnterTerminal('dashboard')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Launch Terminal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main 404 Hero */}
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white dark:bg-[#15141E] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
            <Compass className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Error 404
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              The page you requested could not be found or has been moved. Use the quick links below to navigate back to active market intelligence.
            </p>
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Home className="w-4 h-4" />
              <span>Go to Live Terminal</span>
            </button>

            <a
              href="/pricing"
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-decoration-none"
            >
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>View Pricing & Free Launch Access</span>
            </a>

            <a
              href="/guides"
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-decoration-none"
            >
              <BookOpen className="w-4 h-4 text-emerald-500" />
              <span>Explore Market Guides</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] py-6 text-center text-xs text-slate-500">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex flex-wrap justify-center gap-3 font-semibold text-xs">
            <a href="/" onClick={(e) => { e.preventDefault(); onEnterTerminal('home'); }} className="hover:text-emerald-500">Home</a>
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
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} BSE Nexus. Independent BSE Disclosures Aggregator. Operator: Rahul Dahiya.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default NotFoundPage;
