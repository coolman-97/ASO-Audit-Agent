import type { Mastra } from "@mastra/core";
import {
  asoReportSchema,
  auditScoringSchema,
  type AppExtras,
  type AppMetadata,
  type AsoReport,
  type AuditScoring,
  type Competitor,
  type ReviewSummary,
  type VisualAnalysis,
} from "../schema";
import { computeOverallScore, dimensionRubricText } from "../skills/aso-audit-skill";

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

/** Turn everything we gathered into a single, evidence-rich prompt for the model. */
export function buildAuditPrompt(input: AuditInputs): { prompt: string; dataNotes: string[] } {
  const { metadata: m, extras, reviews, competitors, visuals } = input;
  const dataNotes: string[] = [];

  if (extras.source === "unavailable") {
    dataNotes.push("Subtitle, promotional text and preview-video status could not be retrieved (no Firecrawl key / page gated).");
  } else if (extras.source === "html-parse") {
    dataNotes.push("Subtitle/promo text from a best-effort HTML parse; may be incomplete. Set FIRECRAWL_API_KEY for reliable extraction.");
  }
  if (extras.subtitle == null) dataNotes.push("Subtitle was not observed — score the dimension from the title/positioning and recommend one.");
  dataNotes.push("The 100-char keyword field is never public; it is inferred, not read.");
  if (!visuals.available) dataNotes.push("Vision analysis was unavailable — Screenshots/Icon scored from metadata heuristics only.");
  if (!reviews.available) dataNotes.push("Recent reviews feed was unavailable.");
  if (competitors.length === 0) dataNotes.push("No competitor data was retrieved for the category.");

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
      lines.push(`- ${c.name} by ${c.developer} — ${c.averageUserRating ?? "?"}★ (${c.userRatingCount?.toLocaleString() ?? "?"} ratings)`);
    }
  }
  lines.push("");
  lines.push("# RUBRIC (score each 0-10, use these exact keys)");
  lines.push(dimensionRubricText());
  lines.push("");
  lines.push("# KNOWN DATA LIMITATIONS (do not fabricate around these)");
  for (const n of dataNotes) lines.push(`- ${n}`);
  lines.push("");
  lines.push(
    "Produce the full audit. For competitorComparison, list the audited app FIRST, then the competitors, " +
      "comparing rating, rating count, and a short note each.",
  );

  return { prompt: lines.join("\n"), dataNotes };
}

/**
 * Run the LLM scoring via a Mastra agent (which gives us a JSON fallback for
 * models with weak structured-output support), then assemble the final report.
 */
export async function scoreListing(mastra: Mastra, input: AuditInputs): Promise<AsoReport> {
  const { prompt, dataNotes } = buildAuditPrompt(input);
  const agent = mastra.getAgent("scoringAgent");

  const result = await agent.generate(prompt, {
    structuredOutput: { schema: auditScoringSchema },
  });

  const scoring = result.object as AuditScoring;
  const overallScore = computeOverallScore(
    scoring.dimensions.map((d) => ({ score: d.score, weight: d.weight })),
  );

  const m = input.metadata;
  return asoReportSchema.parse({
    ...scoring,
    overallScore,
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
