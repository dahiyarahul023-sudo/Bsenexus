import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Bot, 
  Calendar, 
  Clock, 
  RotateCw,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

interface AiSummaryViewerProps {
  summaryText: string;
  category?: string;
  companyName?: string;
  onRegenerate?: () => void;
  isGenerating?: boolean;
}

export const AiSummaryViewer: React.FC<AiSummaryViewerProps> = ({
  summaryText,
  category,
  companyName,
  onRegenerate,
  isGenerating = false
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = () => {
    if (!summaryText) return;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Clean text for speech
    const cleanForSpeech = summaryText
      .replace(/[#*`_~]/g, '')
      .replace(/₹/g, 'Rupees ')
      .replace(/Cr/g, 'Crores')
      .replace(/PAT/g, 'Profit after tax')
      .replace(/YoY/g, 'Year on year')
      .replace(/QoQ/g, 'Quarter on quarter');

    const utterance = new SpeechSynthesisUtterance(cleanForSpeech);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // Helper to parse sections from Gemini prompt structure:
  // - 📊 RESULTS ANALYSIS
  // - YoY Growth:
  // - QoQ Growth:
  // - ✨ AI Summary:
  // - 📈 Key Positives:
  // - ⚠️ Key Concerns:
  const parseSections = (text: string) => {
    const lines = text.split('\n');
    let currentSection = 'general';
    const sections: Record<string, string[]> = {
      results: [],
      yoy: [],
      qoq: [],
      summary: [],
      positives: [],
      concerns: [],
      general: []
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const lower = line.toLowerCase();

      if (lower.includes('results analysis')) {
        currentSection = 'results';
        continue;
      } else if (lower.includes('yoy growth:')) {
        currentSection = 'yoy';
        continue;
      } else if (lower.includes('qoq growth:')) {
        currentSection = 'qoq';
        continue;
      } else if (lower.includes('ai summary:') || lower.includes('ai summary')) {
        currentSection = 'summary';
        continue;
      } else if (lower.includes('key positives:')) {
        currentSection = 'positives';
        continue;
      } else if (lower.includes('key concerns:')) {
        currentSection = 'concerns';
        continue;
      }

      if (line) {
        sections[currentSection].push(line);
      }
    }

    return sections;
  };

  const sections = parseSections(summaryText);
  const isStructuredResults = sections.yoy.length > 0 || sections.qoq.length > 0 || sections.positives.length > 0 || sections.concerns.length > 0;

  // Render individual growth metrics into styled metric cards
  const renderMetricLine = (line: string, idx: number) => {
    // Format: - **Revenue:** ₹120 Cr vs ₹100 Cr (**[+20%]**)
    const isPositive = line.includes('+') && !line.includes('-%');
    const isNegative = line.includes('-') && !line.includes('+%');

    // Remove markdown formatting
    const cleanLine = line.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, '');

    return (
      <div 
        key={idx}
        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-[#1E1B2C] border border-slate-200/70 dark:border-[#352F48] text-xs"
      >
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {cleanLine.split('(')[0].trim()}
        </span>
        {cleanLine.includes('(') && (
          <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] shrink-0 flex items-center gap-1 ${
            isPositive 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : isNegative
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            {isPositive && <TrendingUp size={11} />}
            {isNegative && <TrendingDown size={11} />}
            <span>({cleanLine.split('(').slice(1).join('(').replace(/\)/g, '')}</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Top Bar with Model Badge & Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles size={11} className="text-purple-500" />
            <span>Gemini 3.8 Flash Synthesis</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {typeof window !== 'undefined' && 'speechSynthesis' in window && (
            <button
              type="button"
              onClick={handleToggleSpeech}
              aria-label={isSpeaking ? "Stop Voice Readout" : "Listen to AI Synthesis"}
              title={isSpeaking ? "Stop Voice Readout" : "Listen to AI Synthesis"}
              className={`p-1.5 rounded-md border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                isSpeaking 
                  ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 animate-pulse'
                  : 'bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#352F48] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              <span className="hidden sm:inline text-[11px]">{isSpeaking ? 'Stop' : 'Listen'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied AI Synthesis" : "Copy AI Synthesis"}
            title="Copy Synthesis"
            className="p-1.5 rounded-md bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#352F48] hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span className="hidden sm:inline text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isGenerating}
              aria-label="Regenerate with Gemini"
              title="Regenerate with Gemini"
              className="p-1.5 rounded-md bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#352F48] hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={13} className={isGenerating ? "animate-spin text-purple-500" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isStructuredResults ? (
        <div className="space-y-3">
          {/* Executive AI Summary Callout */}
          {sections.summary.length > 0 && (
            <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/50">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-300 mb-1">
                <Sparkles size={12} className="text-purple-500" />
                <span>Executive AI Takeaway</span>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {sections.summary.map(s => s.replace(/\*\*/g, '')).join(' ')}
              </p>
            </div>
          )}

          {/* YoY Growth Card */}
          {sections.yoy.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#15141E] border border-slate-200/90 dark:border-[#2D283E] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-emerald-500" />
                  <span>YoY Growth Breakdown</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Year-on-Year</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {sections.yoy.map((line, i) => renderMetricLine(line, i))}
              </div>
            </div>
          )}

          {/* QoQ Growth Card */}
          {sections.qoq.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#15141E] border border-slate-200/90 dark:border-[#2D283E] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-blue-500" />
                  <span>QoQ Growth Breakdown</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Quarter-on-Quarter</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {sections.qoq.map((line, i) => renderMetricLine(line, i))}
              </div>
            </div>
          )}

          {/* Key Positives */}
          {sections.positives.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>Key Positives</span>
              </div>
              <ul className="space-y-1">
                {sections.positives.map((pos, idx) => (
                  <li key={idx} className="text-xs text-slate-800 dark:text-slate-200 flex items-start gap-1.5 leading-relaxed">
                    <span className="text-emerald-500 font-bold shrink-0">•</span>
                    <span>{pos.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Concerns */}
          {sections.concerns.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                <AlertTriangle size={13} className="text-rose-600 dark:text-rose-400" />
                <span>Key Concerns / Risks</span>
              </div>
              <ul className="space-y-1">
                {sections.concerns.map((con, idx) => (
                  <li key={idx} className="text-xs text-slate-800 dark:text-slate-200 flex items-start gap-1.5 leading-relaxed">
                    <span className="text-rose-500 font-bold shrink-0">•</span>
                    <span>{con.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fallback general lines */}
          {sections.general.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#15141E] border border-slate-200/90 dark:border-[#2D283E] text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {sections.general.join('\n')}
            </div>
          )}
        </div>
      ) : (
        /* Standard / Heuristic Summary Display */
        <div className="bg-slate-50 dark:bg-[#15141E] border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-3.5 space-y-2">
          {summaryText.split('\n').map((para, i) => {
            const trimmed = para.trim();
            if (!trimmed) return <div key={i} className="h-1" />;

            const isHeader = trimmed.startsWith('📊') || trimmed.startsWith('**Key Highlights:') || trimmed.startsWith('✨');
            const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-');
            const isItalicFooter = trimmed.startsWith('<i>') || trimmed.includes('Instant structured extraction');

            if (isItalicFooter) {
              return (
                <div key={i} className="pt-2 border-t border-slate-200/60 dark:border-[#262238] text-[10px] text-slate-500 dark:text-slate-400 italic">
                  {trimmed.replace(/<[^>]*>/g, '')}
                </div>
              );
            }

            if (isHeader) {
              return (
                <div key={i} className="text-xs font-bold text-slate-900 dark:text-white pt-1">
                  {trimmed.replace(/\*\*/g, '')}
                </div>
              );
            }

            if (isBullet) {
              const cleanBullet = trimmed.replace(/^[•\-]\s*/, '');
              const parts = cleanBullet.split(':');
              return (
                <div key={i} className="text-xs text-slate-800 dark:text-slate-200 flex items-start gap-1.5 leading-relaxed">
                  <span className="text-purple-500 font-bold shrink-0">•</span>
                  <span>
                    {parts.length > 1 ? (
                      <>
                        <strong className="font-semibold text-slate-900 dark:text-white">{parts[0].replace(/\*\*/g, '')}:</strong>
                        <span>{parts.slice(1).join(':').replace(/\*\*/g, '')}</span>
                      </>
                    ) : (
                      cleanBullet.replace(/\*\*/g, '')
                    )}
                  </span>
                </div>
              );
            }

            return (
              <p key={i} className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {trimmed.replace(/\*\*/g, '')}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
