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

export function openSafePdfInNewTab(
  pdfLink?: string | null,
  attachmentName?: string | null,
  newsId?: string | null,
  scripCode?: string | null
): void {
  const url = getSafePdfUrl(pdfLink, attachmentName, newsId, scripCode);
  window.open(url, '_blank', 'noopener,noreferrer');
}
