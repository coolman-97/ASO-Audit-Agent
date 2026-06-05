/**
 * End-to-end audit pipeline test: the real `auditWorkflow` + the `runAudit` tool,
 * driven against real Apple data and a mock LLM. Exercises createWorkflow,
 * run.streamLegacy progress forwarding, getWorkflowState, and report assembly.
 * Opt-in via `npm run test:integration`.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SPOTIFY = "https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580";

const SCORING = {
  dimensions: [
    "title", "subtitle", "keywordField", "description", "screenshots",
    "appPreviewVideo", "ratingsReviews", "icon", "conversionSignals", "competitivePosition",
  ].map((key) => ({ key, label: key, weight: 10, score: 7, evidence: "e", notes: "n" })),
  quickWins: [{ title: "qw", detail: "d" }],
  highImpact: [{ title: "hi", detail: "d" }],
  strategic: [{ title: "st", detail: "d" }],
  competitorComparison: [{ name: "Spotify", rating: "4.8", ratingCount: "40M", note: "subject" }],
  summary: "summary",
};

let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: "m", object: "chat.completion", created: 0, model: "mock",
          choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(SCORING) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LLM_API_KEY = "mock-key";
  process.env.LLM_MODEL = "vendor/mock-model";
  // Force the metadata-only visual fallback so this test doesn't depend on a VLM mock.
  process.env.LLM_VISION_MODEL = "";
});

afterAll(() => server?.close());

describe("audit pipeline", () => {
  it("runs the runAudit tool end-to-end and streams progress", async () => {
    const { mastra } = await import("../index");
    const { runAuditTool } = await import("../tools/run-audit");

    const progress: string[] = [];
    const writer = { write: async (d: any) => { if (d?.data?.status) progress.push(d.data.status); } };

    const report = await (runAuditTool as any).execute(
      { url: SPOTIFY },
      { mastra, writer },
    );

    expect(report.dimensions).toHaveLength(10);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.app.name.toLowerCase()).toContain("spotify");
    expect(report.competitorComparison.length).toBeGreaterThan(0);
    // Progress should have been forwarded from the workflow steps.
    expect(progress.length).toBeGreaterThan(0);
  }, 90_000);
});
