/**
 * Payment History — the user's completed payments with downloadable slips.
 *
 * Lists every PAID-and-granted order (newest first) from
 * GET /api/payments/history. Each row has a "Slip" button that opens the
 * full invoice (the existing ProReceiptView) for that payment, so the user
 * can re-view / mail the slip any time after payment.
 */
import React, { useEffect, useState } from 'react';
import { ReceiptText, Download, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchPaymentHistory,
  formatReceiptDate,
  type PaymentHistoryEntry,
  type PaymentReceipt,
} from '../utils/cashfree';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return iso;
  }
}

function fmtINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

export function PaymentHistory() {
  const { user, profile, setReceipt } = useAuth();
  const [payments, setPayments] = useState<PaymentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingOrderId, setOpeningOrderId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const r = await fetchPaymentHistory();
    setLoading(false);
    if (r.ok) {
      setPayments(r.payments);
    } else {
      setError(r.error || 'Could not load payment history.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchPaymentHistory();
      if (cancelled) return;
      setLoading(false);
      if (r.ok) {
        setPayments(r.payments);
      } else {
        setError(r.error || 'Could not load payment history.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Open the full invoice slip for one past payment. */
  const openSlip = (p: PaymentHistoryEntry) => {
    if (openingOrderId) return;
    setOpeningOrderId(p.orderId);
    const email =
      (user as any)?.email || (profile as any)?.email || '';
    const receipt: PaymentReceipt = {
      orderId: p.orderId,
      amount: p.amountPaise / 100,
      currency: p.currency || 'INR',
      paidAt: p.paidAt,
      email,
      validUntil: p.validUntil || Date.now(),
      planId: p.planId || undefined,
      planLabel: p.planLabel,
      validityDays: p.validityDays || undefined,
      paymentMethod: 'Cashfree',
    };
    // Let the spinner paint before the modal opens.
    requestAnimationFrame(() => {
      setReceipt(receipt);
      setOpeningOrderId(null);
    });
  };

  return (
    <div className="mt-3 bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl p-4 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white">Payment History</span>
        </div>
        {!loading && !error && payments.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            {payments.length} payment{payments.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex flex-col items-center gap-2">
          <span className="w-5 h-5 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-[11px] font-semibold text-slate-400">Payments load ho rahe hain…</p>
        </div>
      ) : error ? (
        <div className="py-4 flex flex-col items-center gap-2">
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2D283E] rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Dobara try karo
          </button>
        </div>
      ) : payments.length === 0 ? (
        <p className="py-4 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
          Abhi tak koi completed payment nahi hai. Payment karne ke baad yahan
          uski slip milegi.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div
              key={p.orderId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-[#252236] bg-slate-50/60 dark:bg-black/20"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">
                  {p.planLabel}
                  {p.validityDays ? (
                    <span className="font-medium text-slate-400"> · {p.validityDays} days</span>
                  ) : null}
                </p>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                  {fmtDate(p.paidAt)}
                  {p.validUntil ? ` → valid till ${formatReceiptDate(new Date(p.validUntil).toISOString())}` : ''}
                </p>
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5" title={p.orderId}>
                  {p.orderId}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-black text-slate-900 dark:text-white">
                  {fmtINR(p.amountPaise)}
                </p>
                <button
                  onClick={() => openSlip(p)}
                  disabled={openingOrderId === p.orderId}
                  className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                >
                  {openingOrderId === p.orderId ? (
                    <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  {openingOrderId === p.orderId ? 'Khul rahi…' : 'Slip'}
                </button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
            Sirf successful payments yahan dikhti hain — adhuri koshishen nahi.
          </p>
        </div>
      )}
    </div>
  );
}
