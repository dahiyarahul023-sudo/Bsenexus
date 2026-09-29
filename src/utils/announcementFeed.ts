/**
 * announcementFeed.ts — feed merge helper (client).
 *
 * The server's announcement cache is in-memory and wipes on every Cloud Run
 * restart/republish; right after a restart the API returns only a handful of
 * freshly-polled filings. A naive `setAnnouncements(serverData)` (replace)
 * would shrink the on-screen feed AND poison the 12h on-device cache with
 * that thin response — old filings then never come back.
 *
 * mergeAnnouncementFeed() unions by id/newsId (incoming wins field-level, so
 * fresh aiSummary/is_sent flags apply), sorts newest-first, and prunes items
 * older than the feed's 7-day "what's new" window to bound growth.
 */

const FEED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function announcementTs(a: any): number {
  return (typeof a?.bseTimestamp === 'number' && !isNaN(a.bseTimestamp) && a.bseTimestamp > 0)
    ? a.bseTimestamp
    : (a?.fetched_at || 0);
}

export function mergeAnnouncementFeed(prev: any[], incoming: any[]): any[] {
  const safePrev = Array.isArray(prev) ? prev : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  const cutoff = Date.now() - FEED_WINDOW_MS;
  const map = new Map<string, any>();
  for (const item of safePrev) {
    const k = item?.id || item?.newsId;
    if (k) map.set(String(k), item);
  }
  for (const item of safeIncoming) {
    const k = item?.id || item?.newsId;
    if (!k) continue;
    const key = String(k);
    map.set(key, map.has(key) ? { ...map.get(key), ...item } : item);
  }
  const merged = Array.from(map.values()).filter(a => {
    const ts = announcementTs(a);
    return ts === 0 || ts >= cutoff;
  });
  merged.sort((a, b) => announcementTs(b) - announcementTs(a));
  return merged;
}
