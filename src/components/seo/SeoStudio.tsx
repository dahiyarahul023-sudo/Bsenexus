import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Search, 
  Send, 
  RefreshCw, 
  Globe, 
  FileSearch, 
  Award, 
  Network, 
  Compass, 
  BookOpen, 
  Layers, 
  PenTool, 
  Target, 
  Link, 
  UserCheck, 
  AlertCircle,
  Play,
  ArrowRight,
  SlidersHorizontal,
  FileCode,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { SEO_SKILLS } from './skillsData';
import { SeoSkillId, SeoSkillMetadata } from './types';
import { PageAuditView } from './PageAuditView';
import { 
  EeatAuditView, 
  SemanticGapView, 
  KeywordDeepDiveView, 
  ContentBriefView, 
  TopicClusterView, 
  WriteContentView, 
  ImproveContentView, 
  FeaturedSnippetView, 
  LinkbuildingView, 
  ExpertInterviewView 
} from './SkillViews';
import { customFetch } from '../../api';
import { cn } from '../../lib/utils';

export const SeoStudio: React.FC = () => {
  const [selectedSkillId, setSelectedSkillId] = useState<SeoSkillId>('page-audit');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Inputs state
  const [inputUrl, setInputUrl] = useState<string>('https://mokobara.com/collections/luggage-all');
  const [inputKeyword, setInputKeyword] = useState<string>('Buy Premium Travel Luggage & Cabin Trolley Bags Online India');
  const [inputContent, setInputContent] = useState<string>('');
  const [inputCompetitors, setInputCompetitors] = useState<string>('Uppercase, ICON, Nasher Miles');
  const [inputTopic, setInputTopic] = useState<string>('BSE Corporate Disclosures & Dividend Record Dates');
  const [inputAuthor, setInputAuthor] = useState<string>('Senior Financial Markets Strategist');

  // Execution state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [hasExecuted, setHasExecuted] = useState<boolean>(false);

  const activeSkill = SEO_SKILLS.find(s => s.id === selectedSkillId) || SEO_SKILLS[0];

  const categories = ['All', 'Audit & Analysis', 'Content & Copy', 'Strategy & Authority'];

  const filteredSkills = SEO_SKILLS.filter(skill => {
    const matchesCat = activeCategory === 'All' || skill.category === activeCategory;
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          skill.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          skill.shortDesc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSelectSkill = (skill: SeoSkillMetadata) => {
    setSelectedSkillId(skill.id);
    setError(null);
    setResult(null);
    setHasExecuted(false);

    // Populate default examples for smooth user testing
    if (skill.exampleData) {
      if (skill.exampleData.url) setInputUrl(skill.exampleData.url);
      if (skill.exampleData.keyword) setInputKeyword(skill.exampleData.keyword);
      if (skill.exampleData.content) setInputContent(skill.exampleData.content);
      if (skill.exampleData.competitors) setInputCompetitors(skill.exampleData.competitors);
      if (skill.exampleData.topic) setInputTopic(skill.exampleData.topic);
      if (skill.exampleData.author) setInputAuthor(skill.exampleData.author);
    }
  };

  const handleLoadDemo = () => {
    handleSelectSkill(activeSkill);
  };

  const executeSkill = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    let endpoint = `/api/seo/${selectedSkillId}`;
    let body: any = {};

    switch (selectedSkillId) {
      case 'page-audit':
        body = { url: inputUrl, content: inputContent, keyword: inputKeyword, competitors: inputCompetitors };
        break;
      case 'eeat-audit':
        body = { url: inputUrl, content: inputContent, author: inputAuthor, domain: inputUrl };
        break;
      case 'semantic-gap':
        body = { keyword: inputKeyword, content: inputContent, url: inputUrl, competitors: inputCompetitors };
        break;
      case 'keyword-deep-dive':
        body = { keyword: inputKeyword, country: 'India / Global' };
        break;
      case 'content-brief':
        body = { keyword: inputKeyword, audience: 'Discerning buyers and investors', tone: 'Authoritative and practical', wordCount: 2400 };
        break;
      case 'topic-cluster':
        body = { topic: inputTopic || inputKeyword, domain: 'bse-nexus.com' };
        break;
      case 'write-content':
        body = { topic: inputTopic || inputKeyword, keywords: inputKeyword, wordCount: 1500 };
        break;
      case 'improve-content':
        body = { content: inputContent || `Sample content for ${inputKeyword}`, keyword: inputKeyword };
        break;
      case 'featured-snippet':
        body = { keyword: inputKeyword, existingText: inputContent, snippetType: 'paragraph' };
        break;
      case 'linkbuilding':
        body = { topic: inputTopic || inputKeyword, url: inputUrl, niche: 'Financial Research & E-commerce', competitors: inputCompetitors };
        break;
      case 'expert-interview':
        body = { topic: inputTopic || inputKeyword, expertRole: inputAuthor || 'Chief Investment Officer' };
        break;
      default:
        body = { url: inputUrl, keyword: inputKeyword, content: inputContent };
    }

    try {
      const res = await customFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP error ${res.status}`);
      }

      setResult(json.data);
      setHasExecuted(true);
    } catch (err: any) {
      setError(err.message || 'Execution failed. Please check server logs or API key.');
    } finally {
      setLoading(false);
    }
  };

  const renderIcon = (iconName: string, className: string = "w-4 h-4") => {
    switch (iconName) {
      case 'FileSearch': return <FileSearch className={className} />;
      case 'Award': return <Award className={className} />;
      case 'Network': return <Network className={className} />;
      case 'Compass': return <Compass className={className} />;
      case 'BookOpen': return <BookOpen className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'PenTool': return <PenTool className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Target': return <Target className={className} />;
      case 'Link': return <Link className={className} />;
      case 'UserCheck': return <UserCheck className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  const renderActiveResult = () => {
    if (!result) return null;

    switch (selectedSkillId) {
      case 'page-audit':
        return <PageAuditView data={result} />;
      case 'eeat-audit':
        return <EeatAuditView data={result} />;
      case 'semantic-gap':
        return <SemanticGapView data={result} />;
      case 'keyword-deep-dive':
        return <KeywordDeepDiveView data={result} />;
      case 'content-brief':
        return <ContentBriefView data={result} />;
      case 'topic-cluster':
        return <TopicClusterView data={result} />;
      case 'write-content':
        return <WriteContentView data={result} />;
      case 'improve-content':
        return <ImproveContentView data={result} />;
      case 'featured-snippet':
        return <FeaturedSnippetView data={result} />;
      case 'linkbuilding':
        return <LinkbuildingView data={result} />;
      case 'expert-interview':
        return <ExpertInterviewView data={result} />;
      default:
        return (
          <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Top Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#1A162B] to-[#120F1E] text-white border border-white/10 shadow-lg relative overflow-hidden">
        {/* Subtle decorative background blur glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                11 Verified Claude Skills
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={10} /> Live AI Powered
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Super SEO Intelligence Studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Full suite of opinionated AI SEO skills: 70-point forensic page audits, Google Quality Rater E-E-A-T scoring, semantic entity gaps, anti-AI slop content writer, and Position 0 snippet engineering.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLoadDemo}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white cursor-pointer transition-all flex items-center gap-1.5 active:scale-95"
              title="Load Mokobara Luggage Audit case as shown in the video"
            >
              <Cpu size={14} className="text-amber-400" />
              <span>Load Video Demo Case</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Skills Selector Grid / Tabs */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#181525] border border-slate-200/80 dark:border-[#2C2740] w-fit">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all select-none",
                  activeCategory === cat 
                    ? "bg-white dark:bg-[#28233D] text-slate-900 dark:text-white shadow-2xs" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 11 skills or /commands..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        {/* 11 Skills Horizontal / Grid Scroll */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredSkills.map((skill) => {
            const isSelected = skill.id === selectedSkillId;
            return (
              <motion.button
                key={skill.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectSkill(skill)}
                className={cn(
                  "text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none group",
                  isSelected
                    ? "bg-white dark:bg-[#1D192E] border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
                    : "bg-white dark:bg-[#161424] border-slate-200/80 dark:border-[#28243A] hover:border-slate-300 dark:hover:border-[#38334E]"
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-[#252035] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-[#352F48]">
                      {skill.command}
                    </span>
                    <span className={cn("p-1 rounded-md border", skill.badgeColor)}>
                      {renderIcon(skill.icon, "w-3.5 h-3.5")}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                    {skill.name}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {skill.shortDesc}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 3. Interactive Input Playground for the Active Skill */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#242036] pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-200 dark:border-amber-800/40">
              {renderIcon(activeSkill.icon, "w-4 h-4")}
            </span>
            <div>
              <div className="text-sm font-black text-slate-900 dark:text-white">
                Execute {activeSkill.command} — {activeSkill.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {activeSkill.fullDesc}
              </div>
            </div>
          </div>

          <button
            onClick={handleLoadDemo}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer shrink-0"
          >
            Reset to Sample Inputs
          </button>
        </div>

        {/* Dynamic Input Fields depending on active skill */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* URL Input (if relevant) */}
          {['page-audit', 'eeat-audit', 'semantic-gap', 'linkbuilding'].includes(selectedSkillId) && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Page URL to Audit</span>
                <span className="text-[10px] text-slate-400 font-normal">Auto-scrapes live HTML & content</span>
              </label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com/page-to-audit"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1728] border border-slate-200 dark:border-[#2D2742] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>
          )}

          {/* Keyword Input */}
          {['page-audit', 'semantic-gap', 'keyword-deep-dive', 'content-brief', 'featured-snippet', 'write-content', 'improve-content'].includes(selectedSkillId) && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Primary Target Keyword
              </label>
              <input
                type="text"
                value={inputKeyword}
                onChange={(e) => setInputKeyword(e.target.value)}
                placeholder="e.g. buy cabin luggage trolley online"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1728] border border-slate-200 dark:border-[#2D2742] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          )}

          {/* Competitors Input */}
          {['page-audit', 'semantic-gap', 'linkbuilding'].includes(selectedSkillId) && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Competitors (Comma separated)
              </label>
              <input
                type="text"
                value={inputCompetitors}
                onChange={(e) => setInputCompetitors(e.target.value)}
                placeholder="e.g. Uppercase, ICON, Samsonite"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1728] border border-slate-200 dark:border-[#2D2742] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          )}

          {/* Topic Input */}
          {['topic-cluster', 'write-content', 'linkbuilding', 'expert-interview'].includes(selectedSkillId) && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pillar Theme or Article Topic
              </label>
              <input
                type="text"
                value={inputTopic}
                onChange={(e) => setInputTopic(e.target.value)}
                placeholder="e.g. BSE Corporate Disclosures & Dividend Guide"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1728] border border-slate-200 dark:border-[#2D2742] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          )}

          {/* Author Input */}
          {['eeat-audit', 'expert-interview'].includes(selectedSkillId) && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Author / Expert Role Credentials
              </label>
              <input
                type="text"
                value={inputAuthor}
                onChange={(e) => setInputAuthor(e.target.value)}
                placeholder="e.g. Rahul Sharma, CFA (10+ yrs research)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1728] border border-slate-200 dark:border-[#2D2742] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          )}

          {/* Direct Content / Draft Text (Optional or mandatory for refresh) */}
          {['page-audit', 'semantic-gap', 'improve-content', 'featured-snippet'].includes(selectedSkillId) && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Page Content Text or Excerpt (Optional if URL provided)</span>
                <span className="text-[10px] text-slate-400 font-normal">Pastes raw text directly to audit</span>
              </label>
              <textarea
                rows={3}
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                placeholder="Paste content here if no live URL is available..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1728] border border-slate-200 dark:border-[#2D2742] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none font-mono"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Engine: <span className="font-semibold text-slate-700 dark:text-slate-300">Gemini 3.8 Flash (Server-Side)</span> • Anti-AI Slop Enforced
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={executeSkill}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold text-xs cursor-pointer shadow-sm disabled:opacity-50 select-none"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Analyzing & Auditing...</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-white" />
                <span>Execute {activeSkill.command}</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Execution Error</div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Results Display Area */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-12 rounded-3xl bg-white dark:bg-[#161424] border border-slate-200/80 dark:border-[#2C2740] shadow-sm flex flex-col items-center justify-center text-center space-y-4"
          >
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <Sparkles size={20} className="absolute text-amber-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Executing {activeSkill.command} Analysis
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Scraping page elements, evaluating competitive SERP benchmarks, and compiling multi-dimensional audit findings...
              </p>
            </div>
          </motion.div>
        )}

        {!loading && hasExecuted && result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Execution Complete • {activeSkill.name} Output
                </span>
              </div>

              <button
                onClick={executeSkill}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>Re-run</span>
              </button>
            </div>

            {renderActiveResult()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
