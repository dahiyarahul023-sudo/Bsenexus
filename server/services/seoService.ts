import { GoogleGenAI } from "@google/genai";
import { addLog } from "../database/logDao.js";

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Anti-AI Slop system instructions
const ANTI_AI_SLOP_DIRECTIVE = `
CRITICAL WRITING RULES (STRICT ANTI-AI SLOP):
- NEVER use standard AI clichés or filler phrases: "in today's fast-paced digital world", "delve into", "a testament to", "tapestry", "beacon", "game-changer", "dive deep", "furthermore", "leverage", "supercharge", "unleash", "embark", "holistic", "seamlessly", "vital role".
- Avoid generic praise or meaningless introductory padding. Begin directly with high-density, authoritative substance.
- Write in a direct, seasoned expert voice with varied sentence cadence and concrete specifics (metrics, real entity names, actionable steps).
- Include precise entity relationships and data-backed rationale rather than vague summaries.
`;

// Helper to safely extract readable text from a URL
export async function fetchPageContent(urlStr: string): Promise<{ title: string; content: string; metaDescription: string }> {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error("Invalid URL protocol. Only HTTP and HTTPS are permitted.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BSE-Nexus-SEO-Auditor/2.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const metaDescription = metaMatch ? metaMatch[1].trim() : "";

    // Strip scripts, styles, svg, and tags
    let cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();

    // Cap text to avoid exceeding token limits while maintaining high context
    cleanText = cleanText.substring(0, 22000);

    return { title, content: cleanText, metaDescription };
  } catch (err: any) {
    addLog('WARNING', 'SEO', `Failed to scrape URL ${urlStr}: ${err.message}`);
    throw err;
  }
}

