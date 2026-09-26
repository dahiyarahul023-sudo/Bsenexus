/**
 * ProReceiptView — payment success + receipt screen.
 *
 * Shown right after Cashfree returns and our server confirms PAID, and also
 * on demand from Settings ("View receipt") for the last payment.
 * Clean paper-receipt style. "Send receipt" opens the user's own mail app
 * with the receipt prefilled to whatever email they type — nothing is sent
 * without their tap (this project has no server mailer).
 */
import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Mail, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buildReceiptMailto, formatReceiptDate, type PaymentReceipt } from '../utils/cashfree';

function ReceiptPaper({ r }: { r: PaymentReceipt }) {
  const planText = r.planLabel
    ? `1× ${r.planLabel}${r.validityDays ? ` (${r.validityDays} days)` : ''}`
    : '1× Pro Monthly (30 days)';
  return (
    <div className="bg-white rounded-2xl px-5 py-5 text-slate-900 shadow-inner">
      <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">BSE NEXUS</p>
      <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 mt-0.5">PRO MEMBERSHIP RECEIPT</p>
      <p className="text-[30px] font-black tracking-tight mt-2">₹{Number(r.amount).toFixed(2)}</p>
      <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 mt-1">
        {formatReceiptDate(r.paidAt).toUpperCase()} &nbsp;|&nbsp; INVOICE PAID
      </p>

      <div className="my-3 border-t border-dashed border-slate-200" />

      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-slate-600">{planText}</span>
        <span className="font-bold">₹{Number(r.amount).toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between text-[12px] mt-1.5">
        <span className="font-medium text-slate-600">Order</span>
        <span className="font-mono font-bold text-[11px]">{r.orderId}</span>
      </div>
      <div className="flex items-center justify-between text-[12px] mt-1.5">
        <span className="font-medium text-slate-600">Valid until</span>
        <span className="font-bold">{formatReceiptDate(new Date(r.validUntil).toISOString())}</span>
      </div>

      <div className="my-3 border-t border-dashed border-slate-200" />

      <p className="text-center text-[10px] font-bold tracking-[0.2em] text-slate-400">THANK YOU FOR GOING PRO</p>
    </div>
  );
}

export function ProReceiptView() {
  const { receipt, setReceipt, user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (receipt) {
      const fallback = (user as any)?.email || (profile as any)?.email || receipt.email || '';
      setEmail(fallback);
      setEmailError(null);
    }
  }, [receipt, user, profile]);

  useEffect(() => {
    if (!receipt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReceipt(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [receipt, setReceipt]);

  if (!receipt) return null;

  const sendReceipt = () => {
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError(null);
    // Opens the user's own mail app with the receipt prefilled.
    window.location.href = buildReceiptMailto(receipt, to);
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Payment receipt"
    >
      <div className="w-full max-w-[380px] my-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <h2 className="text-lg font-black">Payment Successful</h2>
          </div>
          <button
            onClick={() => setReceipt(null)}
            aria-label="Close receipt"
            className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <ReceiptPaper r={receipt} />

        {/* Send receipt to email */}
        <div className="mt-3 bg-white rounded-2xl p-3 flex items-center gap-2">
          <Mail size={16} className="text-slate-400 shrink-0 ml-1" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email for receipt"
            className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <button
            onClick={sendReceipt}
            className="shrink-0 px-4 py-2 rounded-xl bg-slate-950 text-white text-[12px] font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            Send
          </button>
        </div>
        {emailError && (
          <p className="mt-1.5 text-[11px] font-semibold text-rose-300 px-1">{emailError}</p>
        )}
        <p className="mt-1.5 text-[10px] text-white/50 px-1">
          Opens your mail app with the receipt addressed to this email.
        </p>

        <button
          onClick={() => setReceipt(null)}
          className="mt-3 w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Printer size={15} />
          Done
        </button>
      </div>
    </div>
  );
}
