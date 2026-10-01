/**
 * ProCheckoutView — the dedicated, focused payment screen.
 *
 * Two-step flow inside one sheet:
 *   Step 1 "Choose your plan" — 4 roomy vertical plan cards + a compact
 *   Free vs Pro comparison, so the user sees exactly what Pro unlocks
 *   BEFORE paying. Then "Continue" takes them inside to…
 *   Step 2 "Pay details" — the clean pay-details card (From / Plan / Pay on
 *   / Total) with one black Pay button. A "‹ Plans" back link returns to
 *   step 1 to change the plan.
 *
 * Nothing else is visible or interactive behind it. Opened globally via
 * AuthContext (openCheckout); the plan is preselected (e.g. from /pricing
 * deep links) and can be switched in step 1.
 */
import React, { useState, useEffect } from 'react';
import { X, ReceiptText, ShieldCheck, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { startProPayment, formatReceiptDate, PRO_PLAN_LIST, type ProPlanDisplay } from '../utils/cashfree';
import { PlanCard } from './ui/PlanCard';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-100 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-slate-400 shrink-0">{label}</span>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}

/** Compact Free vs Pro comparison shown in step 1, before payment. */
function ProVsFree() {
  const rows: Array<[string, string, string]> = [
    ['Watchlists', '—', 'Unlimited'],
    ['AI filing summaries', '1 demo (one-time)', '100 / day'],
    ['Telegram alerts', '—', 'Broadcast'],
    ['Export (CSV / JSON)', '—', 'Included'],
  ];
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span>What you get</span>
        <span className="text-right w-20">Free</span>
        <span className="text-right w-20 text-slate-900">Pro</span>
      </div>
      {rows.map(([feature, free, pro], i) => (
        <div
          key={feature}
          className={`grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 text-[12px] ${
            i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
          }`}
        >
          <span className="font-medium text-slate-600">{feature}</span>
          <span className="text-right w-20 font-medium text-slate-400">{free}</span>
          <span className="text-right w-20 font-bold text-slate-900">{pro}</span>
        </div>
      ))}
    </div>
  );
}

export function ProCheckoutView() {
  const { isCheckoutOpen, setIsCheckoutOpen, checkoutPlanId, user, profile } = useAuth();
  const [planId, setPlanId] = useState<string>(checkoutPlanId);
  const [step, setStep] = useState<'plan' | 'pay'>('plan');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCheckoutOpen) {
      setPlanId(checkoutPlanId);
      setStep('plan');
      setPaying(false);
      setError(null);
    }
  }, [isCheckoutOpen, checkoutPlanId]);

  useEffect(() => {
    if (!isCheckoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCheckoutOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCheckoutOpen, setIsCheckoutOpen]);

  if (!isCheckoutOpen) return null;

  const plan = PRO_PLAN_LIST.find((p) => p.id === planId) || PRO_PLAN_LIST[1];

  const close = () => {
    if (!paying) setIsCheckoutOpen(false);
  };

  const handlePay = async () => {
    if (!user || (user as any).isAnonymous) {
      setIsCheckoutOpen(false);
      return;
    }
    setPaying(true);
    setError(null);
    const res = await startProPayment(plan.id);
    if (!res.ok) {
      setError(res.error || 'Could not start the payment. Please try again.');
      setPaying(false);
    }
    // On success Cashfree takes over (its own secure checkout page).
  };

  const email = (user as any)?.email || (profile as any)?.email || 'Your account';
  const today = formatReceiptDate(new Date().toISOString());

  // Savings line comes from the single source of truth (src/config/plans.ts) —
  // only the monthly plan carries the real ₹499 → ₹199 launch anchor;
  // longer plans show honest savings vs the monthly rate instead.
  const savingsLine = plan.sub ? (
    <p className="text-[11px] font-medium text-emerald-600">{plan.sub}</p>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Pro checkout"
    >
      <div
        className="w-full max-w-[430px] max-h-[92vh] overflow-y-auto rounded-[28px] bg-white shadow-2xl p-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'plan' ? (
          <>
            {/* Step 1 header */}
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-2 text-slate-900">
                <ReceiptText size={18} className="text-slate-700" />
                <h2 className="text-[15px] font-bold">Choose your Pro pack</h2>
              </div>
              <button
                onClick={close}
                aria-label="Close checkout"
                className="p-1 rounded-full text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="px-1 pb-4 text-[11px] font-medium text-slate-400">
              One-time payment · No auto-renewal · Step 1 of 2
            </p>

            {/* Vertical plan cards */}
            <div className="space-y-3 mb-5">
              {PRO_PLAN_LIST.map((p) => (
                <PlanCard
                  key={p.id}
                  selectable
                  title={p.label}
                  subtitle={`${p.days} days validity`}
                  price={String(p.price)}
                  priceSuffix="one-time"
                  tag={p.tag}
                  sub={p.sub}
                  selected={p.id === plan.id}
                  onSelect={() => setPlanId(p.id)}
                />
              ))}
            </div>

            {/* Free vs Pro — visible BEFORE payment */}
            <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pro vs Free — what changes
            </p>
            <ProVsFree />

            <button
              onClick={() => setStep('pay')}
              className="mt-5 w-full py-4 rounded-full bg-[#121212] text-white text-[15px] font-medium tracking-[-0.01em] hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Continue — ₹{plan.price}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
              <ShieldCheck size={12} />
              Secured by Cashfree · UPI · Cards · Netbanking
            </p>
          </>
        ) : (
          <>
            {/* Step 2 header */}
            <div className="flex items-center justify-between px-1 pb-4">
              <button
                onClick={() => !paying && setStep('plan')}
                className="flex items-center gap-0.5 text-[13px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ChevronLeft size={16} />
                Plans
              </button>
              <div className="flex items-center gap-2 text-slate-900">
                <ReceiptText size={18} className="text-slate-700" />
                <h2 className="text-[15px] font-bold">Pay details</h2>
              </div>
              <button
                onClick={close}
                aria-label="Close checkout"
                className="p-1 rounded-full text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="px-1 pb-4 text-[11px] font-medium text-slate-400 -mt-2">
              Step 2 of 2 · {plan.label} ({plan.days} days)
            </p>

            <div className="space-y-2.5">
              <Row label="From">
                <p className="text-[13px] font-bold text-slate-900 truncate max-w-[220px]">{email}</p>
              </Row>

              <Row label="To">
                <p className="text-[13px] font-bold text-slate-900">Bsenexus</p>
                <p className="text-[11px] font-medium text-slate-400">
                  {plan.label} · {plan.days} days
                </p>
              </Row>

              <Row label="Pay on">
                <p className="text-[13px] font-bold text-slate-900">{today}</p>
                {savingsLine}
              </Row>

              <div className="bg-slate-100 rounded-2xl px-4 py-3.5 flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-400">Total</span>
                <span className="text-[26px] font-black text-slate-900 tracking-tight">
                  ₹{plan.price}.00
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-3 py-2.5 px-4 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold rounded-xl">
                {error}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={paying}
              className="mt-4 w-full py-4 rounded-full bg-[#121212] text-white text-[15px] font-medium tracking-[-0.01em] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {paying ? 'Opening…' : `Pay ₹${plan.price}`}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
              <ShieldCheck size={12} />
              Secured by Cashfree · UPI · Cards · Netbanking
            </p>
            <p className="mt-1.5 text-center text-[10px] text-slate-400 font-medium">
              One-time payment · No auto-renewal
            </p>
          </>
        )}
      </div>
    </div>
  );
}
