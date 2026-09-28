import React, { useState, useEffect } from 'react';
import {
  X, Check, Sparkles, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { PlanCard } from './ui/PlanCard';
import { hasUsedTrial, getPlanDisplay, getLowestPlanPrice } from '../utils/cashfree';

export function ProUpgradeModal() {
  const { 
    isProModalOpen, 
    setIsProModalOpen,
    checkoutPlanId,
    openCheckout,
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
  // Pricing comes from the single source of truth (src/config/plans.ts) —
  // never hardcode plan prices in this component.
  const monthlyPlan = getPlanDisplay('pro_monthly');

  if (!isProModalOpen) return null;

  // Trial already consumed → offer direct purchase instead of a second trial.
  const trialUsed = hasUsedTrial((user as any)?.uid || profile?.uid);
  const showPayMode = Boolean(user && !user.isAnonymous && trialUsed);

  const handleBuyPro = () => {
    // Enter the dedicated checkout screen — payment happens inside it.
    // Keeps the plan preselected from the /pricing deep link, if any.
    setIsProModalOpen(false);
    openCheckout(checkoutPlanId);
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
      aria-label="Pro upgrade"
    >
      <div
        className="relative max-w-lg w-full animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsProModalOpen(false)}
          aria-label="Close upgrade modal"
          className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-[#121212] dark:bg-white text-white dark:text-black shadow-lg hover:opacity-85 transition-opacity"
        >
          <X size={16} />
        </button>

        {activatedSuccess ? (
          <div className="rounded-[20px] border border-[#E2E2E2] dark:border-white/10 bg-[#FCFCFC] dark:bg-[#16161B] p-10 flex flex-col items-center gap-3 text-center shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <span className="w-12 h-12 rounded-full bg-[#121212] dark:bg-white flex items-center justify-center">
              <Check size={22} className="text-white dark:text-black" />
            </span>
            <p className="text-[20px] font-medium tracking-[-0.02em] text-[#121212] dark:text-white">
              1-Week Free Pro Activated!
            </p>
            <p className="text-[13px] text-[#7B7B7B] dark:text-zinc-400">
              Enjoy unlimited watchlists, Telegram alerts and Gemini AI summaries.
            </p>
          </div>
        ) : (
          <PlanCard
            title={showPayMode ? 'Continue with Pro Intelligence' : '1-Week Free Pro Intelligence'}
            subtitle={
              showPayMode
                ? 'Your free trial has ended. Keep unlimited watchlists, Gemini AI summaries, Telegram alerts and custom filtering.'
                : 'Sign in with your genuine Google account to activate 1 week (7 days) of Free Pro access: Gemini AI summaries, Telegram alerts, and custom filtering.'
            }
            tag={showPayMode ? 'Launch Offer' : '1-Week Free Trial'}
            wasPrice={showPayMode && monthlyPlan.wasPrice ? String(monthlyPlan.wasPrice) : undefined}
            price={showPayMode ? String(monthlyPlan.price) : '0'}
            priceSuffix={showPayMode ? '/month' : '/week'}
            sub={showPayMode ? monthlyPlan.sub : `After the free week, one-time plans from ₹${getLowestPlanPrice()}`}
            features={[
              {
                title: 'Personal Telegram Instant Alerts',
                desc: 'Get instant DMs on your personal Telegram account whenever your selected stocks submit a BSE filing.',
              },
              {
                title: 'Custom Category Filtering',
                desc: 'Choose exactly what you receive: Financial Results, Order Wins, Dividends/Bonus, or M&A while muting compliance spam.',
              },
              {
                title: 'Unlimited Watchlist Stocks',
                desc: 'Track unlimited scrips with automatic historical filings sync & financial results archive.',
              },
              {
                title: 'Gemini AI YoY Financial Breakdowns',
                desc: 'Instant 1-click generation of revenue, net profit, margin & bullet point summaries.',
              },
            ]}
            ctaLabel={
              showPayMode ? (
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={16} /> Continue to Secure Checkout <ArrowRight size={15} />
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={16} />
                  {(!user || user.isAnonymous)
                    ? 'Sign In with Google for 1-Week Free Pro'
                    : 'Activate 1-Week Free Pro (₹0)'}
                  <ArrowRight size={15} />
                </span>
              )
            }
            onCta={showPayMode ? handleBuyPro : handleActivate}
            ctaLoading={!showPayMode && isActivating}
            ctaLoadingText="Activating..."
            footnote={
              <>
                Free trial: No card required upfront · After the free week, Pro continues with
                one-time plans from ₹{getLowestPlanPrice()} (launch offer) · Cancel anytime in Settings.
              </>
            }
            className="w-full"
          />
        )}
      </div>
    </div>
  );
}
