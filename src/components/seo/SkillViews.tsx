import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Compass, 
  BookOpen, 
  PenTool, 
  Target, 
  Link, 
  UserCheck,
  TrendingUp,
  FileText
} from 'lucide-react';
import { 
  EeatAuditResult, 
  SemanticGapResult, 
  KeywordDeepDiveResult, 
  ContentBriefResult, 
  TopicClusterResult, 
  WriteContentResult, 
  ImproveContentResult, 
  FeaturedSnippetResult, 
  LinkbuildingResult, 
  ExpertInterviewResult 
} from './types';
import { cn } from '../../lib/utils';

// Helper for Copy action
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

// 2. EEAT Audit View
export const EeatAuditView: React.FC<{ data: EeatAuditResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Google Quality Rater Evaluation
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            E-E-A-T Forensic Audit Report
          </h2>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Author: <span className="font-semibold text-slate-900 dark:text-white">{data.authorAudit.authorName}</span> • Grade: <span className="font-bold text-amber-500">{data.authorAudit.credibilityGrade}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1E1B2E] border border-slate-200 dark:border-[#302B48] flex items-center gap-3">
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {data.totalScore} <span className="text-sm font-medium text-slate-500">/ {data.maxScore}</span>
          </div>
          <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            {data.overallVerdict}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.entries(data.dimensions) as [string, { score: number; max: number; status: string; findings: string; fixes: string[] }][]).map(([key, item]) => (
          <div key={key} className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                {key}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-200">
                {item.score}/{item.max}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {item.findings}
            </p>
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Recommended Fixes:</div>
              {item.fixes.map((fix, idx) => (
                <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                  <span className="text-emerald-500">•</span>
                  <span>{fix}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            High-Authority Author Bio Rewrite
          </h3>
          <CopyButton text={data.authorAudit.rewrittenBio} />
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-[#1C192C] p-3 rounded-xl border border-slate-200/70 dark:border-[#302B48]">
          "{data.authorAudit.rewrittenBio}"
        </p>
      </div>
    </div>
  );
};

// 3. Semantic Gap View
export const SemanticGapView: React.FC<{ data: SemanticGapResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Target Keyword</div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">{data.targetKeyword}</h2>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-xs font-medium text-slate-500">Top Ranking Competitor Entities:</span>
          {data.topCompetitorEntities.map((ent, i) => (
            <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300">
              {ent}
            </span>
          ))}
        </div>
      </div>

      {/* Entity Relationships Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Entity-Attribute-Relationship Gap Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2C2740] text-slate-500">
                <th className="py-2.5 px-3 font-bold">Entity</th>
                <th className="py-2.5 px-3 font-bold">Attribute</th>
                <th className="py-2.5 px-3 font-bold">Competitor Benchmark</th>
                <th className="py-2.5 px-3 font-bold">Our Status</th>
                <th className="py-2.5 px-3 font-bold">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#242036]">
              {data.entityRelationships.map((rel, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{rel.entity}</td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{rel.attribute}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{rel.competitorValue}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      rel.ourStatus === 'Missing' ? "bg-rose-50 text-rose-600 border border-rose-200" :
                      rel.ourStatus === 'Superficial' ? "bg-amber-50 text-amber-600 border border-amber-200" :
                      "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    )}>
                      {rel.ourStatus}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">{rel.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content Addition Drafts */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Content Expansion Drafts (Ready to Paste)</h3>
        {data.contentAdditionPlan.map((plan, i) => (
          <div key={i} className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{plan.sectionHeading}</span>
              <CopyButton text={plan.draftParagraph} />
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#1B182B] p-3 rounded-lg border border-slate-200/60 dark:border-[#2C2740]">
              {plan.draftParagraph}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. Keyword Deep Dive View
export const KeywordDeepDiveView: React.FC<{ data: KeywordDeepDiveResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Keyword SERP Dissection</div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">{data.keyword}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">{data.searchIntent.intentExplanation}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1E1B2E] border border-slate-200 dark:border-[#302B48] flex items-center gap-3">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Difficulty</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{data.difficultyAndTimeline.difficultyScore}/100</div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
            {data.difficultyAndTimeline.difficultyRating}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ranking Blueprint Timeline</h4>
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{data.difficultyAndTimeline.estimatedRankingTimeline}</p>
          <div className="text-xs text-slate-500 mt-2">Required Depth: {data.difficultyAndTimeline.requiredContentDepth}</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">SERP Winner Secret Patterns</h4>
          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            {data.serpWinnerPatterns.map((pat, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{pat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Semantic Variations & Long-Tail Opportunities</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {data.secondaryVariations.map((v, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A1728] border border-slate-200/70 dark:border-[#2E2844] flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">{v.keyword}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Intent: {v.intent} • Volume: {v.volumeTier}</div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                {v.opportunity}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 5. Content Brief View
export const ContentBriefView: React.FC<{ data: ContentBriefResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Production Editorial Brief</div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">{data.targetKeyword}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Target Word Count: <span className="font-bold text-slate-900 dark:text-white">{data.targetWordCount}</span></p>
        </div>
        <CopyButton text={JSON.stringify(data, null, 2)} label="Export Brief JSON" />
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Internal Link Spoke Roadmap</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.spokeList.map((spoke, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A1728] border border-slate-200/70 dark:border-[#2E2844] space-y-1">
              <div className="text-[10px] font-bold text-indigo-500 uppercase">{spoke.funnelStage}</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">{spoke.targetTopic}</div>
              <div className="text-[11px] text-slate-500">Anchor: "{spoke.anchorText}"</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Heading Architecture & Content Requirements</h3>
        {data.outline.map((sec, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-2">
            <div className="text-xs font-black text-slate-900 dark:text-white">{sec.heading}</div>
            <div className="text-xs text-slate-500 italic">{sec.intent}</div>
            {sec.subheadings && (
              <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-1 my-1.5">
                {sec.subheadings.map((sub, sIdx) => (
                  <div key={sIdx} className="text-xs text-slate-700 dark:text-slate-300 font-medium">{sub}</div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sec.requiredElements.map((el, eIdx) => (
                <span key={eIdx} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Required: {el}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 6. Topic Cluster View
export const TopicClusterView: React.FC<{ data: TopicClusterResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">Core Pillar (Hub Page)</div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">{data.hubPage.title}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{data.hubPage.corePurpose}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tactical Spoke Articles (Supporting Cluster)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {data.spokeArticles.map((spoke) => (
            <div key={spoke.id} className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">{spoke.funnelStage}</span>
                <span className="text-[10px] text-slate-500 font-medium">Intent: {spoke.searchIntent}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{spoke.title}</h4>
              <div className="text-[11px] text-slate-500">Keyword: {spoke.targetKeyword}</div>
              <div className="p-2 rounded bg-slate-50 dark:bg-[#1C192C] text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                <div>Link to Hub: <span className="font-semibold text-slate-800 dark:text-slate-200">"{spoke.internalLinkAnchorToHub}"</span></div>
                <div>Link from Hub: <span className="font-semibold text-slate-800 dark:text-slate-200">"{spoke.internalLinkAnchorFromHub}"</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 7. Anti-AI Slop Content Writer View
export const WriteContentView: React.FC<{ data: WriteContentResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
            Strict Anti-AI Slop Verified
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-2">{data.title}</h2>
          <div className="text-xs text-slate-500 mt-1">Word Count: {data.wordCount} words • Est. Read: {data.readingTimeMinutes} mins</div>
        </div>
        <CopyButton text={data.markdownContent} label="Copy Article Markdown" />
      </div>

      <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1.5">
        <div className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">Executive Takeaways:</div>
        {data.keyTakeaways.map((takeaway, i) => (
          <div key={i} className="text-xs text-amber-950 dark:text-amber-200 flex items-start gap-1.5">
            <span>•</span>
            <span>{takeaway}</span>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm">
        <div className="prose dark:prose-invert max-w-none text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
          {data.markdownContent}
        </div>
      </div>
    </div>
  );
};

// 8. Improve Content View
export const ImproveContentView: React.FC<{ data: ImproveContentResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm space-y-3">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Content Decay & Refresh Diagnosis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
            <span className="font-bold text-rose-700 dark:text-rose-400">Primary Decay Reason:</span>
            <p className="text-rose-950 dark:text-rose-200 mt-1">{data.decayDiagnosis.primaryCause}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1C192C] border border-slate-200 dark:border-[#302B48]">
            <span className="font-bold text-slate-700 dark:text-slate-300">Search Intent Shift:</span>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{data.decayDiagnosis.searchIntentShift}</p>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Fresh High-Information-Gain Module</h3>
          <CopyButton text={data.newInformationGainModule} />
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1C192C] border border-slate-200 dark:border-[#302B48] text-xs text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
          {data.newInformationGainModule}
        </div>
      </div>
    </div>
  );
};

// 9. Featured Snippet View
export const FeaturedSnippetView: React.FC<{ data: FeaturedSnippetResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Position 0 Extraction Target</div>
          <CopyButton text={data.optimizedSnippetAnswer.text} label="Copy Snippet Text" />
        </div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">{data.triggerHeading}</h3>
        <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border-2 border-orange-300 dark:border-orange-800 text-xs font-medium text-slate-900 dark:text-white leading-relaxed">
          "{data.optimizedSnippetAnswer.text}"
        </div>
        <div className="text-[11px] text-slate-500 font-semibold">Word Count: {data.optimizedSnippetAnswer.wordCount} words (Ideal range: 40-55 words)</div>
      </div>

      {data.tableSnippetAlternative && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm space-y-3">
          <h4 className="text-xs font-bold uppercase text-slate-500">Comparison Table Snippet Format</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2C2740]">
                  {data.tableSnippetAlternative.headers.map((h, i) => (
                    <th key={i} className="py-2 px-3 font-bold text-slate-900 dark:text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tableSnippetAlternative.rows.map((r, rIdx) => (
                  <tr key={rIdx} className="border-b border-slate-100 dark:border-[#201D2F]">
                    {r.map((c, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 text-slate-700 dark:text-slate-300">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// 10. Linkbuilding View
export const LinkbuildingView: React.FC<{ data: LinkbuildingResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">Domain Authority Phase</div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">{data.authorityPhase}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">{data.authorityStrategySummary}</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Skyscraper Playbook</h3>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1C192C] border border-slate-200 dark:border-[#302B48] space-y-2 text-xs">
          <div><span className="font-bold text-slate-600 dark:text-slate-400">Competitor Asset:</span> {data.skyscraperPlaybook.competitorAssetType}</div>
          <div><span className="font-bold text-emerald-600 dark:text-emerald-400">Our Superior Angle:</span> {data.skyscraperPlaybook.ourSuperiorAngle}</div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">High-Converting Cold Outreach Pitch</h3>
          <CopyButton text={`${data.outreachEmailTemplate.subject}\n\n${data.outreachEmailTemplate.body}`} label="Copy Email" />
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1C192C] border border-slate-200 dark:border-[#302B48] space-y-2 text-xs">
          <div className="font-bold text-slate-900 dark:text-white">Subject: {data.outreachEmailTemplate.subject}</div>
          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{data.outreachEmailTemplate.body}</div>
        </div>
      </div>
    </div>
  );
};

// 11. Expert Interview View
export const ExpertInterviewView: React.FC<{ data: ExpertInterviewResult }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 mb-1">First-Party Expertise Harvester</div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Provocative Expert Interview Questions</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{data.interviewObjective}</p>
      </div>

      <div className="space-y-3">
        {data.questions.map((q) => (
          <div key={q.id} className="p-4 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 text-xs font-bold flex items-center justify-center border border-pink-200 dark:border-pink-800">
                {q.id}
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{q.question}</h4>
            </div>
            <div className="text-[11px] text-slate-500 pl-7">Why this works: {q.whyItWorks}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
