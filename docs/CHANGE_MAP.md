# Change Impact Map — bsenexus.in

**Golden rule: koi bhi shared value, copy, ya rule badalne se pehle is file ka
relevant domain section padho, uska checklist follow karo. Ek jagah badli aur
related jagah chhoot gayi = adhura kaam (yehi ₹499→₹199 me hua tha).**

Har domain me ye 5 cheezen hain:

| Field | Matlab |
|---|---|
| **Source of truth** | Asal value/rule kahan rehti hai (code) |
| **Related surfaces** | Wahi cheez jahan-jahan dikhti/use hoti hai — miss hone wali jagahen |
| **Manual copy** | Plain-text/marketing copy jo code se nahi padh sakti — haath se update karni padti hai |
| **Guard** | Automatic test jo drift pakadta hai (hai to; nahi hai to "none — dhyan se") |
| **Checklist** | Badlav ka sahi order |

Naya domain add karna ho to neeche "New domain template" copy karo.

---

## Domain 1 — Plan pricing (₹59 / ₹199 / ₹999 / ₹1,799)

Full checklist: **`docs/PRICING.md`** (ye domain already centralized + test-guarded hai).

- Source of truth: `server/config/plans.ts` (`PRO_PLANS` = charged), `src/config/plans.ts` (`PRO_PLAN_LIST` = shown)
- Guard: `server/tests/pricingSync.test.ts` — display ≠ charge ya hardcoded price par fail
- Manual copy: `public/llms.txt`, `server/services/gemini.ts` (AI Guide prompt)

---

## Domain 2 — Free trial (7-day, no-card)

Trial ki **duration, grant logic, aur copy** teeno alag-alag files me hain — ye
domain **abhi centralized nahi hai**, isliye sabse zyada miss hone ka risk yahin hai.

**Source of truth (duration + grant) — 2 jagah, dono badalni padti hain:**

| # | File | Kya hai |
|---|---|---|
| 1 | `server/security/auth.ts` (~line 417, `SEVEN_DAYS_MS`) | Signup par naya user profile banta hai to 7-day Pro trial grant hota hai |
| 2 | `src/context/AuthContext.tsx` (~line 290 `SEVEN_DAYS_MS`, ~line 1180 `upgradeToPro`) | Client-side trial state + dobara trial lene ka flow |

**Related copy surfaces** ("1-Week" / "7-day" / "7-Day" wali strings) — grep se nikalo,
har match verify karo (kuch "7-day" feed-window wale hain, trial wale nahi):

```bash
grep -rn "1-Week\|1-week\|7-day\|7 day" src/ server/ --include="*.ts" --include="*.tsx"
```

Trial copy wali files (28 Sep 2026 ko verified): `HomeForYou.tsx`, `Layout.tsx`,
`ProUpgradeModal.tsx`, `TermsModal.tsx`, `MarketClock.tsx`, `SubscriptionCard.tsx`,
`Announcements.tsx`, `HelpModal.tsx`, `NewsPortal.tsx`, `ResultsCalendar.tsx`,
`WatchlistManager.tsx`, `LandingPage.tsx`, `AuthContext.tsx`, `types.ts`,
`utils/cashfree.ts`, `utils/aiQuota.ts`, `config/plans.ts`, `server/api/routes.ts`.

**Coincidental "7-day" (trial se related NAHI — inhe mat chedna):**
- `server/database/announcementDao.ts` (`WINDOW_MS`) — 7-day feed recency window
- `server/services/stockNewsService.ts` (`maxAgeMs`) — 7-day news retention
- `src/components/CompanyIntelligenceModal.tsx` (`WEEK`) — 12-week chart bucket

**Manual copy:** `public/llms.txt` (trial section), `server/services/gemini.ts`
(AI Guide prompt ka trial line), `src/components/TermsModal.tsx`.

**Guard:** none — dhyan se.