// 1. PAGE AUDIT (Full 70-Point Scorecard)
export async function runPageAudit(params: {
  url?: string;
  content?: string;
  keyword?: string;
  competitors?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) {
    throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
  }

  let textToAnalyze = params.content || "";
  let pageTitle = "";
  let pageMeta = "";

  if (params.url && (!textToAnalyze || textToAnalyze.length < 50)) {
    try {
      const scraped = await fetchPageContent(params.url);
      textToAnalyze = scraped.content;
      pageTitle = scraped.title;
      pageMeta = scraped.metaDescription;
    } catch (err: any) {
      if (!textToAnalyze) {
        throw new Error(`Could not fetch page URL (${err.message}). Please paste the content manually.`);
      }
    }
  }

  const prompt = `
You are the world's most elite SEO Auditor & Technical Strategist.
Conduct an exhaustive, high-precision Page & SERP Competitive Audit matching the Bizwit AI / Claude SuperSEO methodology.

${ANTI_AI_SLOP_DIRECTIVE}

PAGE DETAILS:
- URL: ${params.url || 'Direct Content Input'}
- Target Primary Keyword: ${params.keyword || 'Auto-detect from page'}
- Competitor Benchmark Context: ${params.competitors || 'Standard Top 3 SERP Competitors in Niche'}
- Detected Title: ${pageTitle || 'N/A'}
- Detected Meta: ${pageMeta || 'N/A'}

CONTENT TO AUDIT:
${textToAnalyze.substring(0, 18000)}

Deliver the response strictly in this structured JSON format so it can be rendered dynamically in the UI:
{
  "contentIdentity": {
    "pageType": "e.g. E-Commerce Collection / PLP / Informational Guide / SaaS Feature",
    "primaryIntent": "Commercial Investigation / Informational / Transactional",
    "targetAudience": "Description of target persona",
    "detectedKeyword": "Primary detected search query",
    "intentMatchStatus": "Aligned | Mismatch | Partial"
  },
  "competitivePositioning": {
    "summary": "Concise 2-3 sentence teardown of how this page stacks up against top-ranking rivals",
    "competitorStrengths": ["Competitor advantage 1", "Competitor advantage 2"],
    "ourVulnerabilities": ["Critical gap 1", "Critical gap 2"]
  },
  "scorecard": {
    "informationGain": { "score": 3, "max": 10, "label": "Information Gain & Originality", "status": "critical" },
    "semanticDepth": { "score": 4, "max": 10, "label": "Semantic Depth & Topical Completeness", "status": "warning" },
    "eeatSignals": { "score": 5, "max": 10, "label": "E-E-A-T Signals & Authority", "status": "warning" },
    "structureReadability": { "score": 6, "max": 10, "label": "Structure, Readability & Time-to-Value", "status": "good" },
    "technicalOnPage": { "score": 7, "max": 10, "label": "Technical On-Page SEO & Schema", "status": "good" },
    "conversionIntent": { "score": 5, "max": 10, "label": "Conversion & Commercial Intent", "status": "warning" },
    "totalScore": 30,
    "maxTotal": 70
  },
  "detailedFindings": [
    {
      "dimension": "1. Information Gain & Originality",
      "score": "3/10",
      "whatWorks": "Positive elements found",
      "problems": "Specific problems with missing first-hand proof or copycat text",
      "recommendations": "Exact proprietary data or uncopyable insights to inject"
    },
    {
      "dimension": "2. Semantic Depth & Topical Completeness",
      "score": "4/10",
      "whatWorks": "Covered topics",
      "problems": "Missing entities, attributes, and sub-topics",
      "recommendations": "Add dedicated entity sections, attribute matrices, and comparison tables"
    },
    {
      "dimension": "3. E-E-A-T Signals",
      "score": "5/10",
      "whatWorks": "Existing trust signals",
      "problems": "Unverified author, missing citations, lack of testing methodology",
      "recommendations": "Add author schema, named expert byline, real testing credentials"
    },
    {
      "dimension": "4. Structure, Readability & Time-to-Value",
      "score": "6/10",
      "whatWorks": "Hierarchy strengths",
      "problems": "Wall-of-text fatigue, burying the lead",
      "recommendations": "Add key takeaway callouts and TL;DR snippet at the top"
    },
    {
      "dimension": "5. Technical On-Page SEO",
      "score": "7/10",
      "whatWorks": "Heading tags and crawlability",
      "problems": "Metadata length, missing FAQPage or Product schema",
      "recommendations": "Fix canonical, update meta title, inject structured JSON-LD"
    },
    {
      "dimension": "6. Conversion & Business Intent",
      "score": "5/10",
      "whatWorks": "CTA positioning",
      "problems": "Friction in next step, vague value propositions",
      "recommendations": "Strengthen social proof near conversion triggers"
    }
  ],
  "topQuickWins": [
    { "rank": 1, "title": "Quick win 1", "impact": "High", "effort": "Low", "description": "Actionable instructions" },
    { "rank": 2, "title": "Quick win 2", "impact": "High", "effort": "Medium", "description": "Actionable instructions" },
    { "rank": 3, "title": "Quick win 3", "impact": "Medium", "effort": "Low", "description": "Actionable instructions" },
    { "rank": 4, "title": "Quick win 4", "impact": "Medium", "effort": "Low", "description": "Actionable instructions" },
    { "rank": 5, "title": "Quick win 5", "impact": "High", "effort": "Medium", "description": "Actionable instructions" }
  ],
  "rewrittenElements": {
    "titleTag": {
      "original": "${pageTitle || 'N/A'}",
      "optimized": "Punchy rewritten title under 60 chars including primary keyword & hook",
      "charCount": 54
    },
    "metaDescription": {
      "original": "${pageMeta || 'N/A'}",
      "optimized": "Compelling CTR-boosting meta description between 145-160 characters",
      "charCount": 154
    },
    "openingHook": "Rewritten opening 2 paragraphs providing instant answer / hook to stop pogo-sticking",
    "suggestedSchema": "JSON-LD schema type recommendation"
  }
}
Respond with raw JSON only. Do not wrap in backticks or markdown if possible, or output clean JSON.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  try {
    return JSON.parse(rawText);
  } catch (err) {
    // If JSON parsing failed, clean potential markdown wrappers
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// 2. EEAT AUDIT
export async function runEeatAudit(params: {
  url?: string;
  content?: string;
  author?: string;
  domain?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  let textToAnalyze = params.content || "";
  if (params.url && (!textToAnalyze || textToAnalyze.length < 50)) {
    const scraped = await fetchPageContent(params.url);
    textToAnalyze = scraped.content;
  }

  const prompt = `
You are an expert Google Search Quality Rater specializing in E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) forensic audits.
Audit this page against Google's latest Search Quality Evaluator Guidelines.

