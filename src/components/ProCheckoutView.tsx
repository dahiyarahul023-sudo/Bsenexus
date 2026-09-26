/**
 * ProCheckoutView — the dedicated, focused payment screen.
 *
 * One job: take the logged-in user inside a clean checkout and start the
 * Cashfree payment. Nothing else is visible or interactive behind it —
 * no side content, no essays, just the plan, the price, and the pay button.
 * Opened globally via AuthContext (isCheckoutOpen) from Settings or the
 * upgrade modal. On success Cashfree takes over with its own checkout page.
 */
import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { startProPayment } from '../utils/cashfree';

export function ProCheckoutView() {
  const { isCheckoutOpen, setIsCheckoutOpen, user, setIsAuthModalOpen } = useAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the checkout opens.
  useEffect(() => {
    if (isCheckoutOpen) {
      setPaying(false);
      setError(null);
    }
  }, [isCheckoutOpen]);

  // Escape closes the checkout.
  useEffect(() => {
    if (!isCheckoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCheckoutOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCheckoutOpen, setIsCheckoutOpen]);

  if (!isCheckoutOpen) return null;

  const close = () => {
    if (!paying) setIsCheckoutOpen(false);
  };

  const handlePay = async () => {
    if (!user || (user as any).isAnonymous) {
      setIsCheckoutOpen(false);
      setIsAuthModalOpen(true);
      return;
    }
    setPaying(true);
    setError(null);
    const res = await startProPayment('pro_monthly');
    if (!res.ok) {
      setError(res.error || 'Could not start the payment. Please try again.');
      setPaying(false);
    }
    // On success Cashfree takes over (its own secure checkout page).
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Pro checkout"
    >
      <div
        className="w-full max-w-[380px] rounded-[26px] bg-white dark:bg-[#171423] border border-slate-200 dark:border-white/10 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close checkout"
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
            <Crown size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">BSE Nexus Pro</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">30-day Pro pack · one-time payment</p>
          </div>
        </div>

        {/* Price */}
        <div className="mt-5 flex items-center gap-2.5">
          <span className="text-[34px] font-black text-slate-900 dark:text-white tracking-tight">₹199</span>
          <span className="text-sm font-bold text-slate-400 line-through">₹499</span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
            60% off
          </span>
        </div>

        <div className="my-4 border-t border-slate-100 dark:border-white/10" />

        {/* What's included — minimal */}
        <ul className="space-y-2.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          <li className="flex items-center gap-2.5">
            <Check size={15} className="text-emerald-500 shrink-0" />
            All Pro features, unlocked for 30 days
          </li>
          <li className="flex items-center gap-2.5">
            <Check size={15} className="text-emerald-500 shrink-0" />
            One-time payment · no auto-charge
          </li>
          <li className="flex items-center gap-2.5">
            <Check size={15} className="text-emerald-500 shrink-0" />
            Instant activation after payment
          </li>
        </ul>

        {error && (
          <div className="mt-4 py-2.5 px-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-semibold rounded-xl">
            {error}
          </div>
        )}

        {/* Pay */}
        <button
          onClick={handlePay}
          disabled={paying}
          className="mt-5 w-full py-3.5 rounded-2xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-sm font-black flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-xl"
        >
          <Lock size={15} />
          {paying ? 'Opening secure checkout…' : 'Pay ₹199 securely'}
        </button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          <ShieldCheck size={12} />
          Secured by Cashfree · UPI · Cards · Netbanking
        </p>
      </div>
    </div>
  );
}
