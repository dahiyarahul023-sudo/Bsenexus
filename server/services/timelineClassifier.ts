export interface MaterialEvent {
  id: string;
  eventType: 'DIVIDEND' | 'BONUS' | 'SPLIT' | 'BUYBACK' | 'ORDER_WIN' | 'FINANCIAL_RESULT' | 'BOARD_MEETING' | 'GOVERNANCE' | 'FUND_RAISE' | 'GENERAL';
  title: string;
  description: string;
  dateStr: string;
  timeStr?: string;
  timestamp: number;
  badgeLabel: string;
  badgeColor: 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'slate';
  extractedDetail?: string;
  pdfLink?: string;
  scripCode?: string;
  symbol?: string;
  isHighImpact: boolean;
}

export function classifyMaterialEvent(ann: {
  id?: string;
  newsId?: string;
  subject?: string;
  details?: string;
  headline?: string;
  companyName?: string;
  scrip_cd?: string;
  scripCode?: string;
  symbol?: string;
  bseTime?: string;
  DT_TM?: string;
  News_submission_dt?: string;
  NEWS_DT?: string;
  pdfLink?: string;
  ATTACHMENTNAME?: string;
  attachmentName?: string;
  category?: string;
  priority?: string;
  timestamp?: number;
}): MaterialEvent | null {
  const sub = ann.subject || '';
  const det = ann.details || ann.headline || '';
  const text = `${sub} ${det}`.trim();
  const lower = text.toLowerCase();

  const id = ann.id || ann.newsId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const pdfLink = ann.pdfLink || (ann.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${ann.ATTACHMENTNAME}` : '');
  const timestamp = ann.timestamp || Date.now();
  const dateStr = ann.bseTime || ann.News_submission_dt || ann.DT_TM || ann.NEWS_DT || new Date(timestamp).toLocaleDateString();

  // 1. Dividend
  if (/\b(?:dividend|interim dividend|final dividend|special dividend)\b/i.test(lower)) {
    const isInterim = /interim dividend/i.test(lower);
    const isFinal = /final dividend/i.test(lower);
    const isSpecial = /special dividend/i.test(lower);
    const divType = isSpecial ? 'Special Dividend' : isInterim ? 'Interim Dividend' : isFinal ? 'Final Dividend' : 'Dividend';

    // Try extracting amount ₹ or Rs.
    const amtMatch = text.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)\s*(?:rs\.?|inr|rupees|per share)/i);
    const amt = amtMatch ? `₹${amtMatch[1]} per share` : undefined;

    return {
      id,
      eventType: 'DIVIDEND',
      title: `${divType}${amt ? ` - ${amt}` : ''}`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: 'DIVIDEND',
      badgeColor: 'emerald',
      extractedDetail: amt,
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  // 2. Bonus Issue
  if (/\b(?:bonus issue|issue of bonus|bonus share)\b/i.test(lower)) {
    const ratioMatch = text.match(/(\d+\s*:\s*\d+)/);
    const ratio = ratioMatch ? `Ratio: ${ratioMatch[1]}` : undefined;
    return {
      id,
      eventType: 'BONUS',
      title: `Bonus Share Issue ${ratio ? `(${ratio})` : ''}`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: 'BONUS',
      badgeColor: 'purple',
      extractedDetail: ratio,
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  // 3. Stock Split / Sub-division
  if (/\b(?:stock split|split of|sub-division of share|subdivision)\b/i.test(lower)) {
    const splitMatch = text.match(/from\s*(?:rs\.?|₹)?\s*(\d+)\s*to\s*(?:rs\.?|₹)?\s*(\d+)/i) || text.match(/(\d+\s*:\s*\d+)/);
    const detail = splitMatch ? `Split: ${splitMatch[0]}` : undefined;
    return {
      id,
      eventType: 'SPLIT',
      title: `Stock Split / Sub-Division`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: 'STOCK SPLIT',
      badgeColor: 'purple',
      extractedDetail: detail,
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  // 4. Buyback / Open Offer
  if (/\b(?:buyback|buy-back|open offer|delisting offer)\b/i.test(lower)) {
    const isTender = /tender/i.test(lower);
    const priceMatch = text.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(?:per share)?/i);
    const detail = priceMatch ? `Buyback Price: ₹${priceMatch[1]}` : (isTender ? 'Tender Offer' : 'Open Market');
    return {
      id,
      eventType: 'BUYBACK',
      title: `Share Buyback / Tender Offer`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: 'BUYBACK',
      badgeColor: 'amber',
      extractedDetail: detail,
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  // 5. Order Wins & Commercial Contracts
  if (/\b(?:order win|bagged order|commercial contract|awarded order|received order|loi|letter of intent)\b/i.test(lower)) {
    const crMatch = text.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:crore|cr|million|billion)/i);
    const detail = crMatch ? `Order Value: ₹${crMatch[1]} Cr` : undefined;
    return {
      id,
      eventType: 'ORDER_WIN',
      title: `Major Order Win / Contract`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: 'ORDER WIN',
      badgeColor: 'blue',
      extractedDetail: detail,
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  // 6. Financial Results (Quarterly / Annual / Standalone / Consolidated)
  const isOutcomeOrResults = 
    /\b(?:regulation 33|reg 33|reg\. 33|lodr 33)\b/i.test(lower) ||
    /\b(?:outcome of board|board meeting outcome|outcome of the board|outcome of meeting)\b/i.test(lower) ||
    /\b(?:considered and approved|approved the financial results|approval of financial results|approved un-audited|approved audited)\b/i.test(lower) ||
    /\b(?:financial results?|unaudited results?|un-audited results?|audited results?|quarterly results?|half yearly results?|annual results?|statement of financial results?|standalone results?|consolidated results?|financial results \(standalone|financial results \(std|financial results - standalone|financial results - std)\b/i.test(lower);

  const isPriorIntimation = 
    !/\b(?:outcome|approved|considered and approved|regulation 33|reg 33)\b/i.test(lower) &&
    /\b(?:prior intimation|notice of board|board meeting intimation|to consider and approve|meeting scheduled|meeting will be held|regulation 29|reg 29|closure of trading|trading window)\b/i.test(lower);

  if (isOutcomeOrResults && !isPriorIntimation && !/newspaper publication/i.test(lower)) {
    const isAudited = /audited/i.test(lower) && !/un-audited|unaudited/i.test(lower);
    const hasConsol = /\b(?:consolidated|consol)\b/i.test(lower);
    const hasStd = /\b(?:standalone|std)\b/i.test(lower);

    let typeStr = isAudited ? 'Audited' : 'Unaudited';
    let scopeStr = (hasStd && hasConsol) ? 'Standalone & Consolidated (STD & CONSOL)' : hasStd ? 'Standalone (STD)' : hasConsol ? 'Consolidated' : 'Financial Results';
    
    return {
      id,
      eventType: 'FINANCIAL_RESULT',
      title: `${typeStr} Financial Results - ${scopeStr}`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: hasStd && !hasConsol ? 'RESULTS (STD)' : hasConsol && !hasStd ? 'RESULTS (CONSOL)' : 'RESULTS OUTCOME',
      badgeColor: 'emerald',
      extractedDetail: `${typeStr} ${scopeStr}`,
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  // 7. Fund Raise / QIP / Preferential Issue
  if (/\b(?:fund raise|qip|qualified institutional|preferential issue|rights issue|warrants)\b/i.test(lower)) {
    return {
      id,
      eventType: 'FUND_RAISE',
      title: `Fund Raising / Preferential Allotment`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: 'FUND RAISE',
      badgeColor: 'amber',
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  // 8. Board Meeting Intimations / Outcomes
  if (/\b(?:board meeting|intimation of board meeting|outcome of board meeting|outcome of meeting)\b/i.test(lower)) {
    const isOutcome = /outcome|approved|considered/i.test(lower);
    return {
      id,
      eventType: 'BOARD_MEETING',
      title: isOutcome ? `Board Meeting Outcome` : `Board Meeting Scheduled`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: isOutcome ? 'MEETING OUTCOME' : 'MEETING NOTICE',
      badgeColor: isOutcome ? 'emerald' : 'slate',
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: isOutcome
    };
  }

  // 9. Governance, Credit Ratings & Regulator Actions
  if (/\b(?:credit rating|crisil|icra|care ratings|resignation of|appointment of|auditor|sebi|nclt)\b/i.test(lower)) {
    return {
      id,
      eventType: 'GOVERNANCE',
      title: `Governance / Rating / Regulatory Action`,
      description: sub || det,
      dateStr,
      timestamp,
      badgeLabel: 'GOVERNANCE',
      badgeColor: 'rose',
      pdfLink,
      scripCode: ann.scrip_cd || ann.scripCode,
      symbol: ann.symbol,
      isHighImpact: true
    };
  }

  return null;
}
