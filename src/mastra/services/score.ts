import type { Mastra } from "@mastra/core";
import {
  asoReportSchema,
  modelAuditSchema,
  type AppExtras,
  type AppMetadata,
  type AsoReport,
  type Competitor,
  type DimensionScore,
  type ModelAudit,
  type Recommendation,
  type ReviewSummary,
  type VisualAnalysis,
} from "../schema";
import { DIMENSIONS, computeOverallScore, dimensionRubricText } from "../skills/aso-audit-skill";

export interface AuditInputs {
  metadata: AppMetadata;
  extras: AppExtras;
  reviews: ReviewSummary;
  competitors: Competitor[];
  visuals: VisualAnalysis;
}

function clip(text: string | undefined | null, max: number): string {
  if (!text) return "(none)";
  const clean = text.replace(/\r/g, "").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

const JSON_SHAPE = `
Return ONLY a JSON object - no markdown, no code fences, no prose before or after.
Shape:
{
  "dimensions": [ { "key": "<dimension key>", "score": <0-10 number>, "evidence": "<actual data point>", "notes": "<what would improve it>" } ],
  "quickWins":  [ { "title": "<imperative>", "detail": "<specific, cites evidence>", "before": "<optional current text>", "after": "<optional proposed text>" } ],
  "highImpact": [ { "title": "...", "detail": "...", "before": "...", "after": "..." } ],
  "strategic":  [ { "title": "...", "detail": "..." } ],
  "competitorComparison": [ { "name": "<app>", "rating": "<e.g. 4.8>", "ratingCount": "<e.g. 40M>", "note": "<short>" } ],
  "summary": "<2-3 sentence executive summary>"
}
Include ALL 10 dimensions using EXACTLY these keys:
title, subtitle, keywordField, description, screenshots, appPreviewVideo, ratingsReviews, icon, conversionSignals, competitivePosition.
For competitorComparison, list the audited app FIRST, then up to 3 competitors.`;

/** Turn everything we gathered into a single, evidence-rich prompt for the model. */
export function buildAuditPrompt(input: AuditInputs): { prompt: string; dataNotes: string[] } {
  const { metadata: m, extras, reviews, competitors, visuals } = input;
  const dataNotes: string[] = [];

  // Only surface notes for data that is genuinely missing - not for expected
  // ASO findings (e.g. an app simply having no subtitle/promo text/video) and
  // not for the keyword field (never public by design; the model infers it and
  // says so, per the rubric).
  if (extras.source === "unavailable") {
    dataNotes.push("The App Store web page couldn't be fetched, so subtitle, promotional text and preview-video status are unavailable.");
  }
  if (!visuals.available) {
    dataNotes.push("Vision analysis was unavailable - Screenshots & Icon were scored from metadata heuristics only.");
  }
  if (!reviews.available) dataNotes.push("The recent-reviews feed was unavailable.");
  if (competitors.length === 0) dataNotes.push("No competitor data was retrieved for this category.");

  const lines: string[] = [];
  lines.push("# APP UNDER AUDIT");
  lines.push(`Name (Title): "${m.name}"  [${m.name.length} chars, limit 30]`);
  lines.push(`Subtitle: ${extras.subtitle ? `"${extras.subtitle}" [${extras.subtitle.length} chars, limit 30]` : "NOT OBSERVED"}`);
  lines.push(`Developer: ${m.developer}`);
  lines.push(`Category: ${m.primaryGenre}${m.genres.length ? ` (genres: ${m.genres.join(", ")})` : ""}`);
  lines.push(`Storefront: ${m.country.toUpperCase()}   Price: ${m.formattedPrice ?? (m.price === 0 ? "Free" : m.price ?? "?")}   Content rating: ${m.contentRating ?? "?"}`);
  lines.push(`Version: ${m.version ?? "?"} (updated ${m.currentVersionReleaseDate ?? "?"})`);
  lines.push("");
  lines.push("## Description");
  lines.push(clip(m.description, 1800));
  lines.push("");
  lines.push("## Promotional text");
  lines.push(clip(extras.promotionalText, 500));
  lines.push("");
  lines.push("## What's New (release notes)");
  lines.push(clip(m.releaseNotes, 700));
  lines.push("");
  lines.push("## Screenshots");
  lines.push(`Count: ${m.screenshotUrls.length} iPhone / ${m.ipadScreenshotUrls.length} iPad (10 slots available).`);
  lines.push(`Vision notes: ${clip(visuals.screenshotObservations, 1000)}`);
  lines.push("");
  lines.push("## Icon");
  lines.push(`URL: ${m.iconUrl || "(none)"}`);
  lines.push(`Vision notes: ${clip(visuals.iconObservations, 600)}`);
  lines.push("");
  lines.push("## App preview video");
  lines.push(
    extras.hasAppPreviewVideo == null
      ? "Presence unknown."
      : extras.hasAppPreviewVideo
        ? "A preview video appears to be present."
        : "No preview video detected.",
  );
  lines.push("");
  lines.push("## Ratings & reviews");
  lines.push(`Lifetime average: ${m.averageUserRating ?? "?"} from ${m.userRatingCount?.toLocaleString() ?? "?"} ratings.`);
  lines.push(`Recent sample (${reviews.sampleSize} reviews) average: ${reviews.averageOfRecent ?? "?"}.`);
  if (reviews.excerpts.length > 0) {
    lines.push("Recent review excerpts:");
    for (const e of reviews.excerpts) lines.push(`  [${e.rating}★] ${e.title}: ${e.text}`);
  }
  lines.push("");
  lines.push("## Top category competitors");
  if (competitors.length === 0) {
    lines.push("(none retrieved)");
  } else {
    for (const c of competitors) {
      lines.push(`- ${c.name} by ${c.developer} - ${c.averageUserRating ?? "?"}★ (${c.userRatingCount?.toLocaleString() ?? "?"} ratings)`);
    }
  }
  lines.push("");
  lines.push("# RUBRIC (score each 0-10)");
  lines.push(dimensionRubricText());
  lines.push("");
  lines.push("# KNOWN DATA LIMITATIONS (do not fabricate around these)");
  for (const n of dataNotes) lines.push(`- ${n}`);
  lines.push("");
  lines.push("# OUTPUT");
  lines.push(JSON_SHAPE);

  return { prompt: lines.join("\n"), dataNotes };
}

/** Pull a JSON object out of a model response (tolerates code fences / stray prose). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in the model response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const KEY_BY_NORM = new Map(DIMENSIONS.map((d) => [norm(d.key), d.key]));
// Also map normalized labels (e.g. "ratings & reviews") to canonical keys.
for (const d of DIMENSIONS) KEY_BY_NORM.set(norm(d.label), d.key);

function toRecommendation(r: ModelAudit["quickWins"][number]): Recommendation {
  return {
    title: r.title,
    detail: r.detail,
    ...(r.dimension ? { dimension: r.dimension } : {}),
    ...(r.before ? { before: r.before } : {}),
    ...(r.after ? { after: r.after } : {}),
  };
}

/** Map the lenient model output onto the strict report shape: canonical weights/
 *  labels, all 10 dimensions guaranteed, scores clamped, overall computed. */
function assembleReport(model: ModelAudit, input: AuditInputs, dataNotes: string[]): AsoReport {
  const byKey = new Map<string, (typeof model.dimensions)[number]>();
  for (const d of model.dimensions) {
    const canonical = KEY_BY_NORM.get(norm(d.key));
    if (canonical) byKey.set(canonical, d);
  }

  const dimensions: DimensionScore[] = DIMENSIONS.map((def) => {
    const m = byKey.get(def.key);
    const score = Math.max(0, Math.min(10, Math.round((m?.score ?? 5) * 10) / 10));
    return {
      key: def.key,
      label: def.label,
      weight: def.weight,
      score,
      evidence: m?.evidence || "Not assessed.",
      notes: m?.notes || "",
    };
  });

  const m = input.metadata;
  return asoReportSchema.parse({
    dimensions,
    overallScore: computeOverallScore(dimensions),
    quickWins: model.quickWins.map(toRecommendation),
    highImpact: model.highImpact.map(toRecommendation),
    strategic: model.strategic.map(toRecommendation),
    competitorComparison: model.competitorComparison.map((c) => ({
      name: c.name,
      rating: c.rating,
      ratingCount: c.ratingCount,
      note: c.note,
    })),
    summary: model.summary,
    app: {
      name: m.name,
      developer: m.developer,
      iconUrl: m.iconUrl,
      primaryGenre: m.primaryGenre,
      country: m.country,
      trackViewUrl: m.trackViewUrl,
    },
    dataNotes,
  } satisfies AsoReport);
}

/**
 * Run the LLM scoring via the scoring agent (plain generation + a controlled
 * lenient parse - no unbounded structured-output retry loop), then assemble the
 * strict report. One corrective retry if the first response isn't valid JSON.
 */
export async function scoreListing(mastra: Mastra, input: AuditInputs): Promise<AsoReport> {
  const { prompt, dataNotes } = buildAuditPrompt(input);
  const agent = mastra.getAgent("scoringAgent");

  const attempt = async (extra = ""): Promise<ModelAudit> => {
    const res = await agent.generate(extra ? `${prompt}\n\n${extra}` : prompt);
    return modelAuditSchema.parse(extractJson(res.text));
  };

  let model: ModelAudit;
  try {
    model = await attempt();
  } catch {
    // Single corrective retry: re-ask for strictly valid JSON only.
    model = await attempt("Your previous reply was not valid JSON. Reply with ONLY the JSON object, nothing else.");
  }

  return assembleReport(model, input, dataNotes);
}
