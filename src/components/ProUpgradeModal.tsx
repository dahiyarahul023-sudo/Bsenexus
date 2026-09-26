import React, { useState, useEffect } from 'react';
import { 
  X, Check, Sparkles, Send, ShieldCheck, Zap, 
  BellRing, Filter, ExternalLink, Bot, ArrowRight 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ActionButton } from './ui/ActionButton';
import { hasUsedTrial } from '../utils/cashfree';

export function ProUpgradeModal() {
  const { 
    isProModalOpen, 
    setIsProModalOpen,
    setIsCheckoutOpen,
    profile, 
    user,
    setIsAuthModalOpen, 
    upgradeToPro 
  } = useAuth();

  useBodyScrollLock(isProModalOpen);

  useEffect(() => {
    if (!isProModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProModalOpen, setIsProModalOpen]);

  const [isActivating, setIsActivating] = useState(false);
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  if (!isProModalOpen) return null;

  // Trial already consumed → offer direct purchase instead of a second trial.
  const trialUsed = hasUsedTrial((user as any)?.uid || profile?.uid);
  const showPayMode = Boolean(user && !user.isAnonymous && trialUsed);

  const handleBuyPro = () => {
    // Enter the dedicated checkout screen — payment happens inside it.
    setIsProModalOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleActivate = async () => {
    if (!user || user.isAnonymous) {
      setIsProModalOpen(false);
      setIsAuthModalOpen(true);
      return;
    }

    setIsActivating(true);
    const success = await upgradeToPro('7-Day Pro Trial');
    setIsActivating(false);
    if (success) {
      setActivatedSuccess(true);
      setTimeout(() => {
        setIsProModalOpen(false);
        setActivatedSuccess(false);
      }, 1500);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overscroll-contain"
      onClick={() => setIsProModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-upgrade-title"
    >
      <div 
        className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Banner with gradient accent */}
        <div className="relative p-6 bg-linear-to-br from-emerald-500 via-teal-600 to-blue-600 text-white overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider">
              <Sparkles size={13} />
              <span>1-Week Free Trial • Google Sign-In</span>
            </div>
            
            <button
              onClick={() => setIsProModalOpen(false)}
              aria-label="Close upgrade modal"
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 relative z-10">
            <h2 id="pro-upgrade-title" className="text-2xl font-black tracking-tight">
              {showPayMode ? 'Continue with Pro Intelligence' : '1-Week Free Pro Intelligence'}
            </h2>
            <p className="text-xs text-white/80 mt-1">
              {showPayMode
                ? 'Your free trial has ended. Keep unlimited watchlists, Gemini AI summaries, Telegram alerts and custom filtering.'
                : 'Sign in with your genuine Google account to activate 1 week (7 days) of Free Pro access: Gemini AI summaries, Telegram alerts, and custom filtering.'}
            </p>
          </div>

          {/* Pricing Tag */}
          <div className="mt-5 inline-flex items-baseline gap-2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
            <span className="text-base line-through text-white/60">₹499/mo</span>
            <span className="text-3xl font-black text-white">{showPayMode ? '₹199' : '₹0'}</span>
            {!showPayMode && <span className="text-[11px] text-white/60 font-semibold">/mo</span>}
            <span className="text-[11px] bg-emerald-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              {showPayMode ? 'Launch Offer · 60% Off' : '1 Week Free with Google'}
            </span>
          </div>
        </div>

        {/* Feature List */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {[
              {
                icon: Send,
                title: "Personal Telegram Instant Alerts (Free)",
                desc: "Get instant DMs on your personal Telegram account whenever your selected stocks submit a BSE filing."
              },
              {
                icon: Filter,
                title: "Custom Category Filtering (Free)",
                desc: "Choose exactly what you receive: Financial Results, Order Wins, Dividends/Bonus, or M&A while muting compliance spam."
              },
              {
                icon: Zap,
                title: "Unlimited Watchlist Stocks (Free)",
                desc: "Track unlimited scrips with automatic historical filings sync & financial results archive."
              },
              {
                icon: Sparkles,
                title: "Gemini AI YoY Financial Breakdowns (Free)",
                desc: "Instant 1-click generation of revenue, net profit, margin & bullet point summaries."
              }
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{feat.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action button */}
          <div className="pt-2">
            {showPayMode ? (
              <>
                <ActionButton
                  onClick={handleBuyPro}
                  variant="emerald"
                  size="lg"
                  icon={<Sparkles size={16} />}
                  className="w-full font-black text-sm"
                >
                  <span>Continue to Secure Checkout</span>
                  <ArrowRight size={15} className="ml-1" />
                </ActionButton>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  ₹199 for 30 days · One-time payment via Cashfree
                </p>
              </>
            ) : activatedSuccess ? (
              <div className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md animate-in zoom-in-95">
                <Check size={16} />
                <span>1-Week Free Pro Activated!</span>
              </div>
            ) : (
              <ActionButton
                onClick={handleActivate}
                isLoading={isActivating}
                loadingText="Activating..."
                variant="emerald"
                size="lg"
                icon={<Sparkles size={16} />}
                className="w-full font-black text-sm"
              >
                <span>{(!user || user.isAnonymous) ? 'Sign In with Google for 1-Week Free Pro' : 'Activate 1-Week Free Pro (₹0)'}</span>
                <ArrowRight size={15} className="ml-1" />
              </ActionButton>
            )}
            
            <div className="text-left text-[10px] text-slate-400 dark:text-slate-500 mt-3 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 space-y-1">
              <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-white">Free trial:</span> No card required upfront &bull; After the free week, Pro continues at just ₹199/mo (launch offer) &bull; Cancel anytime in Settings.
              </p>
              <p className="text-[9px] text-slate-400/80 leading-relaxed">
                7-day free trial &bull; Cancel anytime in Settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
