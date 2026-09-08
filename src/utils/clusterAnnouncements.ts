/**
 * Smart Grouping and Clustering Engine for BSE Corporate Disclosures
 * Eliminates repeated/duplicate clutter when companies file multiple disclosures in batches.
 */

export interface AnnouncementCluster {
  id: string;
  isCluster: boolean;
  companyName: string;
  scrip_cd?: string;
  count: number;
  primaryItem: any;
  items: any[];
  categories: string[];
  hasResults: boolean;
  hasConcall: boolean;
  hasHighPriority: boolean;
  isSentToTelegram: boolean;
  timeSpanLabel: string;
  isDuplicateSubject: boolean;
}

/**
 * Normalizes company names for robust comparison (e.g. "Info Edge (India) Ltd." -> "info edge")
 */
export function normalizeCompanyName(name: string = ''): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|pvt|private|india|corp|corporation|inc|holdings|enterprises)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Checks if two subjects are identical or near-identical
 */
export function areSubjectsNearIdentical(subjA: string = '', subjB: string = ''): boolean {
  const cleanA = subjA.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanB = subjB.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
  return false;
}

/**
 * Formats a short time difference or time range
 */
export function getClusterTimeSpanLabel(items: any[]): string {
  if (!items || items.length <= 1) return '';
  const times = items
    .map(it => {
      const ts = (typeof it.bseTimestamp === 'number' && !isNaN(it.bseTimestamp) && it.bseTimestamp > 0) 
        ? it.bseTimestamp 
        : (it.fetched_at || 0);
      return ts;
    })
    .filter(t => t > 0);

  if (times.length < 2) return `${items.length} filings`;

  const minTs = Math.min(...times);
  const maxTs = Math.max(...times);
  const diffMin = Math.round((maxTs - minTs) / (60 * 1000));

  if (diffMin <= 1) return `${items.length} filings • same minute`;
  if (diffMin < 60) return `${items.length} filings • within ${diffMin}m`;
  if (diffMin < 180) {
    const hrs = (diffMin / 60).toFixed(1).replace('.0', '');
    return `${items.length} filings • within ${hrs}h`;
  }
  return `${items.length} filings batch`;
}

/**
 * Clusters consecutive or closely timed announcements from the same company.
 * 
 * @param announcements List of announcements (assumed sorted by timestamp desc)
 * @param maxTimeWindowMs Maximum time gap between consecutive filings to bundle (default 4 hours)
 */
export function clusterAnnouncements(
  announcements: any[],
  maxTimeWindowMs: number = 4 * 60 * 60 * 1000
): AnnouncementCluster[] {
  if (!Array.isArray(announcements) || announcements.length === 0) {
    return [];
  }

  const clusters: AnnouncementCluster[] = [];
  let currentGroup: any[] = [];
  let currentScrip: string | null = null;
  let currentNormName: string | null = null;
  let lastItemTimestamp = 0;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    const primaryItem = currentGroup[0];
    const isCluster = currentGroup.length > 1;
    const categories = Array.from(new Set(currentGroup.map(it => it.category || 'OTHER')));
    const hasResults = currentGroup.some(it => it.category === 'RESULTS');
    const hasConcall = currentGroup.some(it => it.category === 'CONFERENCE_CALL');
    const hasHighPriority = currentGroup.some(it => it.category === 'HIGH_PRIORITY' || it.priority === 'HIGH');
    const isSentToTelegram = currentGroup.every(it => Boolean(it.is_sent));

    // Check if subjects across group are duplicate/identical
    const firstSubject = currentGroup[0].subject || '';
    const isDuplicateSubject = isCluster && currentGroup.every(it => areSubjectsNearIdentical(it.subject, firstSubject));

    clusters.push({
      id: `cluster-${primaryItem.id || primaryItem.newsId || Math.random()}`,
      isCluster,
      companyName: primaryItem.companyName,
      scrip_cd: primaryItem.scrip_cd,
      count: currentGroup.length,
      primaryItem,
      items: currentGroup,
      categories,
      hasResults,
      hasConcall,
      hasHighPriority,
      isSentToTelegram,
      timeSpanLabel: getClusterTimeSpanLabel(currentGroup),
      isDuplicateSubject,
    });

    currentGroup = [];
    currentScrip = null;
    currentNormName = null;
    lastItemTimestamp = 0;
  };

  for (const item of announcements) {
    const scrip = item.scrip_cd ? String(item.scrip_cd).trim() : null;
    const normName = normalizeCompanyName(item.companyName);
    const itemTimestamp = (typeof item.bseTimestamp === 'number' && !isNaN(item.bseTimestamp) && item.bseTimestamp > 0)
      ? item.bseTimestamp
      : (item.fetched_at || 0);

    if (currentGroup.length === 0) {
      currentGroup.push(item);
      currentScrip = scrip;
      currentNormName = normName;
      lastItemTimestamp = itemTimestamp;
      continue;
    }

    // Check if this item matches the current group's company
    const matchesScrip = scrip && currentScrip && scrip === currentScrip;
    const matchesName = normName && currentNormName && (normName === currentNormName || normName.includes(currentNormName) || currentNormName.includes(normName));
    const isSameCompany = matchesScrip || matchesName;

    // Check time window (within maxTimeWindowMs of the last added item in cluster)
    const withinTimeWindow = lastItemTimestamp > 0 && itemTimestamp > 0
      ? Math.abs(lastItemTimestamp - itemTimestamp) <= maxTimeWindowMs
      : true;

    if (isSameCompany && withinTimeWindow) {
      currentGroup.push(item);
      lastItemTimestamp = itemTimestamp;
    } else {
      flushGroup();
      currentGroup.push(item);
      currentScrip = scrip;
      currentNormName = normName;
      lastItemTimestamp = itemTimestamp;
    }
  }

  flushGroup();
  return clusters;
}
