import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, 
  Copy, 
  Check, 
  Send, 
  MessageCircle, 
  ExternalLink, 
  X, 
  Smartphone, 
  Globe, 
  FileText, 
  FileCheck2, 
  Sparkles 
} from 'lucide-react';
import { springSnappy, springBouncy, buttonTap } from '../../../utils/motionTokens';
import { cn } from '../../../lib/utils';
import { getDirectBsePdfUrl } from '../../../utils/pdfHelper';

export interface ShareActionMenuProps {
  title: string;
  headline?: string;
  text?: string;
  url?: string;
  companyName?: string;
  scripCode?: string | number;
  symbol?: string;
  newsId?: string;
  category?: string;
  pdfUrl?: string;
  className?: string;
  buttonLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  id?: string;
}

export const ShareActionMenu: React.FC<ShareActionMenuProps> = ({
  title,
  headline,
  text = '',
  url = '',
  companyName,
  scripCode,
  symbol,
  newsId,
  category,
  pdfUrl,
  className = '',
  buttonLabel,
  size = 'sm',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedState, setCopiedState] = useState<'none' | 'web' | 'pdf' | 'summary'>('none');
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openDown: boolean }>({
    top: 0,
    left: 0,
    openDown: true,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 1. Intelligent URL and Metadata Unwrapping
  // Ensures internal /api/pdf-open proxy routes are never leaked into user shares
  const rawUrl = url || '';
  const rawPdf = pdfUrl || '';

  let extractedPdfUrl = '';
  let extractedNewsId = '';
  let extractedScrip = '';
  let extractedFile = '';

  const inspectForParams = (str: string) => {
    if (!str) return;
    if (str.includes('/api/pdf-open')) {
      try {
        const dummyBase = typeof window !== 'undefined' ? window.location.origin : 'https://bsenexus.in';
        const parsed = new URL(str, dummyBase);
        if (parsed.searchParams.get('url')) extractedPdfUrl = parsed.searchParams.get('url')!;
        if (parsed.searchParams.get('newsId')) extractedNewsId = parsed.searchParams.get('newsId')!;
        if (parsed.searchParams.get('scrip')) extractedScrip = parsed.searchParams.get('scrip')!;
        if (parsed.searchParams.get('file')) extractedFile = parsed.searchParams.get('file')!;
      } catch {}
    }
  };

  inspectForParams(rawUrl);
  inspectForParams(rawPdf);

  const effectiveNewsId = newsId || extractedNewsId || '';
  const effectiveScrip = scripCode ? String(scripCode) : (extractedScrip || '');
  const effectiveTitle = (title || companyName || 'BSE Corporate Announcement').trim();

  // Clean Direct BSE PDF Link (e.g. https://www.bseindia.com/xml-data/corpfiling/AttachLive/...pdf)
  const directPdfUrl = getDirectBsePdfUrl(rawPdf || extractedPdfUrl, extractedFile);

  // Clean Headline (avoid duplicating title if identical)
  const candidateHeadline = (headline || text || '').trim();
  const effectiveHeadline = candidateHeadline && candidateHeadline !== effectiveTitle ? candidateHeadline : '';

  // Canonical Public Web URL for sharing
  // Must always be a clean, absolute URL pointing to the announcement or stock on BSE Nexus
  let canonicalWebUrl = '';
  if (effectiveNewsId) {
    canonicalWebUrl = `https://bsenexus.in/announcement/${encodeURIComponent(effectiveNewsId)}`;
  } else if (rawUrl && !rawUrl.includes('/api/pdf-open')) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      canonicalWebUrl = rawUrl;
    } else {
      canonicalWebUrl = `https://bsenexus.in${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    }
  } else if (effectiveScrip) {
    canonicalWebUrl = `https://bsenexus.in/?scrip=${encodeURIComponent(effectiveScrip)}`;
  } else {
    canonicalWebUrl = typeof window !== 'undefined' && window.location.href && !window.location.href.includes('/api/') 
      ? window.location.href 
      : 'https://bsenexus.in';
  }

  // Detect mobile viewport (<768px for touch bottom sheet)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update desktop coordinates whenever opened or scrolled
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 270;
    const menuHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openDown = spaceBelow >= menuHeight + 12 || spaceBelow > rect.top;

    const top = openDown ? rect.bottom + 6 : Math.max(8, rect.top - menuHeight - 6);

    let left = rect.right - menuWidth;
    if (rect.left < menuWidth && rect.left + menuWidth < window.innerWidth) {
      left = rect.left;
    }
    left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, left));

    setCoords({ top, left, openDown });
  }, [isMobile]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        if (!isMobile) updatePosition();
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, updatePosition, isMobile]);

  const copyToClipboard = async (textToCopy: string, type: 'web' | 'pdf' | 'summary') => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedState(type);
      setTimeout(() => {
        setCopiedState('none');
        setIsOpen(false);
      }, 1100);
    } catch {
      // Fallback
    }
  };

  const handleCopyWebLink = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    copyToClipboard(canonicalWebUrl, 'web');
  };

  const handleCopyPdfLink = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (directPdfUrl) {
      copyToClipboard(directPdfUrl, 'pdf');
    }
  };

  const handleCopySummary = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const lines = [
      effectiveTitle,
      effectiveHeadline ? `Subject: ${effectiveHeadline}` : null,
      '',
      `View on BSE Nexus: ${canonicalWebUrl}`,
      directPdfUrl ? `Official Filing (PDF): ${directPdfUrl}` : null,
    ].filter(l => l !== null).join('\n');
    copyToClipboard(lines, 'summary');
  };

  const handleNativeShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: effectiveTitle,
          text: effectiveHeadline ? `${effectiveTitle} — ${effectiveHeadline}` : effectiveTitle,
          url: canonicalWebUrl,
        });
        setIsOpen(false);
      } catch {
        // User cancelled
      }
    } else {
      handleCopyWebLink();
    }
  };

  const handleWhatsAppShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const lines: string[] = [
      `*${effectiveTitle}*`,
      effectiveHeadline ? `📝 ${effectiveHeadline}` : null,
      '',
      `🔗 *View on BSE Nexus:*`,
      canonicalWebUrl,
      directPdfUrl ? `\n📄 *Official Filing (PDF):*\n${directPdfUrl}` : null,
      '',
      `⚡ _Live BSE corporate disclosures on BSE Nexus_`
    ].filter(l => l !== null) as string[];

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const handleTelegramShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const lines: string[] = [
      `📢 ${effectiveTitle}`,
      effectiveHeadline ? `📝 ${effectiveHeadline}` : null,
      directPdfUrl ? `📄 Official PDF: ${directPdfUrl}` : null,
      `⚡ Live disclosures on BSE Nexus`
    ].filter(Boolean) as string[];

    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(canonicalWebUrl)}&text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const handleTwitterShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tickerTag = effectiveScrip ? `$${effectiveScrip}` : '';
    const lines = [
      `${effectiveTitle} ${tickerTag}`.trim(),
      effectiveHeadline ? (effectiveHeadline.length > 140 ? `${effectiveHeadline.slice(0, 137)}...` : effectiveHeadline) : null,
      `Track on @BSENexus:`
    ].filter(Boolean);

    const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(lines.join('\n'))}&url=${encodeURIComponent(canonicalWebUrl)}`;
    window.open(twUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const sizeStyles = {
    xs: 'min-h-[32px] min-w-[32px] sm:min-h-[26px] sm:min-w-[26px] px-2 py-0.5 text-[11px] gap-1 rounded-lg touch-manipulation',
    sm: 'min-h-[36px] min-w-[36px] sm:min-h-[30px] sm:min-w-[30px] px-2.5 py-1 text-xs gap-1.5 rounded-xl touch-manipulation',
    md: 'min-h-[42px] min-w-[42px] sm:min-h-[36px] sm:min-w-[36px] px-3.5 py-1.5 text-xs font-bold gap-2 rounded-xl touch-manipulation',
  }[size];

  const iconSizes = {
    xs: 12,
    sm: 13,
    md: 15,
  }[size];

  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        id={id}
        ref={triggerRef}
        type="button"
        whileTap={buttonTap}
        transition={springSnappy}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Share options"
        title="Share Disclosure"
        className={cn(
          "inline-flex items-center justify-center font-bold transition-all select-none cursor-pointer border touch-manipulation",
          isOpen
            ? "bg-slate-200 dark:bg-[#2C2740] text-slate-900 dark:text-white border-slate-300 dark:border-[#3D3754] shadow-xs"
            : "bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] dark:hover:bg-[#2F2B40] text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-[#352F48]",
          sizeStyles,
          className
        )}
      >
        <Share2 size={iconSizes} className="text-slate-500 dark:text-slate-400 shrink-0" />
        {buttonLabel && <span>{buttonLabel}</span>}
      </motion.button>

      {/* PORTAL-BASED RENDERING: Completely immune to parent overflow-hidden or clipping */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            isMobile ? (
              /* =========================================================================
                 MOBILE ADAPTATION: Touch-First Bottom Action Sheet with Clean Card Preview
                 ========================================================================= */
              <div 
                className="fixed inset-0 z-[99998] flex items-end justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              >
                {/* Backdrop Blur */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
                />

                {/* Bottom Sheet Drawer */}
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={springBouncy}
                  onClick={(e) => e.stopPropagation()}
                  className="relative z-[99999] w-full max-w-lg bg-white dark:bg-[#181624] border-t border-slate-200 dark:border-[#2C2740] rounded-t-3xl shadow-2xl p-5 pb-8 space-y-3.5 max-h-[90vh] overflow-y-auto"
                >
                  {/* Drag Handle Indicator */}
                  <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto -mt-1 mb-1" />

                  {/* Header & Preview Card */}
                  <div className="space-y-2 border-b border-slate-100 dark:border-[#262238] pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <Share2 size={14} className="text-amber-500" />
                        <span>Share BSE Disclosure</span>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#252233] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                      >
                        <X size={16} />
                      </motion.button>
                    </div>

                    {/* Rich Share Preview */}
                    <div className="p-3 bg-slate-50 dark:bg-[#1E1B2E] border border-slate-200/80 dark:border-[#2C2740] rounded-2xl text-left">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {effectiveTitle}
                      </h4>
                      {effectiveHeadline && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                          {effectiveHeadline}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-200/50 dark:border-[#2B273E] text-[10px]">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                          <Globe size={10} />
                          <span className="truncate max-w-[190px]">bsenexus.in/announcement</span>
                        </span>
                        {directPdfUrl && (
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                            <FileText size={10} />
                            <span>PDF Attached</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Primary Share Options */}
                  <div className="space-y-2">
                    {/* Native Device Share Sheet */}
                    {hasNativeShare && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        transition={springSnappy}
                        onClick={handleNativeShare}
                        className="w-full flex items-center justify-between min-h-[46px] px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-400/40 dark:border-amber-600/40 font-bold text-sm cursor-pointer select-none"
                      >
                        <span className="flex items-center gap-3">
                          <Smartphone size={17} className="text-amber-500" />
                          <span>System Share Sheet...</span>
                        </span>
                        <span className="text-[11px] font-mono opacity-70">Native</span>
                      </motion.button>
                    )}

                    {/* WhatsApp */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleWhatsAppShare}
                      className="w-full flex items-center justify-between min-h-[46px] px-4 py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 font-bold text-sm cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-3">
                        <MessageCircle size={17} className="text-emerald-500" />
                        <span>Share on WhatsApp</span>
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Formatted</span>
                    </motion.button>

                    {/* Telegram */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleTelegramShare}
                      className="w-full flex items-center justify-between min-h-[46px] px-4 py-2.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/25 font-bold text-sm cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-3">
                        <Send size={17} className="text-sky-500" />
                        <span>Share on Telegram</span>
                      </span>
                      <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">Channel / DM</span>
                    </motion.button>

                    {/* X / Twitter */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleTwitterShare}
                      className="w-full flex items-center justify-between min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] dark:hover:bg-[#2E2940] text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-[#352F48] font-bold text-sm cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-3">
                        <ExternalLink size={17} className="text-slate-500" />
                        <span>Post on X (Twitter)</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">{effectiveScrip ? `$${effectiveScrip}` : '#BSE'}</span>
                    </motion.button>
                  </div>

                  {/* Copy Actions Section */}
                  <div className="pt-2 border-t border-slate-100 dark:border-[#262238] space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider px-1">
                      Copy Link & Text
                    </div>

                    {/* Copy Web Link */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      transition={springSnappy}
                      onClick={handleCopyWebLink}
                      className={cn(
                        "w-full flex items-center justify-between min-h-[42px] px-3.5 py-2 rounded-xl font-semibold text-xs cursor-pointer select-none border transition-colors",
                        copiedState === 'web'
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-400"
                          : "bg-slate-50 hover:bg-slate-100 dark:bg-[#201D2E] dark:hover:bg-[#272338] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#302B42]"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        {copiedState === 'web' ? <Check size={15} className="text-emerald-600" /> : <Globe size={15} className="text-emerald-500" />}
                        <span>{copiedState === 'web' ? 'Web Link Copied!' : 'Copy BSE Nexus Web Link'}</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-60">Clean URL</span>
                    </motion.button>

                    {/* Copy Direct BSE PDF Link (if available) */}
                    {directPdfUrl && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        transition={springSnappy}
                        onClick={handleCopyPdfLink}
                        className={cn(
                          "w-full flex items-center justify-between min-h-[42px] px-3.5 py-2 rounded-xl font-semibold text-xs cursor-pointer select-none border transition-colors",
                          copiedState === 'pdf'
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-400"
                            : "bg-slate-50 hover:bg-slate-100 dark:bg-[#201D2E] dark:hover:bg-[#272338] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#302B42]"
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          {copiedState === 'pdf' ? <Check size={15} className="text-rose-600" /> : <FileText size={15} className="text-rose-500" />}
                          <span>{copiedState === 'pdf' ? 'Direct PDF Link Copied!' : 'Copy Official Filing PDF Link'}</span>
                        </span>
                        <span className="text-[10px] font-mono text-rose-500">.PDF</span>
                      </motion.button>
                    )}

                    {/* Copy Complete Summary */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      transition={springSnappy}
                      onClick={handleCopySummary}
                      className={cn(
                        "w-full flex items-center justify-between min-h-[42px] px-3.5 py-2 rounded-xl font-semibold text-xs cursor-pointer select-none border transition-colors",
                        copiedState === 'summary'
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-400"
                          : "bg-slate-50 hover:bg-slate-100 dark:bg-[#201D2E] dark:hover:bg-[#272338] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#302B42]"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        {copiedState === 'summary' ? <Check size={15} className="text-amber-600" /> : <FileCheck2 size={15} className="text-amber-500" />}
                        <span>{copiedState === 'summary' ? 'Summary Copied to Clipboard!' : 'Copy Full Text + Links Summary'}</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-60">Full</span>
                    </motion.button>
                  </div>

                  {/* Cancel Button */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    transition={springSnappy}
                    onClick={() => setIsOpen(false)}
                    className="w-full min-h-[44px] rounded-2xl bg-slate-200/80 hover:bg-slate-300 dark:bg-[#252233] dark:hover:bg-[#2F2B40] text-slate-700 dark:text-slate-300 font-bold text-sm cursor-pointer select-none"
                  >
                    Close
                  </motion.button>
                </motion.div>
              </div>
            ) : (
              /* =========================================================================
                 DESKTOP ADAPTATION: Viewport-Clamped Spring Floating Popover
                 ========================================================================= */
              <div
                className="fixed inset-0 z-[99998]"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              >
                <motion.div
                  ref={menuRef}
                  initial={{
                    opacity: 0,
                    scale: 0.92,
                    y: coords.openDown ? -6 : 6,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.94,
                    y: coords.openDown ? -4 : 4,
                  }}
                  transition={springSnappy}
                  onClick={(e) => e.stopPropagation()}
                  role="menu"
                  aria-orientation="vertical"
                  style={{
                    position: 'fixed',
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                  }}
                  className="z-[99999] min-w-[260px] max-w-[280px] p-2.5 rounded-2xl bg-white/95 dark:bg-[#1A1828]/95 backdrop-blur-xl border border-slate-200/90 dark:border-[#2D283E] shadow-2xl text-xs space-y-1.5 select-none"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-[#252233]">
                    <span className="truncate max-w-[200px] text-slate-800 dark:text-slate-200">
                      {effectiveTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Primary Actions */}
                  <div className="space-y-0.5">
                    {/* WhatsApp */}
                    <motion.button
                      type="button"
                      role="menuitem"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleWhatsAppShare}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2">
                        <MessageCircle size={14} className="text-emerald-500" />
                        <span>Share on WhatsApp</span>
                      </span>
                    </motion.button>

                    {/* Telegram */}
                    <motion.button
                      type="button"
                      role="menuitem"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleTelegramShare}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2">
                        <Send size={14} className="text-sky-500" />
                        <span>Share on Telegram</span>
                      </span>
                    </motion.button>

                    {/* X / Twitter */}
                    <motion.button
                      type="button"
                      role="menuitem"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleTwitterShare}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-[#252233] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink size={14} className="text-slate-500" />
                        <span>Post on X (Twitter)</span>
                      </span>
                    </motion.button>
                  </div>

                  {/* Copy Actions */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-[#252233] space-y-0.5">
                    {/* Copy Web Link */}
                    <motion.button
                      type="button"
                      role="menuitem"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleCopyWebLink}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer text-left",
                        copiedState === 'web'
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold"
                          : "hover:bg-slate-100 dark:hover:bg-[#252233] text-slate-800 dark:text-slate-200"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {copiedState === 'web' ? <Check size={14} className="text-emerald-500" /> : <Globe size={14} className="text-emerald-500" />}
                        <span>{copiedState === 'web' ? 'Web Link Copied!' : 'Copy Web Link'}</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-50">Web</span>
                    </motion.button>

                    {/* Copy Filing PDF Link */}
                    {directPdfUrl && (
                      <motion.button
                        type="button"
                        role="menuitem"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.97 }}
                        transition={springSnappy}
                        onClick={handleCopyPdfLink}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer text-left",
                          copiedState === 'pdf'
                            ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-[#252233] text-slate-800 dark:text-slate-200"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {copiedState === 'pdf' ? <Check size={14} className="text-rose-500" /> : <FileText size={14} className="text-rose-500" />}
                          <span>{copiedState === 'pdf' ? 'PDF Link Copied!' : 'Copy Official PDF Link'}</span>
                        </span>
                        <span className="text-[10px] font-mono text-rose-500">PDF</span>
                      </motion.button>
                    )}

                    {/* Copy Full Formatted Text */}
                    <motion.button
                      type="button"
                      role="menuitem"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleCopySummary}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer text-left",
                        copiedState === 'summary'
                          ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold"
                          : "hover:bg-slate-100 dark:hover:bg-[#252233] text-slate-800 dark:text-slate-200"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {copiedState === 'summary' ? <Check size={14} className="text-amber-500" /> : <FileCheck2 size={14} className="text-amber-500" />}
                        <span>{copiedState === 'summary' ? 'Summary Copied!' : 'Copy Formatted Text'}</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-50">Text</span>
                    </motion.button>
                  </div>

                  {/* Device Share (if supported) */}
                  {hasNativeShare && (
                    <motion.button
                      type="button"
                      role="menuitem"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={springSnappy}
                      onClick={handleNativeShare}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl font-semibold bg-slate-50 dark:bg-[#221F30] hover:bg-slate-100 dark:hover:bg-[#2A263B] text-slate-900 dark:text-white transition-colors cursor-pointer text-left border-t border-slate-100 dark:border-[#262238] mt-1"
                    >
                      <Smartphone size={14} className="text-amber-500" />
                      <span>More Options...</span>
                    </motion.button>
                  )}
                </motion.div>
              </div>
            )
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
