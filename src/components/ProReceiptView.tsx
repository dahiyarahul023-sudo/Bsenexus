/**
 * ProReceiptView — payment success + invoice screen.
 *
 * Shown right after Cashfree returns and our server confirms PAID, and also
 * on demand from Settings ("View receipt") for the last payment.
 * Clean, detailed invoice style: Invoice No., Issued / Valid-Until dates,
 * From / To blocks, an itemised table and a TOTAL row — like a real bill.
 * "Send receipt" opens the user's own mail app with the invoice prefilled
 * to whatever email they type — nothing is sent without their tap
 * (this project has no server mailer).
 */
import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buildReceiptMailto, formatReceiptDate, type PaymentReceipt } from '../utils/cashfree';

function InvoicePaper({ r, toEmail }: { r: PaymentReceipt; toEmail: string }) {
  const planText = r.planLabel
    ? `${r.planLabel}${r.validityDays ? ` (${r.validityDays} days)` : ''}`
    : 'Pro Monthly (30 days)';
  const amount = `₹${Number(r.amount).toFixed(2)}`;

  return (
    <div className="bg-white rounded-3xl px-6 py-6 text-slate-900 shadow-2xl">
      {/* Title */}
      <h3 className="text-[22px] font-black tracking-tight">Invoice</h3>
      <div className="mt-3 border-t border-slate-200" />

      {/* Invoice no. */}
      <div className="mt-4">
        <p className="text-[11px] font-bold text-slate-900">Invoice No.</p>
        <p className="text-[12px] font-mono font-semibold text-slate-600 mt-1 break-all">{r.orderId}</p>
      </div>

      {/* Issued / Valid until */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-bold text-slate-900">Issued Date</p>
          <p className="text-[12px] font-medium text-slate-600 mt-1">{formatReceiptDate(r.paidAt)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900">Valid Until</p>
          <p className="text-[12px] font-medium text-slate-600 mt-1">
            {formatReceiptDate(new Date(r.validUntil).toISOString())}
          </p>
        </div>
      </div>

      {/* From / To */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-bold text-slate-900">From</p>
          <p className="text-[12px] font-medium text-slate-600 mt-1">BSE Nexus</p>
          <p className="text-[12px] text-slate-500">bsenexus.in</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900">To</p>
          <p className="text-[12px] font-medium text-slate-600 mt-1 break-all">
            {toEmail || r.email || '—'}
          </p>
        </div>
      </div>

      {/* Item table */}
      <div className="mt-5 rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span>Item Description</span>
          <span className="text-right">Total</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-3.5 text-[13px] items-center">
          <span>
            <span className="block font-bold text-slate-900">1× {planText}</span>
            <span className="block text-[11px] font-medium text-slate-400 mt-0.5">
              Pro membership · one-time payment
            </span>
          </span>
          <span className="font-bold text-slate-900">{amount}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-t border-slate-100 text-[11px] font-medium text-slate-400">
          <span>Paid via Cashfree · {r.currency}</span>
          <span className="text-right font-bold text-emerald-600">PAID</span>
        </div>
      </div>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[13px] font-black tracking-wide text-slate-900">TOTAL</span>
        <span className="text-[24px] font-black tracking-tight text-slate-900">{amount}</span>
      </div>

      <div className="mt-4 border-t border-slate-200" />
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Note: one-time payment, no auto-renewal. Your Pro stays active until the valid-until
        date above. <span className="font-semibold text-slate-600">Thank you for going Pro.</span>
      </p>
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
    // Opens the user's own mail app with the invoice prefilled.
    window.location.href = buildReceiptMailto(receipt, to);
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Payment invoice"
    >
      <div className="w-full max-w-[420px] my-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <h2 className="text-lg font-black">Payment Successful</h2>
          </div>
          <button
            onClick={() => setReceipt(null)}
            aria-label="Close invoice"
            className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <InvoicePaper r={receipt} toEmail={email} />

        {/* Send invoice to email */}
        <div className="mt-3 bg-white rounded-2xl p-3 flex items-center gap-2">
          <Mail size={16} className="text-slate-400 shrink-0 ml-1" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email for invoice"
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
          Opens your mail app with the invoice addressed to this email.
        </p>

        <button
          onClick={() => setReceipt(null)}
          className="mt-3 w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
