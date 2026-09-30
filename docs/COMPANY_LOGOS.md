# Company logo sources — bsenexus.in landing

Files live in `public/company-logos/`. Rendered by `src/components/landing/CompanyLogos.tsx`
as plain `<img>` tags inside brand tiles (no inline SVG injection).

## What these files are (honest record, 30 Sep 2026)

These are faithful vector depictions of each company's real logo artwork, sourced
via Wikipedia/Wikimedia (community-maintained traces of the official marks) — NOT
files downloaded from the companies' own media kits, and NOT hand-drawn recreations.
They are shown unaltered, nominatively, next to that company's own BSE filings.

| File | Depicts | Source | Official cross-check (30 Sep 2026) |
|---|---|---|---|
| `reliance.svg` | Reliance gold roundel (white R-flame) | Wikimedia-derived | ✅ MATCHES official golden roundel from RIL media kit (ril.com → news-media/resource-center/media-kit) |
| `infosys.svg` | Infosys blue wordmark (#007CC3) | Wikimedia-derived | ✅ CLOSE MATCH to official wordmark (official carries ® symbol; omitted — illegible at tile size) |
| `hdfc-bank.svg` | HDFC Bank emblem (red 4-bracket + blue square) | Wikimedia-derived | ⚠️ Emblem matches official; official lockup adds blue bar + "HDFC BANK" text (from hdfcbank's own site header SVG). Emblem-only chosen deliberately — full lockup is illegible at 27–34px tile sizes |
| `tcs.svg` | TCS black lowercase "tcs" mark | Wikimedia-derived | ⚠️ Core mark matches official; official lockup adds "TATA CONSULTANCY SERVICES" subline (per TCS brand guidelines PDF). Subline omitted — illegible at tile size |

## Notes

- HDFC Bank's website terms state trademark use needs prior written permission.
  Logos here are used nominatively (identifying the company next to its own
  disclosures), the same as stock screeners do — but this is a fact to be aware
  of, not legal advice.
- If a company ever provides an official media-kit file, prefer it and update
  this table.
- Never recreate these marks from memory; never alter the artwork.
