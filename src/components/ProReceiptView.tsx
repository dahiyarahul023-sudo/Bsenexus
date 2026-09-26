/**
 * ProReceiptView — payment success + invoice screen.
 *
 * Shown right after Cashfree returns and our server confirms PAID, and also
 * on demand from Settings ("View receipt") for the last payment.
 * Clean, detailed invoice style: Invoice No., Issued / Valid-Until dates,
 * From / To blocks, an itemised table (with the instrument that paid),
 * a big TOTAL row, a scannable Code-128 barcode of the invoice number and
 * an animated PAID stamp. "Send receipt" opens the user's own mail app with
 * the invoice prefilled to whatever email they type — nothing is sent
 * without their tap (this project has no server mailer).
 */
import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buildReceiptMailto, formatReceiptDate, type PaymentReceipt } from '../utils/cashfree';

/* ------------------------------------------------------------------ */
/* Code 128 (subset B) barcode — renders the invoice number as an SVG. */
/* Patterns from the ISO/IEC 15417 table (cf. Wikipedia "Code 128").   */
/* ------------------------------------------------------------------ */
const CODE128: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

function Code128Barcode({ value, height = 46 }: { value: string; height?: number }) {
  const clean = (value || '')
    .split('')
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n >= 32 && n <= 126;
    })
    .join('');
  if (!clean) return null;
  const vals = clean.split('').map((c) => c.charCodeAt(0) - 32);
  const checksum = (104 + vals.reduce((s, v, i) => s + (i + 1) * v, 0)) % 103;
  const codes = [104, ...vals, checksum, 106];
  const unit = 2;
  let x = 12; // quiet zone
  const bars: React.ReactNode[] = [];
  codes.forEach((c, ci) => {
    const pat = CODE128[c];
    for (let i = 0; i < pat.length; i++) {
      const w = Number(pat[i]) * unit;
      if (i % 2 === 0) {
        bars.push(<rect key={`${ci}-${i}`} x={x} y={0} width={w} height={height} fill="#0f172a" />);
      }
      x += w;
    }
  });
  const width = x + 12;
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[250px] h-auto"
        role="img"
        aria-label={`Barcode for invoice ${clean}`}
      >
        <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        {bars}
      </svg>
      <p className="mt-1.5 text-[10px] font-mono font-semibold tracking-[0.18em] text-slate-500">
        {clean}
      </p>
    </div>
  );
}

function InvoicePaper({ r, toEmail }: { r: PaymentReceipt; toEmail: string }) {
  const planText = r.planLabel
    ? `${r.planLabel}${r.validityDays ? ` (${r.validityDays} days)` : ''}`
    : 'Pro Monthly (30 days)';
  const amount = `₹${Number(r.amount).toFixed(2)}`;

  return (
    <div className="relative bg-white rounded-3xl px-6 py-6 text-slate-900 shadow-2xl overflow-hidden">
      <style>{`
        @keyframes stamp-in {
          0% { opacity: 0; transform: rotate(-10deg) scale(2.4); }
          55% { opacity: 1; transform: rotate(-10deg) scale(0.9); }
          78% { transform: rotate(-10deg) scale(1.05); }
          100% { opacity: 1; transform: rotate(-10deg) scale(1); }
        }
        .paid-stamp { animation: stamp-in 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.15) 0.35s both; }
      `}</style>

      {/* PAID rubber stamp */}
      <div className="paid-stamp pointer-events-none absolute top-5 right-5 select-none" aria-hidden="true">
        <div className="border-[3px] border-double border-emerald-700/90 rounded-md px-3 py-1 bg-emerald-50/40">
          <span className="text-[22px] font-black tracking-[0.22em] text-emerald-700/90">PAID</span>
        </div>
      </div>

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
          <span>Paid via Cashfree</span>
          <span className="text-right font-bold text-slate-700">{r.paymentMethod || r.currency}</span>
        </div>
      </div>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[13px] font-black tracking-wide text-slate-900">TOTAL</span>
        <span className="text-[24px] font-black tracking-tight text-slate-900">{amount}</span>
      </div>

      <div className="mt-5 border-t border-slate-200" />

      {/* Barcode */}
      <div className="mt-4">
        <Code128Barcode value={r.orderId} />
      </div>
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
