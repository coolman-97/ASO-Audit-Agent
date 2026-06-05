/**
 * Live integration tests against the real Apple endpoints (no API keys needed).
 * Opt-in: `npm run test:integration`. Validates every non-LLM data source the
 * audit depends on, plus prompt assembly.
 */
import { describe, expect, it } from "vitest";
import { lookupAppByUrl } from "./itunes";
import { fetchReviewSummary } from "./reviews";
import { findCompetitors } from "./competitors";
import { fetchAppExtras } from "./extras";
import { buildAuditPrompt } from "./score";

const SPOTIFY = "https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580";

describe("live data sources", () => {
  it("looks up real app metadata", async () => {
    const app = await lookupAppByUrl(SPOTIFY);
    expect(app.name.toLowerCase()).toContain("spotify");
    expect(app.developer).toBeTruthy();
    expect(app.iconUrl).toMatch(/^https/);
    expect(app.screenshotUrls.length).toBeGreaterThan(0);
    expect(app.primaryGenreId).toBeTruthy();
  }, 20_000);

  it("fetches recent reviews", async () => {
    const app = await lookupAppByUrl(SPOTIFY);
    const reviews = await fetchReviewSummary(app.appId, app.country);
    expect(reviews.available).toBe(true);
    expect(reviews.sampleSize).toBeGreaterThan(0);
    expect(reviews.excerpts.length).toBeGreaterThan(0);
  }, 20_000);

  it("finds category competitors with ratings", async () => {
    const app = await lookupAppByUrl(SPOTIFY);
    const competitors = await findCompetitors(app);
    expect(competitors.length).toBeGreaterThan(0);
    expect(competitors[0].name).toBeTruthy();
  }, 30_000);

  it("fetches extras without throwing (Firecrawl optional)", async () => {
    const app = await lookupAppByUrl(SPOTIFY);
    const extras = await fetchAppExtras(app);
    expect(["firecrawl", "html-parse", "unavailable"]).toContain(extras.source);
  }, 30_000);

  it("assembles a complete audit prompt", async () => {
    const app = await lookupAppByUrl(SPOTIFY);
    const [extras, reviews, competitors] = await Promise.all([
      fetchAppExtras(app),
      fetchReviewSummary(app.appId, app.country),
      findCompetitors(app),
    ]);
    const { prompt, dataNotes } = buildAuditPrompt({
      metadata: app,
      extras,
      reviews,
      competitors,
      visuals: { available: false, screenshotCount: app.screenshotUrls.length, iconObservations: null, screenshotObservations: null },
    });
    expect(prompt).toContain("APP UNDER AUDIT");
    expect(prompt).toContain("RUBRIC");
    expect(prompt).toContain("Spotify");
    expect(dataNotes.length).toBeGreaterThan(0);
  }, 40_000);
});