**Checklist (trial duration badalne par):**
1. `server/security/auth.ts` ka `SEVEN_DAYS_MS` badlo
2. `src/context/AuthContext.tsx` ki dono jagah (`SEVEN_DAYS_MS` + `upgradeToPro`) badlo
3. Upar wale grep se har trial-copy file me "7-day"/"1-Week" text update karo
4. Manual copy (llms.txt, gemini.ts, TermsModal) update karo
5. AI quota trial limit (Domain 5) check karo — kya limit bhi badalni hai?

---

## Domain 3 — "Pro" vs "Pro Trial" label rule (HARD RULE, 27 Sep 2026)

**Rule: paid user → `Pro`, trial user → `Pro Trial`. Koi exception nahi.**
Paid-expired vs trial-ended ki wording bhi alag rehni chahiye.

**Source of truth:** `src/context/AuthContext.tsx` — `isPaidPro`
(`lastPaymentAt` / `proPlanId` se derive hota hai; trial me ye markers kabhi
nahi bante, isliye trial kabhi "Pro" nahi dikhta).

**Related surfaces** (har jagah label logic `isPaidPro` se aani chahiye):
`Layout.tsx`, `ProUpgradeModal.tsx`, `UserProfileModal.tsx`, `MarketClock.tsx`,
`SubscriptionCard.tsx`, `WatchlistManager.tsx`, `utils/aiQuota.ts`,
`server/security/auth.ts`, `server/services/aiQuotaService.ts`.

**Grep recipe:**
```bash
grep -rn "Pro Trial" src/ server/ --include="*.ts" --include="*.tsx"
```

**Guard:** none — dhyan se.

**Checklist (label logic/copy badalne par):**
1. `AuthContext.tsx` ka `isPaidPro` derivation badlo (single point)
2. Grep se har "Pro Trial" surface check karo — koi naya hardcoded label to nahi aaya
3. Paywall copy me paid-expired vs trial-ended wording alag rakho

---

## Domain 4 — Free tier limits (trial khatam hone ke baad)

**Rules (27 Sep 2026):** Free = live BSE feed + **exactly ONE one-time AI summary demo**
(`freeSummaryUsed`, atomic claim; dobara maangne par 403 + demoUsed). **No watchlists,
no Telegram** — dono endpoints Pro-gated, live profile par 503 fail-closed.

**Source of truth (gating):** `server/api/routes.ts` (watchlist + Telegram Pro-gating),
`server/services/aiQuotaService.ts` (one-time demo claim + `freeSummaryUsed`).

**Client mirror:** `src/utils/aiQuota.ts` (demo-used state + copy).

**Related copy surfaces:** `LandingPage.tsx`, `ProUpgradeModal.tsx`, `HelpModal.tsx`,
`SettingsTab.tsx`, `SubscriptionCard.tsx` + manual copy neeche.

**Manual copy:** `public/llms.txt` (Free-tier section), `server/services/gemini.ts`
(AI Guide prompt ka Free-tier line).

**Guard:** none — dhyan se.

**Checklist (Free-tier rule badalne par):**
1. Server gating (`routes.ts`) + demo-claim logic (`aiQuotaService.ts`) badlo
2. Client mirror (`utils/aiQuota.ts`) sync karo
3. Saari copy surfaces + manual copy (llms.txt, gemini.ts) update karo
4. Live profile par 503 fail-closed ab bhi kaam karta hai — verify karo

---

## Domain 5 — AI daily quota (trial: 100/day)

**Source of truth:** `server/services/aiQuotaService.ts` (`dailyLimit = 100`,
~line 58) — trial users ke liye fair-use limit. Admin = unlimited.

**Client mirror (display ke liye — hamesha server se match hona chahiye):**
`src/utils/aiQuota.ts` (`defaultDailyLimit = 100` ~line 125, copy ~lines 156, 171–172).

**"100" wali copy strings** dono files me bikhri hain — limit badle to dono
files ka har `100` check karo:
```bash
grep -n "100" server/services/aiQuotaService.ts src/utils/aiQuota.ts
```

**Guard:** none — dhyan se.

**Checklist:**
1. Server `dailyLimit` badlo
2. Client `defaultDailyLimit` + saari "100/100", "100/day" copy strings sync karo
3. Error strings ("Resets at 00:00 IST") consistent rakho

