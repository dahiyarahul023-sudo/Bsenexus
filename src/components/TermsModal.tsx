import React from 'react';
import { X, ShieldAlert, Scale, Lock, FileCheck, Info } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div 
        className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/50 dark:border-amber-800/50">
              <Scale size={20} />
            </div>
            <div>
              <h3 id="terms-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Terms of Service & Disclaimers</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">SEBI Compliance, Market Data & Privacy Policy</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close terms and disclaimers"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed overscroll-contain">
          
          {/* SEBI Statutory Disclaimer */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-sm">
              <ShieldAlert size={16} className="shrink-0" />
              <span>1. Regulatory & SEBI Disclaimer</span>
            </div>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
              <strong>BSE Nexus is an independent analytical tool and software terminal.</strong> We are NOT registered as a Research Analyst, Investment Adviser, Portfolio Manager, or Broker under the Securities and Exchange Board of India (SEBI) Regulations.
            </p>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
              None of the data, automated notifications, AI summaries, or financial metrics provided on this platform constitute investment advice, stock recommendations, or solicitations to buy or sell securities. All investments in equity and financial markets are subject to market risks. Users must consult a certified financial advisor before executing trades.
            </p>
          </div>

          {/* Section 2: Market Data Dissemination */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
              <FileCheck size={16} className="text-indigo-500" />
              <span>2. Source of Corporate Disclosures & Disclaimers</span>
            </div>
            <p className="text-[11px] text-slate-500">
              All corporate filings, PDF announcements, board meeting outcomes, and financial tables are sourced automatically from public regulatory feeds provided by the Bombay Stock Exchange (BSE India). 
            </p>
            <p className="text-[11px] text-slate-500">
              While our scraper engine operates at sub-second polling frequencies, BSE Nexus makes no guarantees regarding 100% continuous uptime, zero-latency transmission, or instantaneous PDF OCR completeness. Users should verify critical details with original exchange filings.
            </p>
          </div>

          {/* Section 3: AI-Generated Content */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
              <Info size={16} className="text-purple-500" />
              <span>3. AI Summarization & OCR Notice</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Financial metrics (including Revenue YoY, Net Profit YoY, EBITDA, and EPS) are generated via automated machine learning models (Google Gemini AI). While highly accurate, AI interpretation can occasionally misclassify tabular data or non-standard accounting formats. Always cross-check with original company financial tables.
            </p>
          </div>

          {/* Section 4: Privacy Policy & Data Security */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
              <Lock size={16} className="text-emerald-500" />
              <span>4. Privacy & Data Protection Policy</span>
            </div>
            <p className="text-[11px] text-slate-500">
              We respect user privacy and adhere to the following principles:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 ml-1">
              <li><strong>Zero Trading Credentials:</strong> We never request, store, or have access to your broker passwords, demat accounts, or API keys.</li>
              <li><strong>Encrypted Data:</strong> User email addresses, display names, and Telegram Chat IDs are securely stored and encrypted solely for delivering requested alert notifications.</li>
              <li><strong>No Data Resale:</strong> We do not sell or lease user watchlists or analytical habits to any third parties.</li>
            </ul>
          </div>

          {/* Section 5: Fair Use & Rate Limits */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
              <Scale size={16} className="text-blue-500" />
              <span>5. Fair Usage & Automated Access</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Users agree not to launch denial-of-service (DoS) attacks, unauthorized reverse engineering, or mass abuse against our notification dispatch channels. We reserve the right to temporarily suspend accounts abusing server endpoints.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            Last Updated: August 2026 • BSE Nexus
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            I Understand & Agree
          </button>
        </div>

      </div>
    </div>
  );
}
