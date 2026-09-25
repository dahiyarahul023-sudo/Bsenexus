import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, Scale, Lock, FileCheck, Info, 
  Cookie, RefreshCcw, Building2, UserCheck, CheckCircle2, 
  ExternalLink, Download, Search, AlertTriangle, HelpCircle,
  Database, Server, Cpu, ShieldCheck, Mail, MapPin, Phone
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { getCookieConsent, saveCookieConsent, resetCookieConsent } from '../utils/cookieConsent';

export type LegalTabType = 'terms' | 'privacy' | 'cookies' | 'refund' | 'sebi' | 'audit' | 'grievance';

export interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTabType;
}

export function TermsModal({ isOpen, onClose, initialTab = 'terms' }: TermsModalProps) {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const navItems: { id: LegalTabType; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'sebi', label: 'SEBI Disclaimer', icon: ShieldAlert, badge: 'Statutory' },
    { id: 'terms', label: 'Terms of Service', icon: Scale },
    { id: 'privacy', label: 'Privacy Policy', icon: Lock, badge: 'DPDP 2023' },
    { id: 'cookies', label: 'Cookie & Storage', icon: Cookie },
    { id: 'refund', label: 'Refund & Billing', icon: RefreshCcw },
    { id: 'audit', label: '3rd-Party & SDK Audit', icon: Cpu },
    { id: 'grievance', label: 'Business & Grievance', icon: Building2 }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-center-title"
    >
      <div 
        className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full h-[90vh] max-h-[850px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Scale size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="legal-center-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Legal, Privacy &amp; Regulatory Center
                </h3>
                <span className="hidden sm:inline-flex text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-300/40">
                  Compliant 2026
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                SEBI Disclaimers, Terms of Service, DPDP Act 2023, Cookie Policy &amp; Grievance Redressal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Close legal compliance center"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0B1120] overflow-x-auto no-scrollbar shrink-0 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon size={14} className={isActive ? '' : 'text-slate-400'} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                    isActive 
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black' 
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Body Area */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed overscroll-contain">
          
          {/* ========================================================= */}
          {/* TAB 1: SEBI & FINANCIAL DISCLAIMER */}
          {/* ========================================================= */}
          {activeTab === 'sebi' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Mandatory SEBI Statutory Warning Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2 font-black text-amber-900 dark:text-amber-200 text-sm">
                  <ShieldAlert size={18} className="text-amber-600 shrink-0" />
                  <span>MANDATORY STATUTORY WARNING (SEBI REGULATIONS)</span>
                </div>
                <div className="text-[12px] text-amber-950 dark:text-amber-100 space-y-2 leading-relaxed">
                  <p className="font-bold">
                    &ldquo;Investments in securities market are subject to market risks. Read all the related documents carefully before investing.&rdquo;
                  </p>
                  <p>
                    <strong>BSE Nexus is NOT a SEBI-registered Research Analyst, Investment Adviser, Portfolio Manager, or Broker</strong> under the Securities and Exchange Board of India (Research Analysts) Regulations, 2014 or SEBI (Investment Advisers) Regulations, 2013.
                  </p>
                  <p>
                    Nothing contained on this application, including algorithmic alerts, YoY financial breakdowns, corporate action classifications, or market pulse feeds, shall be construed as stock recommendations, buy/sell tips, trading calls, portfolio guidance, or financial advisory.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck size={16} className="text-indigo-500" />
                  <span>Educational &amp; Analytical Technology Only</span>
                </h4>
                <p>
                  BSE Nexus is an automated information dissemination tool and data aggregation terminal. It parses public corporate filings published by companies on the official regulatory feeds of the Bombay Stock Exchange (BSE India) pursuant to SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015 (&ldquo;SEBI LODR&rdquo;).
                </p>
                <p>
                  All metrics, including Revenue YoY, Net Profit YoY, EBITDA, and EPS, are extracted algorithmically. Users must conduct their own independent due diligence and consult a qualified, SEBI-registered financial adviser before executing any investment decisions.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-500" />
                  <span>No Guarantee of Returns &amp; Machine Learning Notice</span>
                </h4>
                <p>
                  We strictly prohibit and reject any promises of guaranteed returns, &ldquo;multibaggers&rdquo;, or risk-free profits. Past corporate performance or historical financial metrics do not guarantee future stock price trajectories.
                </p>
                <p>
                  Certain summaries are generated using large language models (Google Gemini AI) and automated optical character recognition (OCR) engines. While high accuracy is maintained, machine interpretation may occasionally misread complex or non-standard accounting schedules. Always refer directly to the verified exchange PDF circulars.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: TERMS OF SERVICE */}
          {/* ========================================================= */}
          {activeTab === 'terms' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Terms of Service (User Agreement)</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Effective Date: September 2026 • Governing Law: Republic of India</p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">1. Acceptance of Terms</h5>
                <p>
                  By accessing, browsing, or utilizing the BSE Nexus web terminal, mobile interface, or automated alert channels, you agree to be bound by these Terms of Service and all applicable laws and regulations of India. If you do not agree, you must discontinue use immediately.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">2. Permitted Use &amp; License</h5>
                <p>
                  BSE Nexus grants you a revocable, non-exclusive, non-transferable, limited license to access and view publicly available corporate disclosures for personal, educational, and internal analytical research purposes only.
                </p>
                <p>
                  You agree NOT to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 pl-1">
                  <li>Redistribute, syndicate, or commercially resell the processed feed without our prior written authorization.</li>
                  <li>Perform distributed denial of service (DDoS) attacks, brute-force requests, or bypass rate limiters.</li>
                  <li>Use automated web crawlers or scrapers to overwhelm backend servers.</li>
                  <li>Reverse engineer, decompile, or disassemble proprietary frontend or server logic.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">3. User Accounts &amp; Authentication</h5>
                <p>
                  You are responsible for maintaining the confidentiality of your credentials (such as Google Authentication and Telegram Chat access). You agree to notify us immediately of any unauthorized access.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">4. Limitation of Liability</h5>
                <p>
                  To the maximum extent permitted by Indian law, BSE Nexus, its developers, operators, and affiliates shall NOT be liable for any direct, indirect, incidental, punitive, or consequential damages resulting from:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 pl-1">
                  <li>Any financial or trading losses incurred by the user.</li>
                  <li>Delays, transmission errors, or temporary unavailability of exchange data.</li>
                  <li>Inaccuracies in PDF OCR extraction or machine learning summaries.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">5. Governing Law &amp; Jurisdiction</h5>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or related to this platform shall be subject to the exclusive jurisdiction of the competent courts in New Delhi or Mumbai, India.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: PRIVACY POLICY (DPDP 2023 & GDPR) */}
          {/* ========================================================= */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Privacy Policy</h4>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                    DPDP Act 2023 &amp; GDPR Compliant
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Compliant with the Digital Personal Data Protection Act, 2023 (India) and Information Technology Act, 2000</p>
              </div>

              {/* Data Minimization Box */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-xs">
                  <ShieldCheck size={16} />
                  <span>Strict Data Minimization Guarantee</span>
                </div>
                <p className="text-[11px] text-emerald-950 dark:text-emerald-200">
                  <strong>We do NOT collect, process, or store:</strong> Demat account numbers, broker passwords, trading execution PINs, bank accounts, Aadhaar, PAN numbers, or payment card details. We adhere strictly to the principle of purpose limitation under Section 4 of the DPDP Act 2023.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">1. Information We Collect</h5>
                <ul className="list-disc list-inside space-y-1.5 text-slate-500 dark:text-slate-400 pl-1">
                  <li><strong>Account Data:</strong> Display name, email address, and avatar URL provided via Google Authentication.</li>
                  <li><strong>User Watchlist:</strong> Symbols and scrip codes explicitly pinned to your personal watchlist for sync.</li>
                  <li><strong>Alert Destinations:</strong> Personal Telegram Chat ID (only if you opt-in to instant alert delivery).</li>
                  <li><strong>Technical Diagnostics:</strong> Anonymized error logs and rate-limiting IP logs (retained strictly for 7 days to prevent DoS attacks).</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">2. Purpose of Processing</h5>
                <p>
                  Your information is processed strictly to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 pl-1">
                  <li>Authenticate your session and sync your watchlists across devices.</li>
                  <li>Deliver user-requested corporate announcement alerts via Telegram.</li>
                  <li>Maintain server security and prevent malicious abuse.</li>
                </ul>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  We NEVER sell, lease, monetize, or share your personal data with advertising brokers or third-party marketers.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">3. Your Rights Under DPDP Act 2023 &amp; GDPR</h5>
                <p>
                  As a Data Principal, you possess the following statutory rights:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block">Right to Access &amp; Summary</span>
                    <span className="text-[11px] text-slate-500">Request a summary of personal data processed.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block">Right to Correction &amp; Erasure</span>
                    <span className="text-[11px] text-slate-500">Instantly delete your account and watchlists in Settings.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block">Right to Grievance Redressal</span>
                    <span className="text-[11px] text-slate-500">Direct escalation to our Grievance Officer within 24-48 hours.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block">Right to Nominate</span>
                    <span className="text-[11px] text-slate-500">Designate an individual to exercise rights on your behalf.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: COOKIE & LOCAL STORAGE POLICY */}
          {/* ========================================================= */}
          {activeTab === 'cookies' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Cookie &amp; Local Storage Policy</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Transparent disclosure of all client-side storage mechanisms</p>
              </div>

              <p>
                BSE Nexus uses modern browser <strong>Local Storage</strong> and strictly essential session cookies to function smoothly. We do NOT use third-party advertising cookies or cross-site tracking scripts.
              </p>

              {/* Cookie Inventory Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                      <th className="p-3">Key / Item</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Purpose</th>
                      <th className="p-3">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-[11px]">
                    <tr>
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">bse_nexus_cookie_consent_v1</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">Essential</span></td>
                      <td className="p-3">Records your cookie preferences and consent status</td>
                      <td className="p-3">1 Year</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">bse_theme</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">Functional</span></td>
                      <td className="p-3">Remembers Dark Mode vs Light Mode preference</td>
                      <td className="p-3">Persistent</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">bse_watchlist_local</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">Functional</span></td>
                      <td className="p-3">Saves your chosen stock watchlists locally for offline access</td>
                      <td className="p-3">Persistent</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">firebase:authUser</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">Essential</span></td>
                      <td className="p-3">Maintains your authenticated Google sign-in session securely</td>
                      <td className="p-3">Session</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Management Controls */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">Manage Your Storage &amp; Cookies</h5>
                <p className="text-[11px] text-slate-500">
                  You can reset your consent choices or purge local storage at any time:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetCookieConsent();
                      window.dispatchEvent(new CustomEvent('open-cookie-settings'));
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Reset Cookie Preferences
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: REFUND & BILLING POLICY */}
          {/* ========================================================= */}
          {activeTab === 'refund' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Refund &amp; Cancellation Policy</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Transparent billing, zero hidden fees, and cooling-off guarantees</p>
              </div>

              {/* 1-Week Free Trial Notice */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-xs">
                  <CheckCircle2 size={16} />
                  <span>1-Week Free Pro Access (No Credit Card Required)</span>
                </div>
                <p className="text-[11px] text-emerald-950 dark:text-emerald-200">
                  BSE Nexus currently offers <strong>1-Week (7-Day) Free Pro Access</strong> upon signing in with your genuine Google account. We do NOT require credit card details upfront, ensuring zero risk of unexpected automatic renewals.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">1. 7-Day Money-Back Guarantee (Paid Plans)</h5>
                <p>
                  Should you ever subscribe to any paid Pro plan in the future, you are covered by our <strong>7-Day No-Questions-Asked Money-Back Guarantee</strong>. If you are dissatisfied for any reason within seven (7) days of your initial charge, submit a request to <a href="mailto:admin@bsenexus.in" className="text-indigo-600 dark:text-indigo-400 underline">admin@bsenexus.in</a> for a 100% full refund.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">2. 1-Click Self-Service Cancellation</h5>
                <p>
                  You may cancel any future paid membership at any moment directly from the Settings tab. There are no cancellation fees, retention hurdles, or forced phone calls. Your benefits remain active until the conclusion of your current paid billing period.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">3. Refund Processing Turnaround</h5>
                <p>
                  Approved refunds are processed via our licensed payment gateway partners within 5 to 7 business days directly back to the original funding source (UPI, Credit Card, or Net Banking).
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: 3RD-PARTY SDK & SECURITY AUDIT */}
          {/* ========================================================= */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">3rd-Party SDK &amp; Data Flow Audit</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Comprehensive audit of external libraries, APIs, and data processors</p>
              </div>

              <p>
                In accordance with global security standards and Section 8 of the DPDP Act 2023, we provide full transparency into every third-party service integrated into this application:
              </p>

              <div className="space-y-3">
                {[
                  {
                    name: 'Google Gemini 2.5 / Flash AI',
                    type: 'Document Intelligence & Summarization',
                    dataTransferred: 'Public BSE regulatory filing text and financial balance sheets only.',
                    piiStatus: 'ZERO user personal information or watchlists transmitted.',
                    location: 'Server-side API proxy only.'
                  },
                  {
                    name: 'Google Firebase (Auth & Firestore)',
                    type: 'Authentication & Database',
                    dataTransferred: 'Encrypted user email, display name, and watchlist scrip codes.',
                    piiStatus: 'Encrypted at rest (AES-256) and in transit (TLS 1.3). ISO 27001 certified.',
                    location: 'Cloud Infrastructure (GCP asia-south1).'
                  },
                  {
                    name: 'Yahoo Finance API',
                    type: 'Index Price Caching (^BSESN, ^NSEI)',
                    dataTransferred: 'Market tickers only.',
                    piiStatus: 'ZERO user data transferred. Anonymous server-to-server proxy.',
                    location: 'Server-side cache.'
                  },
                  {
                    name: 'Telegram Bot API',
                    type: 'Regulatory Alert Dispatching',
                    dataTransferred: 'Filing headlines dispatched to user-configured personal Telegram Chat IDs.',
                    piiStatus: 'Dispatched only upon explicit user opt-in.',
                    location: 'Telegram cloud infrastructure.'
                  },
                  {
                    name: 'BSE India Official Public Feeds',
                    type: 'Regulatory Exchange Filings',
                    dataTransferred: 'Public announcements under SEBI LODR Regulation 30.',
                    piiStatus: 'Public domain statutory disclosures.',
                    location: 'BSE India servers.'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{item.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {item.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div><strong>Data Transferred:</strong> {item.dataTransferred}</div>
                      <div><strong>Privacy &amp; PII:</strong> {item.piiStatus}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: BUSINESS DETAILS & GRIEVANCE OFFICER */}
          {/* ========================================================= */}
          {activeTab === 'grievance' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Business Information &amp; Grievance Redressal</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Statutory Contact under Information Technology (Intermediary Guidelines) Rules, 2021</p>
              </div>

              {/* Grievance Officer Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-3">
                <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200 text-xs sm:text-sm">
                  <UserCheck size={18} className="text-indigo-600" />
                  <span>Statutory Grievance Officer Details</span>
                </div>
                <div className="text-[11px] sm:text-xs text-indigo-950 dark:text-indigo-100 space-y-1 leading-relaxed">
                  <p>In accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, the details of the designated Grievance Officer are:</p>
                  <div className="pt-1.5 space-y-1 font-mono text-[11px]">
                    <div><strong>Officer Name:</strong> Rahul Dahiya</div>
                    <div><strong>Designation:</strong> Chief Grievance &amp; Data Protection Officer</div>
                    <div><strong>Entity:</strong> BSE Nexus Analytics &amp; Technologies</div>
                    <div><strong>Email:</strong> <a href="mailto:admin@bsenexus.in" className="underline font-bold">admin@bsenexus.in</a></div>
                    <div><strong>Support Desk:</strong> <a href="mailto:admin@bsenexus.in" className="underline">admin@bsenexus.in</a></div>
                    <div><strong>Turnaround Time:</strong> Acknowledgment within 24 hours; grievance resolution within 15 days.</div>
                  </div>
                </div>
              </div>

              {/* Intellectual Property & Trademark Disclaimers */}
              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">Trademarks &amp; Nominative Fair Use</h5>
                <p>
                  <strong>&ldquo;BSE&rdquo;</strong>, <strong>&ldquo;SENSEX&rdquo;</strong>, and associated trade dresses are registered trademarks of BSE Limited. <strong>&ldquo;NIFTY&rdquo;</strong> is a registered trademark of NSE Indices Limited.
                </p>
                <p>
                  BSE Nexus is an independent analytical application. It is <strong>NOT affiliated with, officially sponsored by, endorsed by, or an official product of BSE Limited, NSE Limited, or SEBI</strong>. Corporate logos displayed are the property of their respective issuers and are utilized strictly for identification and educational reference under nominative fair use doctrine.
                </p>
              </div>

              {/* Open Source Licenses */}
              <div className="space-y-3">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">Open-Source Acknowledgments</h5>
                <p className="text-[11px] text-slate-500">
                  Built with React (MIT), Tailwind CSS (MIT), Lucide Icons (ISC), Vite (MIT), and Framer Motion (MIT).
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400">
            Last Reviewed: September 2026 • BSE Nexus Compliance
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              I Acknowledge &amp; Agree
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
