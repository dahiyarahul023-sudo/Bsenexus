/**
 * Plan catalogue — SINGLE SOURCE OF TRUTH for what is CHARGED.
 * amountPaise is in the smallest currency unit. validityDays = Pro duration.
 *
 * The client NEVER sends a price: /api/payments/create-order looks the plan
 * up here. The display twin lives in src/config/plans.ts; the pricingSync
 * test fails if the two drift (id, price, days, label must match).
 *
 * This module has ZERO imports so server tests can import it without
 * pulling in auth/env-gated modules.
 */
export const PRO_PLANS = {
  pro_weekly: {
    id: 'pro_weekly',
    label: 'Pro Weekly',
    amountPaise: 5900, // ₹59
    currency: 'INR',
    validityDays: 7,
  },
  pro_monthly: {
    id: 'pro_monthly',
    label: 'Pro Monthly',
    amountPaise: 19900, // ₹199
    currency: 'INR',
    validityDays: 30,
  },
  pro_halfyearly: {
    id: 'pro_halfyearly',
    label: 'Pro 6-Month',
    amountPaise: 99900, // ₹999
    currency: 'INR',
    validityDays: 180,
  },
  pro_yearly: {
    id: 'pro_yearly',
    label: 'Pro Yearly',
    amountPaise: 179900, // ₹1,799
    currency: 'INR',
    validityDays: 365,
  },
} as const;

export type PlanId = keyof typeof PRO_PLANS;
