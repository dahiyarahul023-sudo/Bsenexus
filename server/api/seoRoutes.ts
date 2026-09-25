import express from "express";
import { 
  runPageAudit,
  runEeatAudit,
  runSemanticGapAnalysis,
  runKeywordDeepDive,
  runContentBrief,
  runTopicClusterPlanning,
  runWriteContent,
  runImproveContent,
  runFeaturedSnippetOptimizer,
  runLinkbuilding,
  runExpertInterview,
  fetchPageContent
} from "../services/seoService.js";
import { addLog } from "../database/logDao.js";
import { indexNowQueue, notifySearchEnginesOfNewPages, INDEXNOW_KEY, INDEXNOW_HOST } from "../services/indexNow.js";

export const seoRouter = express.Router();

// Helper to scrape and inspect a URL
seoRouter.post("/fetch-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    const data = await fetchPageContent(url);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch URL" });
  }
});

// 1. Page Audit
seoRouter.post("/page-audit", async (req, res) => {
  try {
    const { url, content, keyword, competitors } = req.body;
    if (!url && !content) {
      return res.status(400).json({ error: "Please provide either a page URL or content text to audit." });
    }
    addLog('INFO', 'SEO', `Executing Page Audit for ${url || 'raw content'}`);
    const result = await runPageAudit({ url, content, keyword, competitors });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Page Audit failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Audit execution failed." });
  }
});

// 2. EEAT Audit
seoRouter.post("/eeat-audit", async (req, res) => {
  try {
    const { url, content, author, domain } = req.body;
    if (!url && !content) {
      return res.status(400).json({ error: "Please provide either a page URL or content text." });
    }
    addLog('INFO', 'SEO', `Executing E-E-A-T Audit`);
    const result = await runEeatAudit({ url, content, author, domain });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `EEAT Audit failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "E-E-A-T analysis failed." });
  }
});

// 3. Semantic Gap Analysis
seoRouter.post("/semantic-gap", async (req, res) => {
  try {
    const { keyword, content, url, competitors } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: "Target keyword is required for semantic gap analysis." });
    }
    addLog('INFO', 'SEO', `Executing Semantic Gap Analysis for "${keyword}"`);
    const result = await runSemanticGapAnalysis({ keyword, content, url, competitors });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Semantic Gap analysis failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Semantic gap analysis failed." });
  }
});

// 4. Keyword Deep Dive
seoRouter.post("/keyword-deep-dive", async (req, res) => {
  try {
    const { keyword, country } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: "Keyword is required." });
    }
    addLog('INFO', 'SEO', `Executing Keyword Deep Dive for "${keyword}"`);
    const result = await runKeywordDeepDive({ keyword, country });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Keyword deep dive failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Keyword deep dive failed." });
  }
});

// 5. Content Brief
seoRouter.post("/content-brief", async (req, res) => {
  try {
    const { keyword, audience, tone, wordCount } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: "Keyword is required to build a content brief." });
    }
    addLog('INFO', 'SEO', `Generating Content Brief for "${keyword}"`);
    const result = await runContentBrief({ keyword, audience, tone, wordCount });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Content brief generation failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Brief generation failed." });
  }
});

// 6. Topic Cluster Planning
seoRouter.post("/topic-cluster", async (req, res) => {
  try {
    const { topic, domain } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Core topic is required." });
    }
    addLog('INFO', 'SEO', `Planning Topic Cluster for "${topic}"`);
    const result = await runTopicClusterPlanning({ topic, domain });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Topic cluster planning failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Topic cluster planning failed." });
  }
});

// 7. Anti-AI Slop Content Writer
seoRouter.post("/write-content", async (req, res) => {
  try {
    const { topic, keywords, outline, wordCount } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Article topic is required." });
    }
    addLog('INFO', 'SEO', `Executing Anti-Slop Content Writer for "${topic}"`);
    const result = await runWriteContent({ topic, keywords, outline, wordCount });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Write content failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Content writing failed." });
  }
});

// 8. Improve / Refresh Content
seoRouter.post("/improve-content", async (req, res) => {
  try {
    const { content, url, keyword, previousRank } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Please provide content text to refresh." });
    }
    addLog('INFO', 'SEO', `Executing Content Refresh`);
    const result = await runImproveContent({ content, url, keyword, previousRank });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Content improvement failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Improvement failed." });
  }
});

// 9. Featured Snippet Optimizer
seoRouter.post("/featured-snippet", async (req, res) => {
  try {
    const { keyword, existingText, snippetType } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: "Target keyword is required." });
    }
    addLog('INFO', 'SEO', `Optimizing Featured Snippet for "${keyword}"`);
    const result = await runFeaturedSnippetOptimizer({ keyword, existingText, snippetType });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Featured snippet optimization failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Optimization failed." });
  }
});

// 10. Link Building & Outreach
seoRouter.post("/linkbuilding", async (req, res) => {
  try {
    const { url, topic, niche, competitors } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic or page asset name is required." });
    }
    addLog('INFO', 'SEO', `Generating Link Building Strategy for "${topic}"`);
    const result = await runLinkbuilding({ url, topic, niche, competitors });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Link building strategy failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Link building plan failed." });
  }
});

// 11. Expert Interview Extractor
seoRouter.post("/expert-interview", async (req, res) => {
  try {
    const { topic, expertRole, intendedAngle } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required." });
    }
    addLog('INFO', 'SEO', `Generating Expert Interview Questionnaire for "${topic}"`);
    const result = await runExpertInterview({ topic, expertRole, intendedAngle });
    res.json({ success: true, data: result });
  } catch (err: any) {
    addLog('ERROR', 'SEO', `Expert interview extraction failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || "Questionnaire generation failed." });
  }
});

// 12. IndexNow Real-Time Search Engine Submission & Diagnostics (Bing, Yandex, Seznam)
seoRouter.get("/indexnow/stats", (_req, res) => {
  res.json({
    success: true,
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
    stats: indexNowQueue.getStats()
  });
});

seoRouter.post("/indexnow/ping", async (req, res) => {
  try {
    const urls = req.body?.urls;
    if (urls && Array.isArray(urls) && urls.length > 0) {
      notifySearchEnginesOfNewPages(urls);
    }
    const result = await indexNowQueue.flush();
    res.json({
      success: result.success,
      submittedCount: result.submittedCount,
      message: result.success
        ? `Successfully submitted ${result.submittedCount} URL(s) to IndexNow (Bing/Yandex)`
        : `Submission pending/deferred: ${result.error || 'Check queue'}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'IndexNow ping failed' });
  }
});
