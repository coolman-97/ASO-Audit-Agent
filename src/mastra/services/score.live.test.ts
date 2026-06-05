/**
 * Verifies the structured-output scoring path: a Mastra agent + structuredOutput
 * over an OpenAI-compatible endpoint, validated against the audit schema and run
 * through computeOverallScore + report assembly. Mock server, no real key.
 * Opt-in via `npm run test:integration`.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppMetadata } from "../schema";

const VALID_SCORING = {
  dimensions: [
    { key: "title", label: "Title", weight: 20, score: 7, evidence: "Title is 27/30 chars.", notes: "Add a keyword." },
    { key: "subtitle", label: "Subtitle", weight: 15, score: 5, evidence: "No subtitle observed.", notes: "Add one." },
    { key: "keywordField", label: "Keyword Field", weight: 15, score: 6, evidence: "Inferred.", notes: "n/a" },
    { key: "description", label: "Description", weight: 10, score: 8, evidence: "Strong hook.", notes: "Good." },
    { key: "screenshots", label: "Screenshots", weight: 15, score: 6, evidence: "8 of 10 slots.", notes: "Use all 10." },
    { key: "appPreviewVideo", label: "App Preview Video", weight: 5, score: 3, evidence: "None detected.", notes: "Add one." },
    { key: "ratingsReviews", label: "Ratings & Reviews", weight: 15, score: 9, evidence: "4.8 stars.", notes: "Great." },
    { key: "icon", label: "Icon", weight: 5, score: 8, evidence: "Distinctive.", notes: "Good." },
    { key: "conversionSignals", label: "Conversion Signals", weight: 5, score: 5, evidence: "Generic notes.", notes: "Improve." },
    { key: "competitivePosition", label: "Competitive Position", weight: 5, score: 7, evidence: "Strong vs peers.", notes: "ok" },
  ],
  quickWins: [{ title: "Add a subtitle", detail: "Use 30 chars.", before: "(none)", after: "Music, Podcasts & Audiobooks" }],
  highImpact: [{ title: "Refresh screenshots", detail: "Use all 10." }],
  strategic: [{ title: "Localize", detail: "Expand to new storefronts." }],
  competitorComparison: [{ name: "Test App", rating: "4.8", ratingCount: "100", note: "subject" }],
  summary: "Solid listing with subtitle and video gaps.",
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
          id: "chatcmpl-mock",
          object: "chat.completion",
          created: 0,
          model: "mock",
          choices: [
            { index: 0, message: { role: "assistant", content: JSON.stringify(VALID_SCORING) }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LLM_API_KEY = "mock-key";
  process.env.LLM_MODEL = "vendor/mock-model";
});

afterAll(() => server?.close());

const META: AppMetadata = {
  appId: "1", country: "us", name: "Test App", developer: "Dev", iconUrl: "https://x/i.png",
  primaryGenre: "Music", genres: ["Music"], primaryGenreId: "6011", description: "A test app.",
  screenshotUrls: ["https://x/1.png"], ipadScreenshotUrls: [], trackViewUrl: "https://apps.apple.com/us/app/id1",
};

describe("structured scoring path", () => {
  it("produces a validated AsoReport with a computed overall score", async () => {
    const { Mastra } = await import("@mastra/core");
    const { scoringAgent } = await import("../agents/scoring-agent");
    const { scoreListing } = await import("./score");

    const mastra = new Mastra({ agents: { scoringAgent } });
    const report = await scoreListing(mastra, {
      metadata: META,
      extras: { subtitle: null, promotionalText: null, hasAppPreviewVideo: false, source: "unavailable" },
      reviews: { sampleSize: 10, averageOfRecent: 4.7, praiseThemes: [], complaintThemes: [], excerpts: [], available: true },
      competitors: [],
      visuals: { available: false, screenshotCount: 1, iconObservations: null, screenshotObservations: null },
    });

    expect(report.dimensions).toHaveLength(10);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.app.name).toBe("Test App");
    expect(report.quickWins[0].after).toContain("Music");
    expect(report.dataNotes.length).toBeGreaterThan(0);
  }, 30_000);
});
