import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { asoReportSchema } from "../schema";

/** Tolerantly pull a human-readable status out of a workflow stream event. */
function extractStatus(ev: unknown): string | null {
  if (!ev || typeof ev !== "object") return null;
  const e = ev as Record<string, any>;
  if (e.type === "data-audit-progress") return e.data?.status ?? null;
  if (e.payload?.output?.type === "data-audit-progress") return e.payload.output.data?.status ?? null;
  return null;
}

/**
 * Step 3 of the flow: the full ASO audit. Runs the registered `asoAudit`
 * workflow, forwarding its per-step progress to the chat so the user is kept
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

    await writer?.write({ type: "data-audit-progress", data: { status: "Starting audit…" } }).catch(() => {});

    const { stream, getWorkflowState } = run.streamLegacy({ inputData: { url: inputData.url } });
    try {
      for await (const ev of stream) {
        const status = extractStatus(ev);
        if (status) {
          await writer?.write({ type: "data-audit-progress", data: { status } });
        }
      }
    } catch {
      // Progress streaming is best-effort; the result still comes from getWorkflowState.
    }

    const state = await getWorkflowState();
    if (state.status !== "success") {
      const reason = state.status === "failed" ? (state.error?.message ?? "unknown error") : state.status;
      throw new Error(`The audit did not complete (${reason}).`);
    }
    return state.result;
  },
});
