export type SeoSkillId = 
  | 'page-audit'
  | 'eeat-audit'
  | 'semantic-gap'
  | 'keyword-deep-dive'
  | 'content-brief'
  | 'topic-cluster'
  | 'write-content'
  | 'improve-content'
  | 'featured-snippet'
  | 'linkbuilding'
  | 'expert-interview';

export interface SeoSkillMetadata {
  id: SeoSkillId;
  command: string;
  name: string;
  shortDesc: string;
  fullDesc: string;
  category: 'Audit & Analysis' | 'Content & Copy' | 'Strategy & Authority';
  icon: string;
  badgeColor: string;
  exampleData: {
    url?: string;
    keyword?: string;
    competitors?: string;
    content?: string;
    topic?: string;
    author?: string;
    niche?: string;
  };
}

export interface PageAuditScoreDimension {
  score: number;
  max: number;
  label: string;
  status: 'critical' | 'warning' | 'good';
}

export interface PageAuditResult {
  contentIdentity: {
    pageType: string;
    primaryIntent: string;
    targetAudience: string;
    detectedKeyword: string;
    intentMatchStatus: string;
  };
  competitivePositioning: {
    summary: string;
    competitorStrengths: string[];
    ourVulnerabilities: string[];
  };
  scorecard: {
    informationGain: PageAuditScoreDimension;
    semanticDepth: PageAuditScoreDimension;
    eeatSignals: PageAuditScoreDimension;
    structureReadability: PageAuditScoreDimension;
    technicalOnPage: PageAuditScoreDimension;
    conversionIntent: PageAuditScoreDimension;
    totalScore: number;
    maxTotal: number;
  };
  detailedFindings: Array<{
    dimension: string;
    score: string;
    whatWorks: string;
    problems: string;
    recommendations: string;
  }>;
  topQuickWins: Array<{
    rank: number;
    title: string;
    impact: 'High' | 'Medium' | 'Low';
    effort: 'Low' | 'Medium' | 'High';
    description: string;
  }>;
  rewrittenElements: {
    titleTag: {
      original: string;
      optimized: string;
      charCount: number;
    };
    metaDescription: {
      original: string;
      optimized: string;
      charCount: number;
    };
    openingHook: string;
    suggestedSchema: string;
  };
}

export interface EeatAuditResult {
  overallVerdict: string;
  totalScore: number;
  maxScore: number;
  dimensions: {
    experience: { score: number; max: number; status: string; findings: string; fixes: string[] };
    expertise: { score: number; max: number; status: string; findings: string; fixes: string[] };
    authoritativeness: { score: number; max: number; status: string; findings: string; fixes: string[] };
    trustworthiness: { score: number; max: number; status: string; findings: string; fixes: string[] };
  };
  authorAudit: {
    isDeclared: boolean;
    authorName: string;
    credibilityGrade: string;
    missingSignals: string[];
    rewrittenBio: string;
  };
  fastWins: string[];
}

export interface SemanticGapResult {
  targetKeyword: string;
  topCompetitorEntities: string[];
  entityRelationships: Array<{
    entity: string;
    attribute: string;
    competitorValue: string;
    ourStatus: 'Missing' | 'Superficial' | 'Complete';
    recommendedAction: string;
  }>;
  missingSubtopics: Array<{
    subtopic: string;
    searchIntent: string;
    placementRecommendation: string;
  }>;
  uniqueAngleToPreserve: string;
  contentAdditionPlan: Array<{
    sectionHeading: string;
    draftParagraph: string;
  }>;
}

export interface KeywordDeepDiveResult {
  keyword: string;
  searchIntent: {
    primary: string;
    intentExplanation: string;
    serpFeaturesPresent: string[];
  };
  difficultyAndTimeline: {
    difficultyScore: number;
    difficultyRating: string;
    estimatedRankingTimeline: string;
    requiredContentDepth: string;
  };
  serpWinnerPatterns: string[];
  secondaryVariations: Array<{
    keyword: string;
    intent: string;
    volumeTier: string;
    opportunity: string;
  }>;
  contentFormatRecommendations: {
    recommendedType: string;
    mustHaveModules: string[];
  };
}

export interface ContentBriefResult {
  targetKeyword: string;
  secondaryKeywords: string[];
  targetWordCount: string;
  searcherPersona: string;
  toneAndVoice: string;
  spokeList: Array<{
    anchorText: string;
    targetTopic: string;
    funnelStage: string;
  }>;
  outline: Array<{
    heading: string;
    intent: string;
    subheadings?: string[];
    requiredElements: string[];
  }>;
}

export interface TopicClusterResult {
  pillarTheme: string;
  hubPage: {
    title: string;
    primaryKeyword: string;
    targetWordCount: string;
    corePurpose: string;
  };
  spokeArticles: Array<{
    id: string;
    title: string;
    targetKeyword: string;
    funnelStage: string;
    searchIntent: string;
    internalLinkAnchorToHub: string;
    internalLinkAnchorFromHub: string;
  }>;
  linkingStrategy: {
    hubToSpokeRule: string;
    spokeToHubRule: string;
    lateralSpokeRule: string;
  };
}

export interface WriteContentResult {
  title: string;
  readingTimeMinutes: number;
  wordCount: number;
  markdownContent: string;
  keyTakeaways: string[];
  schemaRecommendation: string;
}

export interface ImproveContentResult {
  decayDiagnosis: {
    primaryCause: string;
    searchIntentShift: string;
    timeToValueScore: string;
  };
  sectionsToCut: string[];
  sectionsToExpand: string[];
  rewrittenHeroHook: string;
  newInformationGainModule: string;
  refreshChecklist: string[];
}

export interface FeaturedSnippetResult {
  targetKeyword: string;
  triggerHeading: string;
  optimizedSnippetAnswer: {
    text: string;
    wordCount: number;
  };
  tableSnippetAlternative?: {
    caption: string;
    headers: string[];
    rows: string[][];
  };
  orderedListAlternative?: string[];
  placementInstructions: string;
}

export interface LinkbuildingResult {
  authorityPhase: string;
  authorityStrategySummary: string;
  skyscraperPlaybook: {
    competitorAssetType: string;
    ourSuperiorAngle: string;
    hook: string;
  };
  digitalPrAngles: Array<{
    headlineHook: string;
    targetJournalistType: string;
    dataPitchAngle: string;
  }>;
  outreachEmailTemplate: {
    subject: string;
    body: string;
  };
}

export interface ExpertInterviewResult {
  interviewObjective: string;
  questions: Array<{
    id: number;
    question: string;
    whyItWorks: string;
    expectedInsight: string;
  }>;
  quoteIntegrationTemplate: {
    formatExample: string;
    placementAdvice: string;
  };
}
