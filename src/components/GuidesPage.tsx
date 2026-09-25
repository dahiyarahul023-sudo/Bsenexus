import React, { useState, useEffect } from 'react';
import { MarketGuidesSection } from './MarketGuidesSection';
import { BlogReaderModal } from './BlogReaderModal';
import { MarketGuide } from '../types';
import { ArrowRight, BookOpen, ChevronRight } from 'lucide-react';
import { SocialIconsRow } from './ui/SocialLinks';

interface GuidesPageProps {
  onEnterTerminal: (tab?: string) => void;
}

export const GuidesPage: React.FC<GuidesPageProps> = ({ onEnterTerminal }) => {
  const [selectedGuide, setSelectedGuide] = useState<MarketGuide | null>(null);

  useEffect(() => {
    document.title = 'Indian Equity Research Guides & Market Intelligence | BSE Nexus';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Practical guides and research insights for Indian stock market investors covering BSE filings, corporate actions, SEBI LODR disclosures, and equity analytics.');
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://bsenexus.in/guides');
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
              <a href="/pricing" className="hover:text-emerald-500 transition-colors">Pricing</a>
              <a href="/guides" className="text-emerald-600 dark:text-emerald-400 font-bold">Market Guides</a>
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

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Breadcrumb Bar & Page Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
            <a 
              href="/" 
              onClick={(e) => {
                e.preventDefault();
                onEnterTerminal('home');
              }} 
              className="hover:text-emerald-600"
            >
              Home
            </a>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Market Research Guides</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Indian Equity Research Guides, BSE Corporate Filings &amp; SEBI Regulations
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            In-depth forensic playbooks, earnings analysis frameworks, and regulatory guides for Indian capital markets investors deciphering Bombay Stock Exchange (BSE) filings, quarterly results, and SEBI LODR disclosures.
          </p>
        </div>

        {/* Existing Market Guides Section Component */}
        <MarketGuidesSection 
          onSelectGuide={(guide) => setSelectedGuide(guide)} 
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="flex justify-center gap-4 font-semibold flex-wrap">
            <a href="/" onClick={(e) => { e.preventDefault(); onEnterTerminal('home'); }} className="hover:text-emerald-500">Home</a>
            <a href="/pricing" className="hover:text-emerald-500">Pricing</a>
            <a href="/companies" className="hover:text-emerald-500">Companies</a>
            <a href="/guides" className="text-emerald-500">Market Guides</a>
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

      {/* Guide Reader Modal */}
      {selectedGuide && (
        <BlogReaderModal
          guide={selectedGuide}
          isOpen={!!selectedGuide}
          onClose={() => setSelectedGuide(null)}
          onOpenTerminal={() => {
            setSelectedGuide(null);
            onEnterTerminal('dashboard');
          }}
        />
      )}
    </div>
  );
};

export default GuidesPage;
