/**
 * Subscription & billing card for Settings.
 * Server (/api/payments/status) is the source of truth for Pro state.
 * Auto-renew is intentionally "Coming soon" — it needs RBI e-mandate approval.
 */
import React, { useEffect, useState } from 'react';
import { Crown, CreditCard, BadgeCheck, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customFetch } from '../api';
import { verifyProPayment } from '../utils/cashfree';

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

export function SubscriptionCard() {
  const { user, refreshProfile, setIsCheckoutOpen, setReceipt } = useAuth();
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

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
    setIsCheckoutOpen(true);
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

  return (
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
            <span className="font-semibold text-slate-900 dark:text-white">Pro Monthly — ₹199/mo</span>
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
              : status?.isPro
                ? 'Renew Pro — ₹199/mo'
                : 'Upgrade to Pro — ₹199/mo'}
          </span>
        </button>
      )}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
        One-time secure payment via Cashfree · No auto-charge
      </p>
    </div>
  );
}
