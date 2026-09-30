/**
 * Shareable public URL helpers for filings + results.
 *
 * Canonical schemes (public, no login — like /company/:symbol):
 *   /filing/:symbol/:newsId        e.g. /filing/RELIANCE/ann_500325_20260924_01
 *   /results/:symbol/:quarterKey   e.g. /results/RELIANCE/Q2FY27
 */

const SITE_ORIGIN = 'https://bsenexus.in';

export function filingUrl(symbol: string, newsId: string): string {
  const sym = (symbol || '').trim().toUpperCase();
  const id = (newsId || '').trim();
  return `${SITE_ORIGIN}/filing/${encodeURIComponent(sym)}/${encodeURIComponent(id)}`;
}

export function resultsUrl(symbol: string, quarterKey: string): string {
  const sym = (symbol || '').trim().toUpperCase();
  const q = (quarterKey || '').trim().toUpperCase();
  return `${SITE_ORIGIN}/results/${encodeURIComponent(sym)}/${encodeURIComponent(q)}`;
}

export function whatsappShareUrl(url: string, text?: string): string {
  const msg = text ? `${text} ${url}` : url;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Normalize any quarter-key variant to canonical `QNFYyy` form.
 * Handles: "Q2FY27", "Q2 FY27", "FY27-Q2", "2026-Q2", "Q2FY2027", "q2fy27".
 * Calendar-year keys (2026-Q2) map to FY year: Q1-Q3 → year+1, Q4 → same year
 * (Indian FY runs Apr–Mar).
 */
export function normalizeQuarterKey(raw: string): string {
  const s = (raw || '').toUpperCase().replace(/[\s\-_]+/g, '');
  let q: string | null = null;
  let fy: string | null = null;

  const qm = s.match(/Q([1-4])/);
  if (qm) q = `Q${qm[1]}`;

  const fym = s.match(/FY(\d{2,4})/);
  if (fym) {
    const y = fym[1];
    fy = y.length === 4 ? y.slice(2) : y;
  } else {
    const ym = s.match(/^(\d{4})Q[1-4]$/) || s.match(/^Q[1-4](\d{4})$/);
    if (ym && q) {
      const calYear = parseInt(ym[1], 10);
      const qNum = parseInt(q.slice(1), 10);
      // FY year: Apr–Mar. Q1/Q2/Q3 of calendar year Y belong to FY(Y+1); Q4 to FY(Y).
      const fyYear = qNum === 4 ? calYear : calYear + 1;
      fy = String(fyYear).slice(2);
    }
  }

  if (q && fy) return `${q}FY${fy}`;
  return s;
}

/** Client-side navigation to a shareable page (no full reload when in-app). */
export function navigateToFiling(symbol: string, newsId: string): void {
  if (typeof window === 'undefined') return;
  const path = new URL(filingUrl(symbol, newsId)).pathname;
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export function navigateToResults(symbol: string, quarterKey: string): void {
  if (typeof window === 'undefined') return;
  const path = new URL(resultsUrl(symbol, quarterKey)).pathname;
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/** Parse /filing/:symbol/:newsId or /results/:symbol/:quarterKey from a pathname. */
export function parseShareablePath(pathname: string):
  | { kind: 'filing'; symbol: string; newsId: string }
  | { kind: 'results'; symbol: string; quarterKey: string }
  | null {
  const parts = (pathname || '').split('/').filter(Boolean);
  if (parts.length === 3 && parts[0].toLowerCase() === 'filing') {
    const symbol = decodeURIComponent(parts[1] || '').trim();
    const newsId = decodeURIComponent(parts[2] || '').trim();
    if (symbol && newsId) return { kind: 'filing', symbol, newsId };
  }
  if (parts.length === 3 && parts[0].toLowerCase() === 'results') {
    const symbol = decodeURIComponent(parts[1] || '').trim();
    const quarterKey = decodeURIComponent(parts[2] || '').trim();
    if (symbol && quarterKey) return { kind: 'results', symbol, quarterKey };
  }
  return null;
}
