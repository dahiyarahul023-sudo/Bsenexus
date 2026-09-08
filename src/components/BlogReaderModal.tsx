import React from 'react';
import { 
  X, BookOpen, Clock, Calendar, Share2, CheckCircle2, 
  AlertTriangle, Lightbulb, Check, ChevronLeft, ArrowUpRight, Sparkles 
} from 'lucide-react';
import { MarketGuide } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BlogReaderModalProps {
  guide: MarketGuide | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAnotherGuide?: (guide: MarketGuide) => void;
  onOpenTerminal?: () => void;
}

export function BlogReaderModal({
  guide,
  isOpen,
  onClose,
  onOpenTerminal
}: BlogReaderModalProps) {
  const [copiedLink, setCopiedLink] = React.useState(false);

  useBodyScrollLock(isOpen && Boolean(guide));

  if (!isOpen || !guide) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '#' + (guide.slug || guide.id));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="blog-modal-title"
    >
      <div 
        className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh] overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {guide.category}
            </span>
            <span className="text-slate-400 text-xs hidden sm:inline">•</span>
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{guide.readTime}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              aria-label={copiedLink ? "Link copied to clipboard" : "Copy link to article"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="Copy link to article"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedLink ? 'Link Copied' : 'Share'}</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close article modal"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Article Body */}
        <div className="overflow-y-auto px-4 sm:px-8 py-6 space-y-6 text-slate-800 dark:text-slate-200 flex-1 overscroll-contain">
          {/* Article Title & Hero Metadata */}
          <div className="space-y-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <h1 id="blog-modal-title" className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
              {guide.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {guide.summary || guide.excerpt}
            </p>

            {/* Author Card */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-3">
                {guide.author.avatar && (
                  <img 
                    src={guide.author.avatar} 
                    alt={guide.author.name} 
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded-full object-cover border border-emerald-500/50 shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {guide.author.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {guide.author.role}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{guide.date || guide.publishedAt}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Introduction */}
          <div className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
            {guide.content.introduction}
          </div>

          {/* Article Sections */}
          <div className="space-y-8">
            {guide.content.sections.map((sec, idx) => {
              const bodyParagraphs = sec.body || (sec.content ? [sec.content] : []);
              const points = sec.keyPoints || sec.takeaways || [];

              return (
                <div key={idx} className="space-y-3.5">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-emerald-500 rounded-full inline-block" />
                    <span>{sec.heading || sec.title}</span>
                  </h2>

                  <div className="space-y-2.5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                    {bodyParagraphs.map((p, pIdx) => (
                      <p key={pIdx}>{p}</p>
                    ))}
                  </div>

                  {/* Key Points bullet box */}
                  {points.length > 0 && (
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Key Takeaways</span>
                      </div>
                      <ul className="space-y-1.5">
                        {points.map((kp, kpIdx) => (
                          <li key={kpIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{kp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Callout box */}
                  {sec.callout && (
                    <div className={cn(
                      "rounded-xl p-4 border flex items-start gap-3 text-xs sm:text-sm",
                      sec.callout.type === 'warning' ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-200" :
                      sec.callout.type === 'tip' ? "bg-purple-50/80 dark:bg-purple-950/30 border-purple-300/80 dark:border-purple-800 text-purple-900 dark:text-purple-200" :
                      "bg-blue-50/80 dark:bg-blue-950/30 border-blue-300/80 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                    )}>
                      {sec.callout.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> :
                       sec.callout.type === 'tip' ? <Lightbulb className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" /> :
                       <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                      <div className="leading-relaxed">
                        <span className="font-bold uppercase text-[11px] tracking-wider block mb-0.5">
                          {sec.callout.type === 'warning' ? 'Critical Warning' : sec.callout.type === 'tip' ? 'Pro Analyst Tip' : 'Important Note'}
                        </span>
                        {sec.callout.text}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Checklist Box */}
          {guide.content.checklist && (
            <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-xl space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Forensic Investor Checklist Before Trading</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                {guide.content.checklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-800/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="font-mono text-emerald-400 font-bold">0{i+1}.</span>
                    <span className="text-slate-200 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusion */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            <span className="font-bold text-slate-900 dark:text-white block mb-1 text-base">Conclusion</span>
            {guide.content.conclusion}
          </div>
        </div>

        {/* Modal Footer Bar with Quick Action */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Guides</span>
          </button>

          <button
            onClick={() => {
              onClose();
              if (onOpenTerminal) onOpenTerminal();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Apply Knowledge in Live BSE Terminal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
