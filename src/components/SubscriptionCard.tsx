/**
 * Subscription & billing card for Settings.
 * Server (/api/payments/status) is the source of truth for Pro state.
 * Auto-renew is intentionally "Coming soon" — it needs RBI e-mandate approval.
 */
import React, { useEffect, useState } from 'react';
import { Crown, CreditCard, BadgeCheck, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customFetch } from '../api';
import { verifyProPayment, claimProPayment } from '../utils/cashfree';
import { PaymentHistory } from './PaymentHistory';

interface SubStatus {
  configured: boolean;
  isPro: boolean;
  proExpiresAt: number;
  plan: { id: string; label: string; amountPaise: number; currency: string; validityDays: number };
  lastPaymentAt: number | null;
  lastOrderId: string | null;
  autoRenew: 'coming_soon';
}

function fmtDate(ts: number | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

function fmtINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

export function SubscriptionCard() {
  const { user, refreshProfile, openCheckout, setReceipt } = useAuth();
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  // "Maine payment kar diya hai" claim flow (27 Sep 2026)
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimOrderId, setClaimOrderId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await customFetch('/api/payments/status');
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.success) {
          setStatus(data as SubStatus);
          // Keep the app-wide Pro flag in sync with the server truth.
          refreshProfile().catch(() => {});
        }
      } catch {
        if (!cancelled) setError('Could not load subscription status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = () => {
    if (!user) {
      setError('Please sign in first.');
      return;
    }
    // Enter the dedicated checkout screen — payment happens inside it.
    setError(null);
    openCheckout();
  };

  const handleViewReceipt = async () => {
    if (!status?.lastOrderId || loadingReceipt) return;
    setLoadingReceipt(true);
    // verify is idempotent per order — safe to re-call for receipt data.
    const v = await verifyProPayment(status.lastOrderId);
    setLoadingReceipt(false);
    if (v.paid && v.receipt) {
      setReceipt(v.receipt);
    } else {
      setError(v.error || 'Could not load the receipt.');
    }
  };

  const handleClaim = async () => {
    if (claiming) return;
    const orderId = claimOrderId.trim();
    if (!orderId) {
      setClaimMsg({ ok: false, text: 'Order ID daalo — ye BN_ se shuru hota hai aur Cashfree receipt par likha hota hai.' });
      return;
    }
    setClaiming(true);
    setClaimMsg(null);
    const r = await claimProPayment(orderId);
    setClaiming(false);
    if (r.ok) {
      setClaimMsg({
        ok: true,
        text: r.alreadyGranted
          ? 'Ye payment pehle hi Pro me jud chuka hai. Kuch karne ki zaroorat nahi.'
          : 'Payment mil gayi — Pro activate ho gaya! 🎉',
      });
      if (r.receipt) setReceipt(r.receipt);
      // Refresh both the card and the app-wide Pro badge.
      try {
        const res = await customFetch('/api/payments/status');
        const data = await res.json().catch(() => null);
        if (data?.success) setStatus(data as SubStatus);
      } catch { /* ignore */ }
      refreshProfile().catch(() => {});
    } else {
      setClaimMsg({ ok: false, text: r.error || 'Claim failed. Please try again.' });
    }
  };

  return (
  <>
    <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl p-4 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-900 dark:text-white">Pro Subscription</span>
        </div>
        {loading ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Loading…</span>
        ) : status?.isPro ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <BadgeCheck className="w-3 h-3" /> Pro Active
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Free Plan</span>
        )}
      </div>

      {!loading && status && (
        <div className="space-y-2.5 text-xs mb-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Plan</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {status.lastPaymentAt
                ? `${status.plan.label} — ${fmtINR(status.plan.amountPaise)} · ${status.plan.validityDays} days (one-time)`
                : 'Pro Trial — 7-day free trial'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Valid until</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {status.isPro ? fmtDate(status.proExpiresAt) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Last payment</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {fmtDate(status.lastPaymentAt)}{' '}
              {status.lastOrderId && (
                <button
                  onClick={handleViewReceipt}
                  disabled={loadingReceipt}
                  className="ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                >
                  {loadingReceipt ? 'Loading…' : 'View receipt'}
                </button>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#252236]">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
              Auto-renew
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 uppercase tracking-wide">Coming soon</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Auto-renew coming soon — renew manually for now.</span>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-3 py-2.5 px-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-semibold rounded-xl">
          {error}
        </div>
      )}

      {!loading && (
        <button
          onClick={handlePay}
          disabled={!status?.configured}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <CreditCard className="w-4 h-4" />
          <span>
            {!status?.configured
              ? 'Payments coming online…'
              : status?.isPro && status?.lastPaymentAt
                ? 'Extend Pro'
                : 'Upgrade to Pro — from ₹59'}
          </span>
        </button>
      )}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
        One-time secure payment via Cashfree · No auto-charge
      </p>

      {/* "Maine payment kar diya hai" — manual recovery (27 Sep 2026).
          For payments whose grant was missed: the user pastes the BN_ order
          id from the Cashfree receipt and the server verifies + grants Pro. */}
      {!loading && status?.configured && (
        <button
          onClick={() => { setClaimOpen(true); setClaimMsg(null); setClaimOrderId(''); }}
          className="w-full mt-2 py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2D283E] rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
        >
          Payment ho gaya, Pro nahi mila? Order ID se restore karo
        </button>
      )}

      {claimOpen && (
        <div
          className="fixed inset-0 z-[97] bg-[#0B0B14]/85 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Restore Pro with order ID"
          onClick={() => { if (!claiming) setClaimOpen(false); }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#2D283E] rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">Pro restore karo</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              Cashfree receipt par likha <span className="font-bold">Order ID</span> yahan daalo
              (BN_ se shuru hota hai). Server payment verify karke Pro de dega.
            </p>
            <input
              value={claimOrderId}
              onChange={(e) => setClaimOrderId(e.target.value)}
              placeholder="BN_M_xxxxxxxxxx_..."
              disabled={claiming}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-[#2D283E] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
            />
            {claimMsg && (
              <div className={`mt-3 py-2.5 px-4 text-[11px] font-semibold rounded-xl border ${
                claimMsg.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}>
                {claimMsg.text}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { if (!claiming) setClaimOpen(false); }}
                disabled={claiming}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2D283E] rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                Band karo
              </button>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Checking…
                  </>
                ) : (
                  'Verify & Activate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    {/* Completed payments + downloadable slips (27 Sep 2026) */}
    <PaymentHistory />
  </>
  );
}
