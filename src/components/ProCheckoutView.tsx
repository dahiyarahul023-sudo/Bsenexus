/**
 * ProCheckoutView — the dedicated, focused payment screen.
 *
 * Clean "pay details" card style: white sheet, soft inner rows
 * (From / Plan / Pay on / Total), one black Pay button. Nothing else is
 * visible or interactive behind it. Opened globally via AuthContext
 * (openCheckout). The plan is preselected (e.g. from /pricing deep links)
 * and can be switched inside the checkout — amount and validity follow.
 */
import React, { useState, useEffect } from 'react';
import { X, ReceiptText, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { startProPayment, formatReceiptDate, PRO_PLAN_LIST, type ProPlanDisplay } from '../utils/cashfree';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-100 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-slate-400 shrink-0">{label}</span>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}

export function ProCheckoutView() {
  const { isCheckoutOpen, setIsCheckoutOpen, checkoutPlanId, user, profile } = useAuth();
  const [planId, setPlanId] = useState<string>(checkoutPlanId);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCheckoutOpen) {
      setPlanId(checkoutPlanId);
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

  // Only the monthly plan carries the real ₹499 → ₹199 launch anchor.
  // Longer plans show honest savings vs the monthly rate instead.
  const savingsLine =
    plan.id === 'pro_monthly' ? (
      <p className="text-[11px] font-medium text-emerald-600">Discount −₹300 (60% off)</p>
    ) : plan.id === 'pro_halfyearly' ? (
      <p className="text-[11px] font-medium text-emerald-600">You save ₹195 vs monthly</p>
    ) : plan.id === 'pro_yearly' ? (
      <p className="text-[11px] font-medium text-emerald-600">You save ₹589 vs monthly</p>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Pay details"
    >
      <div
        className="w-full max-w-[380px] max-h-[92vh] overflow-y-auto rounded-[28px] bg-white shadow-2xl p-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-4">
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

        {/* Plan selector — only shown inside the payment flow */}
        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Choose your plan
        </p>
        <div className="space-y-2 mb-3">
          {PRO_PLAN_LIST.map((p) => {
            const selected = p.id === plan.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                aria-pressed={selected}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all border-2 ${
                  selected
                    ? 'border-slate-950 bg-slate-950/[0.03]'
                    : 'border-transparent bg-slate-100 hover:bg-slate-200/70'
                }`}
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected ? 'border-slate-950 bg-slate-950' : 'border-slate-300 bg-white'
                  }`}
                >
                  {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-900">{p.label}</span>
                    {p.tag && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-1.5 py-0.5 rounded-md">
                        {p.tag}
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] font-medium text-slate-400 mt-0.5">
                    {p.days} days · {p.sub}
                  </span>
                </span>
                <span className="text-[16px] font-black text-slate-900 shrink-0">₹{p.price}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          <Row label="From">
            <p className="text-[13px] font-bold text-slate-900 truncate max-w-[220px]">{email}</p>
          </Row>

          <Row label="To">
            <p className="text-[13px] font-bold text-slate-900">BSE Nexus</p>
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
          className="mt-4 w-full py-4 rounded-2xl bg-slate-950 text-white text-[15px] font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
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
      </div>
    </div>
  );
}
