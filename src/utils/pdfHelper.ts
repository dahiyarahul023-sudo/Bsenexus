/**
 * PDF Helper for BSE Nexus
 * Resolves BSE PDF attachments safely with automatic fallback for moved files (AttachLive vs AttachHis)
 * and proxies through /api/pdf-open to bypass CORS/hotlinking blocks on mobile/desktop browsers.
 */

export function getSafePdfUrl(
  pdfLink?: string | null,
  attachmentName?: string | null,
  newsId?: string | null,
  scripCode?: string | null
): string {
  if (!pdfLink && !attachmentName && !newsId) {
    return 'https://www.bseindia.com/corporates/ann.html';
  }

  const params = new URLSearchParams();
  if (pdfLink) {
    params.set('url', pdfLink);
  }
  if (attachmentName) {
    params.set('file', attachmentName);
  }
  if (newsId) {
    params.set('newsId', String(newsId));
  }
  if (scripCode) {
    params.set('scrip', String(scripCode));
  }

  return `/api/pdf-open?${params.toString()}`;
}

/**
 * Resolves the direct, official BSE public PDF link (e.g. https://www.bseindia.com/xml-data/corpfiling/AttachLive/...)
 * Unwraps /api/pdf-open proxy URLs if passed, returning a clean, shareable PDF link without server proxy parameters.
 */
export function getDirectBsePdfUrl(
  pdfLink?: string | null,
  attachmentName?: string | null
): string | null {
  if (pdfLink && typeof pdfLink === 'string') {
    const trimmed = pdfLink.trim();
    if (trimmed.includes('/api/pdf-open')) {
      try {
        const dummyBase = 'https://bsenexus.in';
        const parsed = new URL(trimmed, dummyBase);
        const underlying = parsed.searchParams.get('url');
        if (underlying && underlying.startsWith('http')) {
          return underlying;
        }
        const fileParam = parsed.searchParams.get('file');
        if (fileParam) {
          return `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${fileParam}`;
        }
      } catch {}
    } else if (trimmed.startsWith('http')) {
      return trimmed;
    }
  }

  if (attachmentName && typeof attachmentName === 'string') {
    const clean = attachmentName.trim();
    if (clean.startsWith('http')) return clean;
    if (clean.length > 0) {
      return `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${clean}`;
    }
  }

  return null;
}

export function openSafePdfInNewTab(
  pdfLink?: string | null,
  attachmentName?: string | null,
  newsId?: string | null,
  scripCode?: string | null
): void {
  const url = getSafePdfUrl(pdfLink, attachmentName, newsId, scripCode);
  window.open(url, '_blank', 'noopener,noreferrer');
}
