import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { asoReportSchema } from "../schema";

/** Friendly progress labels for each workflow step (lifecycle-event driven). */
const STEP_LABELS: Record<string, string> = {
  "fetch-metadata": "Looking up the App Store listing…",
  "gather-signals": "Reading reviews, competitors & screenshots…",
  "score-listing": "Scoring the listing with the ASO model…",
};

/** Tolerantly derive a human-readable status from a workflow stream event. */
function extractStatus(ev: unknown): string | null {
  if (!ev || typeof ev !== "object") return null;
  const e = ev as Record<string, any>;
  if (e.type === "data-audit-progress") return e.data?.status ?? null;
  if (e.payload?.output?.type === "data-audit-progress") return e.payload.output.data?.status ?? null;
  if (e.type === "workflow-step-start") {
    const id = e.payload?.id ?? e.id;
    return STEP_LABELS[id] ?? (id ? `Running ${id}…` : null);
  }
  return null;
}

/**
 * Step 3 of the flow: the full ASO audit. Runs the registered `asoAudit`
 * workflow, forwarding per-step progress to the chat so the user is kept
 * informed, and returns the typed report for the UI to render.
 *
 * The agent is instructed to call this ONLY after the user confirms the app.
 */
export const runAuditTool = createTool({
  id: "runAudit",
  description:
    "Run the full ASO audit for a confirmed Apple App Store URL and return the scored report. " +
    "ONLY call this AFTER the user has confirmed (e.g. replied 'yes') that the app from lookupApp " +
    "is the one they meant.",
  inputSchema: z.object({
    url: z.string().describe("The confirmed Apple App Store URL."),
  }),
  outputSchema: asoReportSchema,
  execute: async (inputData, { mastra, writer }) => {
    if (!mastra) throw new Error("Mastra instance unavailable in tool context.");
    const workflow = mastra.getWorkflow("asoAudit");
    const run = await workflow.createRun();

    // Serialize writes (writer.write must not run concurrently) and forward
    // progress derived from the workflow's step lifecycle events.
    let pending = Promise.resolve();
    const emit = (status: string) => {
      pending = pending.then(() =>
        writer?.write({ type: "data-audit-progress", data: { status } }).catch(() => {}) ?? Promise.resolve(),
      );
    };
    emit("Starting audit…");
    run.watch((event) => {
      const status = extractStatus(event);
      if (status) emit(status);
    });

    const result = await run.start({ inputData: { url: inputData.url } });
    await pending;

    if (result.status !== "success") {
      const reason = result.status === "failed" ? (result.error?.message ?? "unknown error") : result.status;
      throw new Error(`The audit did not complete (${reason}).`);
    }
    return result.result;
  },
});