${ANTI_AI_SLOP_DIRECTIVE}

PAGE DETAILS:
- Domain: ${params.domain || params.url || 'Website'}
- Declared Author: ${params.author || 'None declared / Anonymous'}
- Content sample: ${textToAnalyze.substring(0, 16000)}

Output raw JSON strictly in this format:
{
  "overallVerdict": "High | Medium | Low | Critical Risk",
  "totalScore": 24,
  "maxScore": 40,
  "dimensions": {
    "experience": {
      "score": 6,
      "max": 10,
      "status": "warning",
      "findings": "Assessment of first-hand usage, original photos, real-world case evidence",
      "fixes": ["Specific experience signals to add"]
    },
    "expertise": {
      "score": 6,
      "max": 10,
      "status": "warning",
      "findings": "Assessment of credentialed subject matter knowledge and technical accuracy",
      "fixes": ["Specific expertise credentials to add"]
    },
    "authoritativeness": {
      "score": 5,
      "max": 10,
      "status": "critical",
      "findings": "Assessment of brand reputation, citations by peer sites, industry standing",
      "fixes": ["How to establish authority on this topic"]
    },
    "trustworthiness": {
      "score": 7,
      "max": 10,
      "status": "good",
      "findings": "Assessment of transparency, editorial policies, contact info, claims verification",
      "fixes": ["Trust anchors to implement"]
    }
  },
  "authorAudit": {
    "isDeclared": true,
    "authorName": "${params.author || 'Not declared'}",
    "credibilityGrade": "C+",
    "missingSignals": ["No link to LinkedIn", "No verified bio schema", "No first-party quote"],
    "rewrittenBio": "Professional, authoritative 3-sentence author bio ready to paste"
  },
  "fastWins": [
    "Add author JSON-LD schema with sameAs links",
    "Include editorial review disclaimer with date",
    "Embed 2 first-hand testing data points or screenshots"
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 3. SEMANTIC GAP ANALYSIS
export async function runSemanticGapAnalysis(params: {
  keyword: string;
  content?: string;
  url?: string;
  competitors?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  let textToAnalyze = params.content || "";
  if (params.url && (!textToAnalyze || textToAnalyze.length < 50)) {
    const scraped = await fetchPageContent(params.url);
    textToAnalyze = scraped.content;
  }

  const prompt = `
Perform a high-level Semantic Gap & Entity Relationship Analysis comparing this page against Top 3 SERP winners for the keyword: "${params.keyword}".

${ANTI_AI_SLOP_DIRECTIVE}

COMPETITOR LANDSCAPE: ${params.competitors || 'Top ranking pages on Google for this query'}
OUR CONTENT SAMPLE:
${textToAnalyze.substring(0, 16000)}

Output raw JSON strictly in this structure:
{
  "targetKeyword": "${params.keyword}",
  "topCompetitorEntities": ["Entity 1", "Entity 2", "Entity 3", "Entity 4"],
  "entityRelationships": [
    {
      "entity": "Primary Entity",
      "attribute": "Key Attribute (e.g. Dimensions, Pricing, API, Materials)",
      "competitorValue": "What top ranking sites include",
      "ourStatus": "Missing | Superficial | Complete",
      "recommendedAction": "Exact specification to add to your page"
    },
    {
      "entity": "Secondary Entity",
      "attribute": "Attribute name",
      "competitorValue": "Value detail",
      "ourStatus": "Missing",
      "recommendedAction": "Actionable addition"
    },
    {
      "entity": "Tertiary Entity",
      "attribute": "Attribute name",
      "competitorValue": "Value detail",
      "ourStatus": "Superficial",
      "recommendedAction": "Actionable addition"
    }
  ],
  "missingSubtopics": [
    {
      "subtopic": "Name of missing topic",
      "searchIntent": "Why users search for this",
      "placementRecommendation": "Suggested H2 or FAQ block"
    }
  ],
  "uniqueAngleToPreserve": "Key distinct voice or brand angle in current content that should NOT be diluted",
  "contentAdditionPlan": [
    {
      "sectionHeading": "Proposed H2/H3 Heading",
      "draftParagraph": "Ready-to-paste paragraph packed with missing entities and zero AI slop"
    }
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 4. KEYWORD DEEP DIVE
export async function runKeywordDeepDive(params: {
  keyword: string;
  country?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Execute a deep-dive SERP & Intent Analysis for the keyword: "${params.keyword}".
Country/Region: ${params.country || 'Global / India'}

${ANTI_AI_SLOP_DIRECTIVE}

Output raw JSON strictly in this structure:
{
  "keyword": "${params.keyword}",
  "searchIntent": {
    "primary": "Commercial Investigation | Informational | Transactional | Navigational",
    "intentExplanation": "Clear explanation of user psychology when typing this query",
    "serpFeaturesPresent": ["Featured Snippet", "People Also Ask", "Discussions & Forums", "Product Carousel"]
  },
  "difficultyAndTimeline": {
    "difficultyScore": 68,
    "difficultyRating": "Moderate-Hard",
    "estimatedRankingTimeline": "90-120 days with 1 pillar article + 3 high-authority backlinks",
    "requiredContentDepth": "2,200+ words with proprietary benchmark data"
  },
  "serpWinnerPatterns": [
    "Top 3 pages all feature a quick comparison table within the first 300 words",
    "All ranking pages have first-party testing methodology explicitly listed",
    "Zero generic definitions—they jump straight to solutions"
  ],
  "secondaryVariations": [
    { "keyword": "${params.keyword} review", "intent": "Commercial", "volumeTier": "High", "opportunity": "High" },
    { "keyword": "best ${params.keyword} 2025", "intent": "Commercial", "volumeTier": "High", "opportunity": "High" },
    { "keyword": "how to choose ${params.keyword}", "intent": "Informational", "volumeTier": "Medium", "opportunity": "Very High" },
    { "keyword": "${params.keyword} vs competitor", "intent": "Commercial", "volumeTier": "Medium", "opportunity": "High" },
    { "keyword": "${params.keyword} price breakdown", "intent": "Transactional", "volumeTier": "Medium", "opportunity": "High" }
  ],
  "contentFormatRecommendations": {
    "recommendedType": "Comprehensive Buyer's Guide with Interactive Decision Matrix",
    "mustHaveModules": ["Summary comparison table", "Price transparency breakdown", "Video/Image proof", "FAQ Schema"]
  }
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 5. CONTENT BRIEF
export async function runContentBrief(params: {
  keyword: string;
  audience?: string;
  tone?: string;
  wordCount?: number;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Create an editorial-grade, production-ready SEO Content Brief for the keyword: "${params.keyword}".
Audience: ${params.audience || 'B2B & Savvy Consumers'}
Tone: ${params.tone || 'Authoritative, clear, pragmatic'}
Target Word Count: ${params.wordCount || 2400}

${ANTI_AI_SLOP_DIRECTIVE}

Output raw JSON strictly in this structure:
{
  "targetKeyword": "${params.keyword}",
  "secondaryKeywords": ["Keyword 1", "Keyword 2", "Keyword 3", "Keyword 4", "Keyword 5"],
  "targetWordCount": "${params.wordCount || 2400} words",
  "searcherPersona": "Detailed profile of the reader, their pain points, and why they clicked",
  "toneAndVoice": "Tone instructions forbidding corporate buzzwords",
  "spokeList": [
    { "anchorText": "Anchor 1", "targetTopic": "Topic for internal link", "funnelStage": "ToFU" },
    { "anchorText": "Anchor 2", "targetTopic": "Topic for internal link", "funnelStage": "MoFU" },
    { "anchorText": "Anchor 3", "targetTopic": "Topic for internal link", "funnelStage": "BoFU" }
  ],
  "outline": [
    {
      "heading": "H1: Compelling Title incorporating '${params.keyword}'",
      "intent": "Hook the reader and establish immediate authority",
      "requiredElements": ["Zero fluff opening", "Core takeaway callout box"]
    },
    {
      "heading": "H2: Executive Summary & Direct Answer (Snippet Bait)",
      "intent": "Capture Google Position 0 snippet with 45-word direct answer",
      "requiredElements": ["45-word structured answer", "Quick reference bullet list"]
    },
    {
      "heading": "H2: In-Depth Evaluation Framework",
      "intent": "Establish unique evaluation criteria",
      "subheadings": [
        "H3: Factor 1: Real-World Testing & Benchmarks",
        "H3: Factor 2: Cost-to-Value & Hidden Expenses",
        "H3: Factor 3: Durability & Long-Term Reliability"
      ],
      "requiredElements": ["Comparison table with 5 attributes", "First-hand evaluation notes"]
    },
    {
      "heading": "H2: Common Pitfalls & What Competitors Get Wrong",
      "intent": "Provide high information gain unavailable on generic affiliate blogs",
      "requiredElements": ["Contrarian insights", "Specific real-world failure modes"]
    },
    {
      "heading": "H2: Frequently Asked Questions (Schema Optimized)",
      "intent": "Capture Long-tail PAA queries",
      "requiredElements": ["3 specific questions with concise 30-word answers"]
    }
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 6. TOPIC CLUSTER PLANNING
export async function runTopicClusterPlanning(params: {
  topic: string;
  domain?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Architect a Topic Cluster & Topical Authority Roadmap for the pillar theme: "${params.topic}".
Brand / Domain: ${params.domain || 'Niche Authority Portal'}

${ANTI_AI_SLOP_DIRECTIVE}

Output raw JSON strictly in this structure:
{
  "pillarTheme": "${params.topic}",
  "hubPage": {
    "title": "Comprehensive Pillar Page Title",
    "primaryKeyword": "Pillar core keyword",
    "targetWordCount": "3,500 words",
    "corePurpose": "Ultimate comprehensive reference guide that links out to all spokes"
  },
  "spokeArticles": [
    {
      "id": "spoke-1",
      "title": "Spoke 1 Title",
      "targetKeyword": "Specific long-tail keyword",
      "funnelStage": "ToFU (Top of Funnel)",
      "searchIntent": "Informational",
      "internalLinkAnchorToHub": "Exact recommended anchor text pointing to Pillar",
      "internalLinkAnchorFromHub": "Exact anchor text used on Pillar pointing to this spoke"
    },
    {
      "id": "spoke-2",
      "title": "Spoke 2 Title",
      "targetKeyword": "Specific commercial keyword",
      "funnelStage": "MoFU (Middle of Funnel)",
      "searchIntent": "Commercial Investigation",
      "internalLinkAnchorToHub": "Exact anchor text",
      "internalLinkAnchorFromHub": "Exact anchor text"
    },
    {
      "id": "spoke-3",
      "title": "Spoke 3 Title",
      "targetKeyword": "Specific buyer keyword",
      "funnelStage": "BoFU (Bottom of Funnel)",
      "searchIntent": "Transactional",
      "internalLinkAnchorToHub": "Exact anchor text",
      "internalLinkAnchorFromHub": "Exact anchor text"
    },
    {
      "id": "spoke-4",
      "title": "Spoke 4 Title",
      "targetKeyword": "Comparison keyword",
      "funnelStage": "MoFU",
      "searchIntent": "Commercial",
      "internalLinkAnchorToHub": "Exact anchor text",
      "internalLinkAnchorFromHub": "Exact anchor text"
    },
    {
      "id": "spoke-5",
      "title": "Spoke 5 Title",
      "targetKeyword": "Troubleshooting keyword",
      "funnelStage": "ToFU",
      "searchIntent": "Informational",
      "internalLinkAnchorToHub": "Exact anchor text",
      "internalLinkAnchorFromHub": "Exact anchor text"
    }
  ],
  "linkingStrategy": {
    "hubToSpokeRule": "Every spoke must be linked from its respective thematic H2 sub-section on the hub page with descriptive keyword anchors.",
    "spokeToHubRule": "Every spoke must link back to the hub within the first 150 words using the primary pillar keyword variation.",
    "lateralSpokeRule": "Spokes within the same funnel stage should cross-link laterally to create tight sub-semantic topical authority clusters."
  }
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 7. WRITE CONTENT (Strict Anti-AI Slop Article Writer)
export async function runWriteContent(params: {
  topic: string;
  keywords?: string;
  outline?: string;
  wordCount?: number;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Write a complete, highly authoritative, human-crafted SEO article on: "${params.topic}".
Target Keywords to naturally integrate: ${params.keywords || params.topic}
Target Word Count: ${params.wordCount || 1500} words.
Optional Outline notes: ${params.outline || 'Follow best-in-class structure with clear headings, quick summary, and practical examples.'}

${ANTI_AI_SLOP_DIRECTIVE}

ADDITIONAL WRITING MANDATES:
1. Write in active voice. Use specific examples, real-world case scenarios, and crisp numbers.
2. Structure with clean Markdown (H1, H2, H3, bullet points, and at least one Markdown comparison table).
3. Do NOT include a generic meta-intro like "In this article, we will examine...". Start straight into the core narrative hook!

Output raw JSON strictly in this structure:
{
  "title": "Compelling Article Title",
  "readingTimeMinutes": 6,
  "wordCount": 1450,
  "markdownContent": "# Full article in clean markdown with H2, H3, tables, and bullet takeaways...",
  "keyTakeaways": ["Key Takeaway 1", "Key Takeaway 2", "Key Takeaway 3"],
  "schemaRecommendation": "FAQPage or Article Schema description"
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 8. IMPROVE CONTENT (Decay & Refresh)
export async function runImproveContent(params: {
  content: string;
  url?: string;
  keyword?: string;
  previousRank?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Diagnose content decay and execute a full refresh plan for this article.
Target Keyword: ${params.keyword || 'Auto-detect'}
Previous Rank: ${params.previousRank || 'Ranked in top 5, recently dropped'}
Content to Refresh:
${params.content.substring(0, 16000)}

${ANTI_AI_SLOP_DIRECTIVE}

Output raw JSON strictly in this structure:
{
  "decayDiagnosis": {
    "primaryCause": "Outdated data points and competitors publishing more complete comparison tables",
    "searchIntentShift": "How search intent evolved since this page was first published",
    "timeToValueScore": "Fair (buried the lead)"
  },
  "sectionsToCut": ["Vague introductory filler paragraphs", "Outdated 2021-2022 references"],
  "sectionsToExpand": ["Add updated 2025/2026 pricing benchmarks", "Insert step-by-step decision framework"],
  "rewrittenHeroHook": "Fresh opening hook designed to immediately address the user's intent and stop bounce rates",
  "newInformationGainModule": "Ready-to-paste markdown section introducing unique data, proprietary benchmark, or fresh workflow",
  "refreshChecklist": [
    "Update all date mentions to current year",
    "Re-verify outbound links and remove 404s",
    "Add 2 high-contrast image or diagram placeholders with descriptive alt text",
    "Update Title tag to include current year and dynamic CTR hook"
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 9. FEATURED SNIPPET OPTIMIZER
export async function runFeaturedSnippetOptimizer(params: {
  keyword: string;
  existingText?: string;
  snippetType?: 'paragraph' | 'table' | 'list';
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Re-engineer content to capture Google Position 0 (Featured Snippet) for query: "${params.keyword}".
Desired Snippet Type: ${params.snippetType || 'paragraph'}
Existing Content Context:
${(params.existingText || '').substring(0, 8000)}

${ANTI_AI_SLOP_DIRECTIVE}

Output raw JSON strictly in this structure:
{
  "targetKeyword": "${params.keyword}",
  "triggerHeading": "Exact H2 wording formatted as an NLP trigger question (e.g. 'What is [X]?' or 'How to [Do X]')",
  "optimizedSnippetAnswer": {
    "text": "Exact 42-55 word direct definition or answer paragraph crafted precisely for Google's snippet extraction algorithm",
    "wordCount": 48
  },
  "tableSnippetAlternative": {
    "caption": "Comparison of Key Attributes",
    "headers": ["Option / Entity", "Primary Benefit", "Best For", "Estimated Cost"],
    "rows": [
      ["Option A", "Benefit description", "Specific audience", "$XX/mo"],
      ["Option B", "Benefit description", "Specific audience", "$YY/mo"],
      ["Option C", "Benefit description", "Specific audience", "$ZZ/mo"]
    ]
  },
  "orderedListAlternative": [
    "Step 1: Specific, action-first instruction",
    "Step 2: Specific, action-first instruction",
    "Step 3: Specific, action-first instruction",
    "Step 4: Specific, action-first instruction",
    "Step 5: Specific, action-first instruction"
  ],
  "placementInstructions": "Place this block directly under the H1 or within the first 15% of the article body."
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 10. LINK BUILDING & OUTREACH
export async function runLinkbuilding(params: {
  url?: string;
  topic: string;
  niche?: string;
  competitors?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Create a link-acquisition strategy for: "${params.topic}".
URL: ${params.url || 'Brand asset'}
Niche: ${params.niche || 'Industry'}
Competitors: ${params.competitors || 'Top market rivals'}

${ANTI_AI_SLOP_DIRECTIVE}

Output raw JSON strictly in this structure:
{
  "authorityPhase": "Foundation (0-20 DR) | Growth (21-50 DR) | Dominance (51+ DR)",
  "authorityStrategySummary": "Direct summary of link velocity and target tiering for this stage",
  "skyscraperPlaybook": {
    "competitorAssetType": "What rivals are getting links for (e.g. outdated 2022 survey)",
    "ourSuperiorAngle": "Why our asset is 5x more complete and cite-worthy",
    "hook": "Proprietary research or interactive calculator"
  },
  "digitalPrAngles": [
    {
      "headlineHook": "Data-backed headline journalists will open",
      "targetJournalistType": "Tech/Finance/Industry beat reporters",
      "dataPitchAngle": "Key statistic or benchmark trend"
    },
    {
      "headlineHook": "Contrarian industry finding",
      "targetJournalistType": "Editorial columnists and newsletter curators",
      "dataPitchAngle": "Surprising percentage shift"
    }
  ],
  "outreachEmailTemplate": {
    "subject": "Quick thought on your piece on [Topic] (fresh data)",
    "body": "Hi [Name],\n\nLoved your recent breakdown of [Specific Article]. Notice you cited [Old Source] for [Stat].\n\nWe just wrapped an audit of [Niche] analyzing [Sample Size] and uncovered [Surprising Finding].\n\nThought this might be helpful context for your readers: [Link to Asset]. Either way, keep up the great writing!\n\nBest,\n[Your Name]"
  }
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// 11. EXPERT INTERVIEW EXTRACTOR
export async function runExpertInterview(params: {
  topic: string;
  expertRole?: string;
  intendedAngle?: string;
}): Promise<any> {
  const ai = getAI();
  if (!ai) throw new Error("GEMINI_API_KEY is required.");

  const prompt = `
Formulate an Expert Interview Questionnaire to extract first-party, non-Googleable insights on: "${params.topic}".
Expert Persona/Role: ${params.expertRole || 'VP / Senior Director in the Field'}
Intended Article Angle: ${params.intendedAngle || 'In-depth benchmark and real-world implementation guide'}

${ANTI_AI_SLOP_DIRECTIVE}

Output raw JSON strictly in this structure:
{
  "interviewObjective": "Harvest unique data, contrarian opinions, and specific operational numbers to inject E-E-A-T into the article.",
  "questions": [
    {
      "id": 1,
      "question": "Deep question uncovering specific numbers or unstated challenges",
      "whyItWorks": "Why standard AI or junior writers cannot fake this answer",
      "expectedInsight": "What specific operational reality this exposes"
    },
    {
      "id": 2,
      "question": "Question challenging common industry dogma",
      "whyItWorks": "Elicits contrarian viewpoint",
      "expectedInsight": "Fresh quote material"
    },
    {
      "id": 3,
      "question": "Question about failure modes and lessons learned",
      "whyItWorks": "Real-world credibility",
      "expectedInsight": "Case scenario"
    },
    {
      "id": 4,
      "question": "Specific metrics / ROI / budget allocation question",
      "whyItWorks": "Hard numbers for Information Gain",
      "expectedInsight": "Benchmark data"
    },
    {
      "id": 5,
      "question": "Future outlook / 12-month prediction question",
      "whyItWorks": "Forward-looking authority",
      "expectedInsight": "Visionary quote"
    }
  ],
  "quoteIntegrationTemplate": {
    "formatExample": "As [Expert Name], [Title] at [Company], notes: \\\"[Quote highlighting contrarian insight]\\\". This underscores why...",
    "placementAdvice": "Position expert quotes immediately after data claims to reinforce trustworthiness."
  }
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const rawText = response.text || "{}";
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}
