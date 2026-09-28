# Pricing change checklist

When any plan price, duration, label, tag, or savings line changes, follow
these steps IN ORDER. Nothing else in the codebase may hardcode a plan price.

## 1. Edit the two sources of truth (code)

| # | File | What lives here |
|---|------|-----------------|
| 1 | `server/config/plans.ts` → `PRO_PLANS` | **What is CHARGED** (amountPaise, validityDays). The server never trusts client prices. |
| 2 | `src/config/plans.ts` → `PRO_PLAN_LIST` | **What is SHOWN** (price, days, label, tag, sub, wasPrice). Every component reads from here via `getPlanDisplay()`, `getLowestPlanPrice()`, or `PRO_PLAN_LIST`. |

## 2. Run the guard tests

```bash
node --test --import tsx server/tests/pricingSync.test.ts
```

Fails if: plan ids differ, display price/days/label drift from charged
values, or any component hardcodes a plan price instead of reading the
catalogue. Fix the configs — never weaken the test.

## 3. Update the manual copy surfaces (by hand)

These are plain-text/marketing copies that cannot read the catalogue:

- `public/llms.txt` — pricing section (also the "do not quote ₹499" directive)
- `server/services/gemini.ts` — AI Guide system prompt, plan price line

## 4. Surfaces that update automatically (no manual edit)

LandingPage pricing section, ProUpgradeModal, ProCheckoutView (plan cards +
savings line), SubscriptionCard, SettingsTab, Announcements / NewsPortal /
ResultsCalendar / WatchlistManager / MarketClock / HelpModal / CompanyIntelligenceModal
paywall nudges, aiQuota messages — all read `PRO_PLAN_LIST`.

## 5. Verify and ship

```bash
npx tsc --noEmit && npm run build
# revert the auto-bumped version:
sed -i "s/APP_VERSION = '[^']*'/APP_VERSION = '2.6.0'/" src/version.ts
```

Then push; the change goes live only after AI Studio Pull/Sync + Republish.
