/**
 * ProReceiptView — payment success + invoice screen, "Advance Receipt Print"
 * style (reference: Instagram reel Dcptq4cI68U).
 *
 * Scene: a dark printer bar sits at the top; the thermal receipt paper prints
 * smoothly DOWNWARD out of its slot (linear feed, ~2.6s); a red PAID stamp
 * slams on; then "Payment Successful" + subtitle fade in and three pill
 * buttons rise in: Re-print receipt (replays the print), Tear receipt
 * (tear-away animation → "torn" state with a Print-receipt option), Copy
 * (copies the receipt as plain text, shows "Copied").
 *
 * Shown right after Cashfree returns and our server confirms PAID, and also
 * on demand from Settings ("View receipt") for the last payment. "Send receipt"
 * opens the user's own mail app with the invoice prefilled to whatever email
 * they type — nothing is sent without their tap (this project has no server
 * mailer).
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Mail, Printer, Scissors, Copy, Check } from 'lucide-react';
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

function Code128Barcode({ value, height = 44 }: { value: string; height?: number }) {
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
        className="w-full max-w-[220px] h-auto"
        role="img"
        aria-label={`Barcode for invoice ${clean}`}
      >
        <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        {bars}
      </svg>
      <p className="mt-1 text-[9px] font-mono font-semibold tracking-[0.18em] text-slate-500">
        {clean}
      </p>
    </div>
  );
}

/** Zigzag torn-paper edge rendered as SVG (deterministic, no CSS guesswork). */
function ZigzagEdge({ width = 300, teeth = 34, height = 10 }: { width?: number; teeth?: number; height?: number }) {
  const pts = useMemo(() => {
    const p = [`0,0`, `${width},0`, `${width},3`];
    for (let i = teeth; i >= 0; i--) {
      const x = Math.round((width * i) / teeth);
      p.push(`${x},${i % 2 === 1 ? height : 3}`);
    }
    p.push(`0,3`);
    return p.join(' ');
  }, [width, teeth, height]);
  return (
    <svg
      className="block w-full"
      style={{ height }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={pts} fill="#ffffff" />
    </svg>
  );
}

function ThermalReceiptPaper({ r }: { r: PaymentReceipt }) {
  const planText = r.planLabel
    ? `${r.planLabel}${r.validityDays ? ` (${r.validityDays} days)` : ''}`
    : 'Pro Monthly (30 days)';
  const amount = `₹${Number(r.amount).toFixed(2)}`;

  return (
    <div className="relative bg-white text-slate-900 px-5 pt-5 pb-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)] font-mono">
      {/* Red PAID rubber stamp — slams on after the print finishes */}
      <div className="paid-stamp-red pointer-events-none absolute top-14 right-3 select-none" aria-hidden="true">
        <div className="border-[3px] border-dashed border-red-600/90 rounded px-2.5 py-1 bg-red-50/30 -rotate-0">
          <span className="text-[20px] font-black tracking-[0.2em] text-red-600/90">PAID</span>
        </div>
      </div>

      <p className="text-center text-[15px] font-black tracking-[0.14em]">BSE NEXUS</p>
      <p className="text-center text-[10px] font-bold tracking-[0.28em] text-slate-500 mt-1">
        PRO MEMBERSHIP RECEIPT
      </p>

      <div className="my-3 border-t border-dashed border-slate-300" />

      <div className="text-[11px] leading-relaxed">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500 font-bold">INVOICE</span>
          <span className="font-bold break-all text-right">{r.orderId}</span>
        </div>
        <div className="flex justify-between gap-2 mt-1">
          <span className="text-slate-500 font-bold">ISSUED</span>
          <span className="font-bold text-right">{formatReceiptDate(r.paidAt)}</span>
        </div>
        <div className="flex justify-between gap-2 mt-1">
          <span className="text-slate-500 font-bold">VALID UNTIL</span>
          <span className="font-bold text-right">
            {formatReceiptDate(new Date(r.validUntil).toISOString())}
          </span>
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-slate-300" />

      <div className="text-[11px]">
        <div className="flex justify-between gap-2 items-baseline">
          <span className="font-bold">1X {planText.toUpperCase()}</span>
          <span className="font-black whitespace-nowrap">{amount}</span>
        </div>
        <p className="text-slate-500 font-bold mt-1">
          PAID VIA CASHFREE{r.paymentMethod ? ` · ${String(r.paymentMethod).toUpperCase()}` : ''}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-slate-300" />

      <div className="flex justify-between items-baseline">
        <span className="text-[13px] font-black tracking-[0.18em]">TOTAL</span>
        <span className="text-[26px] font-black tracking-tight">{amount}</span>
      </div>

      <div className="my-3 border-t border-dashed border-slate-300" />

      <p className="text-center text-[10px] font-bold tracking-[0.22em] text-slate-500 leading-relaxed">
        THANK YOU FOR CHOOSING
        <br />
        BSE NEXUS PRO
      </p>

      <div className="mt-3">
        <Code128Barcode value={r.orderId} />
      </div>
    </div>
  );
}

function buildPlainTextReceipt(r: PaymentReceipt): string {
  const planText = r.planLabel
    ? `${r.planLabel}${r.validityDays ? ` (${r.validityDays} days)` : ''}`
    : 'Pro Monthly (30 days)';
  const amount = `₹${Number(r.amount).toFixed(2)}`;
  return [
    'BSE NEXUS - PRO MEMBERSHIP RECEIPT',
    `Invoice: ${r.orderId}`,
    `Issued: ${formatReceiptDate(r.paidAt)}`,
    `Valid until: ${formatReceiptDate(new Date(r.validUntil).toISOString())}`,
    `Item: 1x ${planText}`,
    `Paid via: Cashfree${r.paymentMethod ? ` (${r.paymentMethod})` : ''}`,
    `Total: ${amount}`,
    'Status: PAID',
    'bsenexus.in',
  ].join('\n');
}

export function ProReceiptView() {
  const { receipt, setReceipt, user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const [tearing, setTearing] = useState(false);
  const [torn, setTorn] = useState(false);
  const [copied, setCopied] = useState(false);
  const tearTimer = useRef<number | null>(null);

  const orderId = receipt?.orderId;

  useEffect(() => {
    if (receipt) {
      const fallback = (user as any)?.email || (profile as any)?.email || receipt.email || '';
      setEmail(fallback);
      setEmailError(null);
      setTorn(false);
      setTearing(false);
      setCopied(false);
      if (tearTimer.current) {
        window.clearTimeout(tearTimer.current);
        tearTimer.current = null;
      }
      setPrintKey((k) => k + 1);
    }
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (tearTimer.current) window.clearTimeout(tearTimer.current);
    };
  }, []);

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

  const doReprint = () => {
    if (tearTimer.current) {
      window.clearTimeout(tearTimer.current);
      tearTimer.current = null;
    }
    setTorn(false);
    setTearing(false);
    setCopied(false);
    setPrintKey((k) => k + 1);
  };

  const doTear = () => {
    if (torn || tearing) return;
    setTearing(true);
    tearTimer.current = window.setTimeout(() => {
      tearTimer.current = null;
      setTearing(false);
      setTorn(true);
    }, 950);
  };

  const doCopy = async () => {
    const text = buildPlainTextReceipt(receipt);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* clipboard unavailable — still show feedback */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const pillBtn =
    'flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 bg-[#FFF7E8] text-slate-900 border border-[#e9dcc0] text-[13px] font-bold shadow-sm hover:bg-[#fffdf6] active:scale-95 transition-all';

  return (
    <div
      className="fixed inset-0 z-[95] bg-[#0B0B14]/88 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Payment invoice"
    >
      <style>{`
        /* Receipt prints downward out of the printer slot — smooth linear feed */
        @keyframes receipt-print-out {
          0% { clip-path: inset(0 0 100% 0); }
          100% { clip-path: inset(0 0 0% 0); }
        }
        .receipt-print { animation: receipt-print-out 2.6s linear 0.6s both; }
        /* Printer hums almost imperceptibly while feeding */
        @keyframes printer-hum {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(0.8px); }
        }
        .printer-hum { animation: printer-hum 0.16s linear 0.6s 16; }
        /* Indicator dot blinks while printing, then stays solid */
        @keyframes dot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        .dot-printing { animation: dot-blink 0.8s ease-in-out 0.6s 4 both; }
        /* PAID rubber-stamp slam */
        @keyframes stamp-slam {
          0% { opacity: 0; transform: rotate(-16deg) scale(2.6); }
          55% { opacity: 1; transform: rotate(-10deg) scale(0.92); }
          78% { transform: rotate(-10deg) scale(1.06); }
          100% { opacity: 1; transform: rotate(-10deg) scale(1); }
        }
        .paid-stamp-red { animation: stamp-slam 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 3.25s both; }
        /* Heading / pills rise in, staggered */
        @keyframes rise-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rise { animation: rise-in 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
        .d-heading { animation-delay: 3.5s; }
        .d-pill-1 { animation-delay: 3.75s; }
        .d-pill-2 { animation-delay: 3.87s; }
        .d-pill-3 { animation-delay: 3.99s; }
        .d-torn { animation-delay: 0.05s; }
        /* Tear-away: receipt ripped off and dropped */
        @keyframes tear-away {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          25% { transform: translateY(12px) rotate(0.8deg); opacity: 1; }
          100% { transform: translateY(110px) rotate(3deg); opacity: 0; }
        }
        .receipt-tearing { animation: tear-away 0.9s cubic-bezier(0.5, 0, 0.8, 0.4) both !important; }
        @keyframes fade-quick {
          from { opacity: 1; } to { opacity: 0; }
        }
        .fade-quick { animation: fade-quick 0.25s ease-in both; }
      `}</style>

      <div className="w-full max-w-[420px] my-auto">
        <div className="flex justify-end mb-2 px-1">
          <button
            onClick={() => setReceipt(null)}
            aria-label="Close invoice"
            className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Animated scene — key change replays the whole print sequence */}
        <div key={printKey} className="flex flex-col items-center">
          {/* Printer bar */}
          <div className="printer-hum relative w-[340px] max-w-full z-10">
            <div className="h-14 rounded-2xl bg-gradient-to-b from-[#2b3350] via-[#1a2038] to-[#0e1226] shadow-[0_12px_32px_rgba(0,0,0,0.55)] relative overflow-hidden">
              {/* top sheen */}
              <div className="absolute top-0 left-4 right-4 h-[3px] rounded-full bg-white/15" />
              {/* paper slot */}
              <div className="absolute left-7 right-7 top-1/2 -translate-y-1/2 h-[7px] rounded-full bg-black/80 shadow-[inset_0_2px_3px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.08)]" />
              {/* indicator dots at both ends */}
              <span className="dot-printing absolute left-2.5 top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full bg-slate-500/70" />
            </div>
          </div>

          {/* Receipt paper — prints out of the slot */}
          {!torn && (
            <div className={`receipt-print ${tearing ? 'receipt-tearing' : ''} w-[300px] max-w-[88%] -mt-1.5 relative z-0`}>
              <ThermalReceiptPaper r={receipt} />
              <ZigzagEdge width={300} teeth={34} height={10} />
            </div>
          )}

          {/* Success / torn messaging + action pills */}
          {!torn ? (
            <div className={tearing ? 'fade-quick flex flex-col items-center' : 'flex flex-col items-center'}>
              <div className="rise d-heading flex flex-col items-center mt-6">
                <h2 className="text-[22px] font-black tracking-tight text-white text-center">
                  Payment Successful
                </h2>
                <p className="mt-1 text-[13px] font-medium text-white/55 text-center">
                  You&apos;re all set — now let the receipt roll!
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5 mt-5">
                <button onClick={doReprint} className={`rise d-pill-1 ${pillBtn}`}>
                  <Printer size={15} />
                  Re-print receipt
                </button>
                <button onClick={doTear} className={`rise d-pill-2 ${pillBtn}`}>
                  <Scissors size={15} />
                  Tear receipt
                </button>
                <button onClick={doCopy} className={`rise d-pill-3 ${pillBtn}`}>
                  {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="rise d-torn flex flex-col items-center mt-6">
                <h2 className="text-[22px] font-black tracking-tight text-white text-center">
                  Receipt Torn
                </h2>
                <p className="mt-1 text-[13px] font-medium text-white/55 text-center">
                  Ready to print a fresh copy anytime.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5 mt-5">
                <button onClick={doReprint} className={`rise d-torn ${pillBtn}`}>
                  <Printer size={15} />
                  Print receipt
                </button>
                <button onClick={doCopy} className={`rise d-torn ${pillBtn}`}>
                  {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Send invoice to email (mailto — unchanged behaviour) */}
        <div className="mt-5 bg-white rounded-2xl p-3 flex items-center gap-2">
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
