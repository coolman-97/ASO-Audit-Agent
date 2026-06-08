import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  appExtrasSchema,
  appMetadataSchema,
  asoReportSchema,
  competitorSchema,
  reviewSummarySchema,
  visualAnalysisSchema,
} from "../schema";
import { lookupAppByUrl } from "../services/itunes";
import { fetchAppExtras } from "../services/extras";
import { fetchReviewSummary } from "../services/reviews";
import { findCompetitors } from "../services/competitors";
import { analyzeVisuals } from "../services/vision";
import { scoreListing } from "../services/score";

/** Emit a human-readable progress line. Best-effort - never blocks the audit. */
async function report(writer: { write: (d: unknown) => Promise<void> } | undefined, status: string) {
  try {
    await writer?.write({ type: "data-audit-progress", data: { status } });
  } catch {
    /* progress is best-effort */
  }
}

const fetchMetadataStep = createStep({
  id: "fetch-metadata",
  inputSchema: z.object({ url: z.string() }),
  outputSchema: appMetadataSchema,
  execute: async ({ inputData, writer }) => {
    await report(writer, "Looking up the App Store listing…");
    return lookupAppByUrl(inputData.url);
  },
});

const gatheredSchema = z.object({
  metadata: appMetadataSchema,
  extras: appExtrasSchema,
  reviews: reviewSummarySchema,
  competitors: z.array(competitorSchema),
  visuals: visualAnalysisSchema,
});

const gatherSignalsStep = createStep({
  id: "gather-signals",
  inputSchema: appMetadataSchema,
  outputSchema: gatheredSchema,
  execute: async ({ inputData: metadata, writer }) => {
    await report(writer, "Reading reviews, competitors, listing extras & screenshots…");
    const [extras, reviews, competitors, visuals] = await Promise.all([
      fetchAppExtras(metadata),
      fetchReviewSummary(metadata.appId, metadata.country),
      findCompetitors(metadata),
      analyzeVisuals(metadata),
    ]);
    await report(writer, "Gathered all signals. Scoring the listing…");
    return { metadata, extras, reviews, competitors, visuals };
  },
});

const scoreStep = createStep({
  id: "score-listing",
  inputSchema: gatheredSchema,
  outputSchema: asoReportSchema,
  execute: async ({ inputData, mastra, writer }) => {
    await report(writer, "Running the ASO scoring model…");
    const report_ = await scoreListing(mastra, inputData);
    await report(writer, "Audit complete.");
    return report_;
  },
});

/**
 * The deterministic audit pipeline: surface metadata → parallel signal
 * gathering → LLM scoring → typed AsoReport. Registered on the Mastra instance
 * so it's runnable from the chat tool and from Mastra Studio.
 */
export const auditWorkflow = createWorkflow({
  id: "asoAudit",
  inputSchema: z.object({ url: z.string() }),
  outputSchema: asoReportSchema,
})
  .then(fetchMetadataStep)
  .then(gatherSignalsStep)
  .then(scoreStep)
  .commit();
