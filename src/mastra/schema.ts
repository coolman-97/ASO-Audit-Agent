import { z } from "zod";

/**
 * Shared Zod schemas. These are the single source of truth that flows from the
 * data-gathering services → the workflow → the LLM's structured output → the UI.
 */

// ── Surface metadata (shown in the "is this the app?" confirmation card) ──────

export const appMetadataSchema = z.object({
  appId: z.string(),
  country: z.string(),
  name: z.string(),
  developer: z.string(),
  iconUrl: z.string(),
  primaryGenre: z.string(),
  genres: z.array(z.string()),
  primaryGenreId: z.string().optional(),
  description: z.string(),
  releaseNotes: z.string().optional(),
  version: z.string().optional(),
  currentVersionReleaseDate: z.string().optional(),
  averageUserRating: z.number().optional(),
  userRatingCount: z.number().optional(),
  contentRating: z.string().optional(),
  price: z.number().optional(),
  formattedPrice: z.string().optional(),
  screenshotUrls: z.array(z.string()),
  ipadScreenshotUrls: z.array(z.string()),
  trackViewUrl: z.string(),
});
export type AppMetadata = z.infer<typeof appMetadataSchema>;

// ── Web-only extras (subtitle / promo text / video) — not in Apple's JSON API ─

export const appExtrasSchema = z.object({
  subtitle: z.string().nullable(),
  promotionalText: z.string().nullable(),
  hasAppPreviewVideo: z.boolean().nullable(),
  source: z.enum(["firecrawl", "html-parse", "unavailable"]),
});
export type AppExtras = z.infer<typeof appExtrasSchema>;

// ── Recent reviews summary (from the iTunes RSS feed) ─────────────────────────

export const reviewSummarySchema = z.object({
  sampleSize: z.number(),
  averageOfRecent: z.number().nullable(),
  praiseThemes: z.array(z.string()),
  complaintThemes: z.array(z.string()),
  excerpts: z.array(z.object({ rating: z.number(), title: z.string(), text: z.string() })),
  available: z.boolean(),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

// ── Competitors (from the iTunes Search API, same genre) ──────────────────────

export const competitorSchema = z.object({
  name: z.string(),
  developer: z.string(),
  averageUserRating: z.number().nullable(),
  userRatingCount: z.number().nullable(),
  subtitleOrTagline: z.string().nullable(),
});
export type Competitor = z.infer<typeof competitorSchema>;

// ── Visual analysis (vision model over screenshots + icon) ────────────────────

export const visualAnalysisSchema = z.object({
  available: z.boolean(),
  screenshotCount: z.number(),
  iconObservations: z.string().nullable(),
  screenshotObservations: z.string().nullable(),
});
export type VisualAnalysis = z.infer<typeof visualAnalysisSchema>;

// ── The audit report (LLM structured output → UI) ─────────────────────────────

export const DIMENSION_KEYS = [
  "title",
  "subtitle",
  "keywordField",
  "description",
  "screenshots",
  "appPreviewVideo",
  "ratingsReviews",
  "icon",
  "conversionSignals",
  "competitivePosition",
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const dimensionScoreSchema = z.object({
  key: z.enum(DIMENSION_KEYS),
  label: z.string(),
  weight: z.number().describe("Percentage weight of this dimension."),
  score: z.number().min(0).max(10).describe("0-10 score for this dimension."),
  evidence: z.string().describe("The concrete data point(s) this score is based on."),
  notes: z.string().describe("Brief reasoning / what would improve it."),
});
export type DimensionScore = z.infer<typeof dimensionScoreSchema>;

export const recommendationSchema = z.object({
  title: z.string().describe("Short imperative headline, e.g. 'Add a benefit-driven subtitle'."),
  detail: z.string().describe("Specific, actionable explanation citing the evidence."),
  dimension: z.enum(DIMENSION_KEYS).optional(),
  before: z.string().optional().describe("Current text, for text-based changes."),
  after: z.string().optional().describe("Proposed replacement text."),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

/** What the scoring agent is asked to produce (overallScore is computed in code). */
export const auditScoringSchema = z.object({
  dimensions: z.array(dimensionScoreSchema),
  quickWins: z.array(recommendationSchema).describe("3-5 high-impact changes doable today."),
  highImpact: z.array(recommendationSchema).describe("3-5 changes needing more effort."),
  strategic: z.array(recommendationSchema).describe("3-5 longer-term improvements."),
  competitorComparison: z
    .array(
      z.object({
        name: z.string(),
        rating: z.string(),
        ratingCount: z.string(),
        note: z.string(),
      }),
    )
    .describe("The audited app first, then up to 3 competitors."),
  summary: z.string().describe("2-3 sentence executive summary of the listing's ASO health."),
});
export type AuditScoring = z.infer<typeof auditScoringSchema>;

/** The full report handed to the UI: scoring + the app it describes + computed score. */
export const asoReportSchema = auditScoringSchema.extend({
  overallScore: z.number().describe("Weighted 0-100 overall ASO score."),
  app: z.object({
    name: z.string(),
    developer: z.string(),
    iconUrl: z.string(),
    primaryGenre: z.string(),
    country: z.string(),
    trackViewUrl: z.string(),
  }),
  dataNotes: z.array(z.string()).describe("Caveats about data that was unavailable/inferred."),
});
export type AsoReport = z.infer<typeof asoReportSchema>;
