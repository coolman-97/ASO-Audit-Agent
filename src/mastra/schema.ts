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

// ── Web-only extras (subtitle / promo text / video) - not in Apple's JSON API ─

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

// ── Final (strict) shapes rendered by the UI ─────────────────────────────────

export const dimensionScoreSchema = z.object({
  key: z.enum(DIMENSION_KEYS),
  label: z.string(),
  weight: z.number(),
  score: z.number().min(0).max(10),
  evidence: z.string(),
  notes: z.string(),
});
export type DimensionScore = z.infer<typeof dimensionScoreSchema>;

export const recommendationSchema = z.object({
  title: z.string(),
  detail: z.string(),
  dimension: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const competitorRowSchema = z.object({
  name: z.string(),
  rating: z.string(),
  ratingCount: z.string(),
  note: z.string(),
});

// ── Lenient model-output schema ──────────────────────────────────────────────
// We are liberal in what we accept from the LLM (it only needs to return a
// score + prose per dimension; weights/labels are attached in code) and strict
// in what we emit to the UI. This keeps scoring reliable across models that
// struggle with large strict JSON schemas.

const looseString = z.string().optional().default("");

export const modelRecommendationSchema = z.object({
  title: z.string(),
  detail: looseString,
  dimension: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const modelDimensionSchema = z.object({
  key: z.string(),
  score: z.coerce.number().default(5),
  evidence: looseString,
  notes: looseString,
});

export const modelAuditSchema = z.object({
  dimensions: z.array(modelDimensionSchema).default([]),
  quickWins: z.array(modelRecommendationSchema).default([]),
  highImpact: z.array(modelRecommendationSchema).default([]),
  strategic: z.array(modelRecommendationSchema).default([]),
  competitorComparison: z
    .array(
      z.object({
        name: looseString,
        rating: looseString,
        ratingCount: looseString,
        note: looseString,
      }),
    )
    .default([]),
  summary: looseString,
});
export type ModelAudit = z.infer<typeof modelAuditSchema>;

/** The full report handed to the UI: scoring + the app it describes + computed score. */
export const asoReportSchema = z.object({
  dimensions: z.array(dimensionScoreSchema),
  overallScore: z.number(),
  quickWins: z.array(recommendationSchema),
  highImpact: z.array(recommendationSchema),
  strategic: z.array(recommendationSchema),
  competitorComparison: z.array(competitorRowSchema),
  summary: z.string(),
  app: z.object({
    name: z.string(),
    developer: z.string(),
    iconUrl: z.string(),
    primaryGenre: z.string(),
    country: z.string(),
    trackViewUrl: z.string(),
  }),
  dataNotes: z.array(z.string()),
});
export type AsoReport = z.infer<typeof asoReportSchema>;