---

## Domain 6 — Payment flow (Cashfree)

**Source of truth:**
- `server/api/payments.ts` — order create/verify/webhook/claim/recover; plan
  order_id me encoded (`BN_<W|M|H|Y>…`), verify Cashfree order ko source of truth
  maanta hai; grant **sirf** `order_status === 'PAID'` + ownership + exact
  amount/currency par.
- `server/database/paymentOrdersDao.ts` — `payment_orders` ledger
  (`pending → granting → granted/failed`); saare grant paths isi se guzarte hain.
- `server/config/plans.ts` — plan ↔ amount mapping (Domain 1).

**Related surfaces:** `src/utils/cashfree.ts` (checkout, history fetch),
`src/components/ProCheckoutView.tsx`, `ProReceiptView.tsx` (invoice),
`SubscriptionCard.tsx` (claim modal), `PaymentHistory.tsx`,
`src/context/AuthContext.tsx` (login-time silent recovery).

**Copy rule:** payment UI ki saari strings **English-only** (Domain 9).

**Manual copy:** `public/llms.txt` me payment ka zikr ho to sync karo.

**Guard:** none (concurrency/idempotency tests abhi pending hain — 28 Sep 2026 note).

**Checklist (payment rule/flow badalne par):**
1. `server/api/payments.ts` + ledger DAO badlo — **saare 4 grant paths**
   (webhook, return-verify, login-recover, manual claim) `grantWithLedger()` se
   guzarte hain, wahi single funnel hai
2. Client (`cashfree.ts`, checkout/receipt/claim components) sync karo
3. Rate limiter (10/min/IP on recover/claim) ab bhi sahi hai — check karo

---

## Domain 7 — Support contact (`admin@bsenexus.in`)

**6 files me hardcoded hai — email badle to saari badalni padengi:**
`TermsModal.tsx`, `TrustPages.tsx`, `ui/SocialLinks.tsx`, `ui/SupportFloat.tsx`,
`HelpModal.tsx`, `LandingPage.tsx`.

**Grep recipe:**
```bash
grep -rn "admin@bsenexus.in" src/ server/ public/ --include="*.ts" --include="*.tsx" --include="*.html" --include="*.txt"
```

**Guard:** none — dhyan se.

---

## Domain 8 — App version

- `src/version.ts` → `APP_VERSION` (git me base `2.6.0`; Settings me `v{APP_VERSION}` dikhta hai)
- `scripts/bump-version.mjs` npm `prebuild` par har build me patch bump karta hai
  (har AI Studio Publish par 2.6.1, 2.6.2, …)
- **Local verification build ke baad hamesha revert karo:**
  `sed -i "s/APP_VERSION = '[^']*'/APP_VERSION = '2.6.0'/" src/version.ts`

---

## Domain 9 — UI language: English-only (STANDING RULE)

**App UI ki har user-facing string English me hogi.** Chat me Hinglish chalti hai,
app me nahi. (27 Sep 2026: payment batch me Hinglish strings aa gayi thi — wapas
English ki gayi thi.)

Nayi UI copy likhte waqt ye rule yaad rakho; purani Hinglish string dikhe to
Domain-grep se pakad ke theek karo.

---

## Shared manual-copy surfaces (kayin domains se judi hain)

Ye do files **kisi bhi domain ke badlav par check karni hain** — ye code se nahi
padh sakti, isliye har checklist me inka naam hai:

| File | Kin domains ki copy hai |
|---|---|
| `public/llms.txt` | Pricing, trial, Free-tier, payment — plus "do not quote ₹499" directive |
| `server/services/gemini.ts` (AI Guide system prompt) | Pricing, trial, Free-tier |

---

## New domain template

```markdown
## Domain N — <naam>

**Source of truth:** <file + symbol>
**Related surfaces:** <files>
**Manual copy:** <files>
**Guard:** <test ya "none — dhyan se">
**Grep recipe:** <command>
**Checklist:**
1. ...
2. ...
```
