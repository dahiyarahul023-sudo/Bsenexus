/**
 * ProCheckoutView — the dedicated, focused payment screen.
 *
 * Clean "pay details" card style: white sheet, soft inner rows
 * (From / To / Pay on / Total), one black Pay button. Nothing else is
 * visible or interactive behind it. Opened globally via AuthContext
 * (isCheckoutOpen). On success Cashfree takes over with its own checkout.
 */
import React, { useState, useEffect } from 'react';
import { X, ReceiptText, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { startProPayment, formatReceiptDate } from '../utils/cashfree';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-100 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-slate-400 shrink-0">{label}</span>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}

export function ProCheckoutView() {
  const { isCheckoutOpen, setIsCheckoutOpen, user, profile } = useAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCheckoutOpen) {
      setPaying(false);
      setError(null);
    }
  }, [isCheckoutOpen]);

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

  const email = (user as any)?.email || (profile as any)?.email || 'Your account';
  const today = formatReceiptDate(new Date().toISOString());

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Pay details"
    >
      <div
        className="w-full max-w-[380px] rounded-[28px] bg-white shadow-2xl p-5 animate-in zoom-in-95 duration-200"
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

        <div className="space-y-2.5">
          <Row label="From">
            <p className="text-[13px] font-bold text-slate-900 truncate max-w-[220px]">{email}</p>
          </Row>

          <Row label="To">
            <p className="text-[13px] font-bold text-slate-900">BSE Nexus</p>
            <p className="text-[11px] font-medium text-slate-400">Pro Monthly · 30 days</p>
          </Row>

          <Row label="Pay on">
            <p className="text-[13px] font-bold text-slate-900">{today}</p>
            <p className="text-[11px] font-medium text-emerald-600">Discount −₹300 (60% off)</p>
          </Row>

          <div className="bg-slate-100 rounded-2xl px-4 py-3.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-400">Total</span>
            <span className="text-[26px] font-black text-slate-900 tracking-tight">₹199.00</span>
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
          {paying ? 'Opening…' : 'Pay ₹199'}
        </button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <ShieldCheck size={12} />
          Secured by Cashfree · UPI · Cards · Netbanking
        </p>
      </div>
    </div>
  );
}
