import React, { useEffect } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  FileText, 
  AlertTriangle, 
  ExternalLink, 
  CheckCircle2, 
  ArrowLeft,
  ChevronRight,
  Lock,
  Globe,
  HelpCircle,
  Building2,
  Sparkles
} from 'lucide-react';
import { SocialIconsRow } from './ui/SocialLinks';
import { BseNexusLogo } from './ui/BseNexusLogo';

interface TrustPageProps {
  type: 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer';
  onEnterTerminal: (tab?: string) => void;
}

export const TrustPage: React.FC<TrustPageProps> = ({ type, onEnterTerminal }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type]);

  const renderContent = () => {
    switch (type) {
      case 'about':
        return (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>About BSE Nexus</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                About BSE Nexus
              </h1>
              <p className="text-sm text-slate-400">
                Independent real-time corporate announcements indexer for Indian capital markets.
              </p>
            </div>

            {/* Core User Brief Statement - One honest paragraph, no hype */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#121624] border border-emerald-500/30 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Who We Are & What We Do</span>
              </h2>
              <p className="text-slate-200 text-base sm:text-lg leading-relaxed font-medium">
                BSE Nexus is an independent BSE corporate announcement aggregator run by Rahul Dahiya, contact <a href="mailto:admin@bsenexus.in" className="text-emerald-400 underline hover:text-emerald-300 font-bold">admin@bsenexus.in</a>.
              </p>
            </div>

            {/* Detailed Philosophy & Mission */}
            <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white">Our Mission</h3>
                <p>
                  Every trading day, thousands of public listed companies file critical disclosures with the Bombay Stock Exchange (BSE India)—including quarterly financial results, SEBI LODR Regulation 30 corporate actions, board meeting intimations, dividend announcements, and auditor disclosures.
                </p>
                <p>
                  BSE Nexus was built to make these regulatory filings instantly discoverable, transparent, and structured for equity researchers, independent investors, analysts, and market participants across India.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white">Core Capabilities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#111522] border border-slate-800 space-y-1.5">
                    <div className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Sub-Minute Filing Ingestion</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Automated high-frequency pollers indexing BSE disclosures within seconds of release on the exchange.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111522] border border-slate-800 space-y-1.5">
                    <div className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>AI Financial Summaries</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Automated YoY and QoQ revenue/PAT metric extraction from multi-page quarterly earnings filings.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111522] border border-slate-800 space-y-1.5">
                    <div className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Custom Watchlists & Telegram Alerts</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Personalized stock feeds and automated bot dispatches directly to private channels without delay.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111522] border border-slate-800 space-y-1.5">
                    <div className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>1-Click Original PDF Filings</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Direct verification links to official XBRL/PDF attachments hosted by BSE India.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#111522] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Have questions or feedback?</h4>
                  <p className="text-xs text-slate-400">Reach out directly to Rahul Dahiya via email.</p>
                </div>
                <a
                  href="mailto:admin@bsenexus.in"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2 shrink-0"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>admin@bsenexus.in</span>
                </a>
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>Contact Information</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Contact Rahul Dahiya / BSE Nexus
              </h1>
              <p className="text-sm text-slate-400">
                We are open to user inquiries, developer feedback, data correction requests, and institutional collaboration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-[#121624] border border-slate-800 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-white">Official Support & Administration</h2>
                  <p className="text-xs text-slate-400">Direct contact for general inquiries, bug reports, or feature suggestions.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800/80 font-mono text-sm text-emerald-400 font-bold flex items-center justify-between">
                  <span>admin@bsenexus.in</span>
                  <a href="mailto:admin@bsenexus.in" className="text-xs text-slate-400 hover:text-white underline font-sans">Send Email</a>
                </div>
                <p className="text-xs text-slate-500">Typical response time: Within 24 business hours.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#121624] border border-slate-800 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-white">Official Social Channels</h2>
                  <p className="text-xs text-slate-400">Follow our verified handles for announcement updates and platform news.</p>
                </div>
                <div className="pt-2">
                  <SocialIconsRow size={24} />
                </div>
                <div className="text-xs text-slate-400 space-y-1.5 pt-2">
                  <div>• Telegram Community: <a href="https://t.me/BseNexusDiscussion" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">t.me/BseNexusDiscussion</a> (Join Discussion)</div>
                  <div>• Telegram Channel: <a href="https://t.me/BseNexusOfficial" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">@BseNexusOfficial</a></div>
                  <div>• LinkedIn: <a href="https://www.linkedin.com/company/bse-nexus" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">linkedin.com/company/bse-nexus</a></div>
                  <div>• X / Twitter: <a href="https://x.com/bsenexus" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">@bsenexus</a></div>
                  <div>• Instagram: <a href="https://instagram.com/bsenexus" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">@bsenexus</a></div>
                  <div>• Threads: <a href="https://threads.net/@bsenexus" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">@bsenexus</a></div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#121624] border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">Platform Governance & Operator</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                BSE Nexus is independently operated by <strong className="text-slate-200">Rahul Dahiya</strong>. For regulatory queries, privacy questions, or data removal requests, please write with relevant subject headers to <code className="text-emerald-400 bg-[#0B0F19] px-1.5 py-0.5 rounded font-mono">admin@bsenexus.in</code>.
              </p>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Privacy & Data Protection</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-sm text-slate-400">
                Last updated: September 2026 • Effective immediately
              </p>
            </div>

            <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs">
                <strong>Our Core Privacy Commitment:</strong> BSE Nexus does not sell, rent, monetize, or trade your personal data. We collect only what is strictly necessary to provide real-time equity market tools and Telegram alert dispatches.
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">1. Information We Collect</h2>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-400 text-xs sm:text-sm">
                  <li><strong>Account Details:</strong> When you sign in or create an account, we store your email address and display name for session authentication.</li>
                  <li><strong>User Preferences & Watchlists:</strong> Your customized stock tickers, alert priority preferences, and theme choices are stored locally and synced securely with your account.</li>
                  <li><strong>Telegram Webhook Credentials:</strong> If you configure private Telegram notifications, your bot token and chat ID are stored strictly for routing alerts to your designated endpoint.</li>
                  <li><strong>Technical Telemetry:</strong> Standard non-identifying server logs (IP address, user-agent, response codes) retained temporarily for security auditing, rate limiting, and DDoS defense.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">2. How Information Is Used</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  We use the information collected exclusively to operate, maintain, and enhance the BSE Nexus terminal, dispatch user-requested alerts, monitor system performance, and prevent fraudulent abuse.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">3. Cookies & Local Storage</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  BSE Nexus uses functional cookies and browser LocalStorage to remember your active tabs, sound alert toggles, filter preferences, and session tokens. We do not use third-party behavioral advertising cookies.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">4. Data Security & Storage</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  All communication between your browser and our servers is encrypted using modern TLS (HTTPS). Sensitive session keys and authentication states are protected with HTTP-only security cookies and strict access controls.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">5. Your Data Rights</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  You may request complete deletion of your account, watchlists, and associated data at any time by emailing <a href="mailto:admin@bsenexus.in" className="text-emerald-400 underline">admin@bsenexus.in</a> with the subject line "Data Deletion Request".
                </p>
              </div>
            </div>
          </div>
        );

      case 'terms':
        return (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Terms of Service</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Terms of Service
              </h1>
              <p className="text-sm text-slate-400">
                Last updated: September 2026 • Please read carefully before using BSE Nexus
              </p>
            </div>

            <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">1. Acceptance of Terms</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  By accessing or using BSE Nexus (bsenexus.in), you agree to be bound by these Terms of Service. If you do not agree with these terms, please discontinue use of the platform.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">2. Nature of the Service</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  BSE Nexus is an automated information indexing terminal designed to aggregate public disclosures made by listed companies on the Bombay Stock Exchange (BSE India). BSE Nexus is not an exchange, broker, dealer, or financial advisory firm.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">3. Acceptable Use Policy</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  You agree to use BSE Nexus solely for lawful purposes. You shall not attempt to reverse engineer, scrape at abusive frequencies, disrupt server infrastructure, or circumvent rate limits.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">4. Intellectual Property & Disclosures Ownership</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  All underlying corporate announcement PDFs, filings, and regulatory submissions remain the property of their respective issuing companies and the Bombay Stock Exchange. BSE Nexus software code, UI designs, and synthesis logic are protected proprietary property.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">5. Limitation of Liability</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  BSE Nexus, its operator Rahul Dahiya, and affiliates shall not be held liable for any direct, indirect, incidental, or consequential damages resulting from reliance on data, delays in exchange feeds, AI extraction discrepancies, or downtime.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">6. Contact & Questions</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  For questions regarding these Terms, contact <a href="mailto:admin@bsenexus.in" className="text-emerald-400 underline">admin@bsenexus.in</a>.
                </p>
              </div>
            </div>
          </div>
        );

      case 'disclaimer':
        return (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Legal & Regulatory Disclaimer</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Disclaimer & Entity Clarity
              </h1>
              <p className="text-sm text-slate-400">
                Important disclosures on independence, exchange affiliation, and financial advice.
              </p>
            </div>

            {/* Core User Requirement Callout */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#14121A] border border-amber-500/30 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Official Independence & Non-Affiliation Statement</span>
              </div>
              <p className="text-slate-100 text-base sm:text-lg font-semibold leading-relaxed">
                BSE Nexus is not affiliated with BSE India Ltd, SEBI, or any exchange; informational use only; not investment advice; verify filings on <a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">bseindia.com</a>.
              </p>
            </div>

            <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">1. Informational & Research Purpose Only</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  All data, corporate announcements, financial metric summaries, earnings dates, and AI analysis presented on BSE Nexus are provided strictly for informational and educational purposes. Nothing on this website constitutes a recommendation, endorsement, solicitation, or offer to buy or sell securities, derivatives, or financial instruments.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">2. Not SEBI-Registered Investment Advice</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  BSE Nexus and Rahul Dahiya are not registered as investment advisors, research analysts, or portfolio managers under SEBI (Investment Advisers) Regulations, 2013 or SEBI (Research Analysts) Regulations, 2014. Users must consult a SEBI-registered financial advisor before making any investment or trading decisions.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">3. Mandatory Verification of Source Filings</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  While our automated systems strive for high precision and ultra-low latency, transmission anomalies, OCR misreadings, or upstream exchange delays may occur. Always cross-verify critical announcements, financial tables, and board resolutions directly on the official exchange website at <a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">bseindia.com</a>.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-white">4. Distinct Entity Notice</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  BSE Nexus is an independent technology project and has no corporate, commercial, or operational connection with <strong>Nexus Select Trust</strong> (BSE Scrip Code: 543913), BSE Limited (Bombay Stock Exchange), or National Stock Exchange of India (NSE).
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <BseNexusLogo className="w-7 h-7" />
            <span className="font-black text-base text-white tracking-tight">
              BSE<span className="text-emerald-400">NEXUS</span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              Home
            </a>
            <a
              href="/companies"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              Companies
            </a>
            <a
              href="/guides"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              Guides
            </a>
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Launch Terminal
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-8 font-medium">
          <a href="/" className="hover:text-emerald-400 transition-colors">Home</a>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 capitalize">{type === 'privacy' ? 'Privacy Policy' : type}</span>
        </div>

        {renderContent()}

        {/* Quick Navigation Between Trust Pages */}
        <div className="mt-12 pt-8 border-t border-slate-800/80">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Trust & Legal Navigation</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a href="/about" className={`px-3 py-1.5 rounded-lg border transition-colors ${type === 'about' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-[#111522] border-slate-800 text-slate-300 hover:border-slate-700'}`}>
              About Us
            </a>
            <a href="/contact" className={`px-3 py-1.5 rounded-lg border transition-colors ${type === 'contact' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-[#111522] border-slate-800 text-slate-300 hover:border-slate-700'}`}>
              Contact
            </a>
            <a href="/disclaimer" className={`px-3 py-1.5 rounded-lg border transition-colors ${type === 'disclaimer' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-[#111522] border-slate-800 text-slate-300 hover:border-slate-700'}`}>
              Disclaimer
            </a>
            <a href="/privacy-policy" className={`px-3 py-1.5 rounded-lg border transition-colors ${type === 'privacy' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-[#111522] border-slate-800 text-slate-300 hover:border-slate-700'}`}>
              Privacy Policy
            </a>
            <a href="/terms" className={`px-3 py-1.5 rounded-lg border transition-colors ${type === 'terms' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-[#111522] border-slate-800 text-slate-300 hover:border-slate-700'}`}>
              Terms of Service
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0B0F19] text-slate-400 text-xs py-10 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <BseNexusLogo className="w-6 h-6" />
              <span className="font-bold text-white text-sm">
                BSE<span className="text-emerald-400">NEXUS</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              <a href="/about" className="hover:text-emerald-400 transition-colors">About</a>
              <a href="/contact" className="hover:text-emerald-400 transition-colors">Contact</a>
              <a href="/disclaimer" className="hover:text-emerald-400 transition-colors">Disclaimer</a>
              <a href="/privacy-policy" className="hover:text-emerald-400 transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-emerald-400 transition-colors">Terms</a>
              <a href="/companies" className="hover:text-emerald-400 transition-colors">Companies</a>
              <a href="/guides" className="hover:text-emerald-400 transition-colors">Guides</a>
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">Sitemap</a>
            </div>
          </div>
          <div className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <div>© {new Date().getFullYear()} BSE Nexus. Independent BSE Disclosures Aggregator. Operator: Rahul Dahiya.</div>
            <SocialIconsRow size={18} />
          </div>
        </div>
      </footer>
    </div>
  );
};
