/**
 * Plan catalogue — SINGLE SOURCE OF TRUTH for plan DISPLAY data.
 *
 * Rule: no component may hardcode a plan price, duration, label, tag or
 * savings line. Read everything from PRO_PLAN_LIST / getPlanDisplay().
 * When a price changes, edit ONLY this list (and the server charge truth in
 * server/config/plans.ts); every surface updates automatically.
 * The pricingSync test fails the build if display and charge data drift.
 *
 * This module has ZERO imports so it stays safe to import anywhere,
 * including in node-based server tests.
 */
export interface ProPlanDisplay {
  id: string;
  label: string;
  price: number; // ₹ (display only — server decides the charged amount)
  days: number;
  tag?: string; // small highlight under the price, e.g. "Most Popular"
  sub: string; // honest sub-line (real savings vs monthly, or trial note)
  wasPrice?: number; // honest struck-through anchor, e.g. monthly's ₹499 launch anchor
}

export const PRO_PLAN_LIST: ProPlanDisplay[] = [
  { id: 'pro_weekly', label: 'Pro Weekly', price: 59, days: 7, sub: '7 days · try Pro out' },
  {
    id: 'pro_monthly',
    label: 'Pro Monthly',
    price: 199,
    days: 30,
    tag: 'Most Popular',
    wasPrice: 499,
    sub: 'Was ₹499 · 60% launch offer',
  },
  { id: 'pro_halfyearly', label: 'Pro 6-Month', price: 999, days: 180, sub: 'Save ₹195 vs monthly' },
  { id: 'pro_yearly', label: 'Pro Yearly', price: 1799, days: 365, sub: 'Save ₹589 vs monthly' },
];

export function getPlanDisplay(planId?: string | null): ProPlanDisplay {
  return PRO_PLAN_LIST.find((p) => p.id === planId) || PRO_PLAN_LIST[1];
}

/** Cheapest plan price — the single source for "from ₹X" marketing lines. */
export function getLowestPlanPrice(): number {
  return Math.min(...PRO_PLAN_LIST.map((p) => p.price));
}

export function isValidPlanId(planId?: string | null): boolean {
  return Boolean(planId && PRO_PLAN_LIST.some((p) => p.id === planId));
}

/** Derive the plan display from a server-generated order id (BN_<code>_...). */
const ORDER_CODE_TO_PLAN: Record<string, string> = {
  W: 'pro_weekly',
  M: 'pro_monthly',
  H: 'pro_halfyearly',
  Y: 'pro_yearly',
};

export function getPlanDisplayFromOrderId(orderId?: string | null): ProPlanDisplay {
  const m = /^BN_([WMHY])_/.exec(orderId || '');
  const pid = m ? ORDER_CODE_TO_PLAN[m[1]] : 'pro_monthly';
  return getPlanDisplay(pid);
}
