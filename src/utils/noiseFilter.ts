/**
 * Noise filter utilities for BSE corporate filings.
 * Allows users to mute noisy, routine filing categories (Newspaper, Loss of Share Certificate, etc.)
 */

export const NOISE_PATTERNS = [
  { id: 'newspaper', label: 'Newspaper Publication', regex: /newspaper\s+publication|published\s+in\s+newspaper|cutting\s+of\s+newspaper/i },
  { id: 'share_cert', label: 'Loss of Share Certificate', regex: /loss\s+of\s+share\s+cert|duplicate\s+share\s+cert|issue\s+of\s+duplicate/i },
  { id: 'scrutinizer', label: "Scrutinizer's Report", regex: /scrutinizer(?:'s)?\s+report|voting\s+results\s+and\s+scrutinizer/i },
  { id: 'postal_ballot', label: 'Postal Ballot Notice', regex: /postal\s+ballot\s+notice|e-voting\s+information/i },
  { id: 'trading_window', label: 'Trading Window Closure', regex: /closure\s+of\s+trading\s+window|trading\s+window\s+closure/i },
  { id: 'investor_presentation', label: 'Investor Presentation', regex: /investor\s+presentation|earnings\s+presentation/i },
  { id: 'credit_rating', label: 'Credit Rating Revision', regex: /credit\s+rating|rating\s+assigned|upgrade\s+in\s+rating/i },
];

export function detectFilingType(subject: string): { id: string; label: string } | null {
  if (!subject) return null;
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.regex.test(subject)) {
      return { id: pattern.id, label: pattern.label };
    }
  }
  return null;
}

export function getMutedTypes(): string[] {
  try {
    const saved = localStorage.getItem('nexus_muted_filing_types');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveMutedTypes(types: string[]): void {
  try {
    localStorage.setItem('nexus_muted_filing_types', JSON.stringify(types));
  } catch {}
}

export function getMutedCompanies(): string[] {
  try {
    const saved = localStorage.getItem('nexus_muted_companies');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveMutedCompanies(companies: string[]): void {
  try {
    localStorage.setItem('nexus_muted_companies', JSON.stringify(companies));
  } catch {}
}
