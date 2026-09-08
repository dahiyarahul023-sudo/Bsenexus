import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  Copy, 
  Check, 
  ArrowUpRight, 
  Layers, 
  BarChart3, 
  ShieldCheck, 
  BookOpen, 
  Code, 
  TrendingUp,
  FileText,
  HelpCircle
} from 'lucide-react';
import { PageAuditResult } from './types';
import { cn } from '../../lib/utils';

interface PageAuditViewProps {
  data: PageAuditResult;
  onRefresh?: () => void;
}

export const PageAuditView: React.FC<PageAuditViewProps> = ({ data }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const scorecard = data.scorecard;
  const scorePercentage = Math.round((scorecard.totalScore / scorecard.maxTotal) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40';
      case 'warning':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40';
      case 'critical':
      default:
        return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      case 'critical':
      default:
        return 'bg-rose-500';
    }
  };

  const dimensions = [
    { key: 'informationGain', icon: Sparkles, item: scorecard.informationGain },
    { key: 'semanticDepth', icon: Layers, item: scorecard.semanticDepth },
    { key: 'eeatSignals', icon: ShieldCheck, item: scorecard.eeatSignals },
    { key: 'structureReadability', icon: BookOpen, item: scorecard.structureReadability },
    { key: 'technicalOnPage', icon: Code, item: scorecard.technicalOnPage },
    { key: 'conversionIntent', icon: TrendingUp, item: scorecard.conversionIntent },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Card: Content Identity & Overall Score */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
                {data.contentIdentity.pageType}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#352F48]">
                Intent: {data.contentIdentity.primaryIntent}
              </span>
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full border",
                data.contentIdentity.intentMatchStatus.toLowerCase().includes('align') 
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                  : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
              )}>
                Match: {data.contentIdentity.intentMatchStatus}
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {data.contentIdentity.detectedKeyword || "Comprehensive Page Audit"}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Target Audience: <span className="font-medium text-slate-800 dark:text-slate-200">{data.contentIdentity.targetAudience}</span>
              </p>
            </div>
          </div>

          {/* Overall 70-Point Score Circle / Pill */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#1E1B2E] border border-slate-200/80 dark:border-[#302B48] shrink-0">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-slate-200 dark:text-slate-700"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={cn(
                    scorePercentage >= 70 ? "text-emerald-500" : scorePercentage >= 45 ? "text-amber-500" : "text-rose-500"
                  )}
                  strokeDasharray={`${scorePercentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-sm font-black text-slate-900 dark:text-white">
                {scorecard.totalScore}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Scorecard Total
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {scorecard.totalScore} <span className="text-sm font-medium text-slate-500">/ {scorecard.maxTotal}</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {scorePercentage >= 70 ? "Strong Competitive Moat" : scorePercentage >= 45 ? "Moderate Vulnerability" : "High Risk of Disruption"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 6-Dimension Scorecard Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BarChart3 size={16} className="text-amber-500" />
            6-Dimension Audit Scorecard
          </h3>
          <span className="text-xs text-slate-500">Benchmark: Top 3 Google SERP Results</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {dimensions.map(({ key, icon: Icon, item }) => (
            <div 
              key={key}
              className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-2xs hover:border-slate-300 dark:hover:border-[#3D3758] transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg border", getStatusColor(item.status))}>
                    <Icon size={15} />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {item.label}
                  </span>
                </div>
                <span className={cn(
                  "text-xs font-black px-2 py-0.5 rounded-md border",
                  getStatusColor(item.status)
                )}>
                  {item.score}/{item.max}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    item.status === 'good' ? "bg-emerald-500" : item.status === 'warning' ? "bg-amber-500" : "bg-rose-500"
                  )}
                  style={{ width: `${(item.score / item.max) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDot(item.status))} />
                  {item.status.toUpperCase()}
                </span>
                <span>{Math.round((item.score / item.max) * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Competitive Positioning Breakdown */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Layers size={16} className="text-sky-500" />
          Competitive Positioning & SERP Reality
        </h3>

        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#1A1728] p-3.5 rounded-xl border border-slate-200/70 dark:border-[#2E2844]">
          {data.competitivePositioning.summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-2.5 flex items-center gap-1.5">
              <XCircle size={14} />
              Our Vulnerabilities & Gaps
            </div>
            <ul className="space-y-1.5">
              {data.competitivePositioning.ourVulnerabilities.map((vuln, i) => (
                <li key={i} className="text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{vuln}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2.5 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Competitor Moats to Neutralize
            </div>
            <ul className="space-y-1.5">
              {data.competitivePositioning.competitorStrengths.map((strength, i) => (
                <li key={i} className="text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 4. Top 5 Quick Wins */}
      <div className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          Top 5 Quick Wins (High-Impact ROI)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.topQuickWins.map((win) => (
            <div 
              key={win.rank}
              className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black flex items-center justify-center">
                  {win.rank}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    win.impact === 'High' 
                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  )}>
                    Impact: {win.impact}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800/50 text-slate-500 border border-slate-200 dark:border-slate-700">
                    Effort: {win.effort}
                  </span>
                </div>
              </div>

              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {win.title}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {win.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Detailed Findings per Dimension */}
      <div className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-500" />
          Detailed Forensic Findings
        </h3>

        <div className="space-y-3">
          {data.detailedFindings.map((finding, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#272338] pb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {finding.dimension}
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-[#232034] text-slate-700 dark:text-slate-300">
                  {finding.score}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">✓ What Works:</div>
                  <div className="text-emerald-950 dark:text-emerald-200 leading-relaxed">{finding.whatWorks}</div>
                </div>

                <div className="p-3 rounded-lg bg-rose-50/30 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30">
                  <div className="font-bold text-rose-700 dark:text-rose-400 mb-1">⚠ Problems:</div>
                  <div className="text-rose-950 dark:text-rose-200 leading-relaxed">{finding.problems}</div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-200/40 dark:border-indigo-900/30">
                  <div className="font-bold text-indigo-700 dark:text-indigo-400 mb-1">⚡ Recommendations:</div>
                  <div className="text-indigo-950 dark:text-indigo-200 leading-relaxed">{finding.recommendations}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Rewritten Elements: Ready to Paste */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Code size={16} className="text-emerald-500" />
          Rewritten On-Page Elements (Ready to Deploy)
        </h3>

        <div className="space-y-4">
          {/* Title Tag */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1B182B] border border-slate-200/70 dark:border-[#2F2948] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Optimized Title Tag ({data.rewrittenElements.titleTag.charCount} chars)</span>
              <button 
                onClick={() => handleCopy(data.rewrittenElements.titleTag.optimized, 'title')}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {copiedSection === 'title' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copiedSection === 'title' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {data.rewrittenElements.titleTag.optimized}
            </div>
            {data.rewrittenElements.titleTag.original && (
              <div className="text-[11px] text-slate-500">
                Original: <span className="line-through">{data.rewrittenElements.titleTag.original}</span>
              </div>
            )}
          </div>

          {/* Meta Description */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1B182B] border border-slate-200/70 dark:border-[#2F2948] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Optimized Meta Description ({data.rewrittenElements.metaDescription.charCount} chars)</span>
              <button 
                onClick={() => handleCopy(data.rewrittenElements.metaDescription.optimized, 'meta')}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {copiedSection === 'meta' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copiedSection === 'meta' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {data.rewrittenElements.metaDescription.optimized}
            </div>
          </div>

          {/* Opening Hook */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1B182B] border border-slate-200/70 dark:border-[#2F2948] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>High-Retention Opening Hook (Anti-Pogo Sticking)</span>
              <button 
                onClick={() => handleCopy(data.rewrittenElements.openingHook, 'hook')}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                {copiedSection === 'hook' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copiedSection === 'hook' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed italic">
              "{data.rewrittenElements.openingHook}"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
