import { Firecrawl } from "@mendable/firecrawl-js";
import { z } from "zod";
import type { AppExtras, AppMetadata } from "../schema";
import { fetchWithTimeout } from "./http";

/**
 * The subtitle, promotional text, and app-preview-video flag are NOT in Apple's
 * public JSON API — they only render on the App Store web page. We extract them
 * with Firecrawl (robust LLM extraction across arbitrary listings) and fall back
 * to a best-effort keyless HTML parse so the app still runs without a key.
 */

const EXTRACT_PROMPT =
  "From this Apple App Store product page, extract the app's subtitle (the short " +
  "tagline shown directly under the app name, max ~30 chars — NOT the description), " +
  "the promotional text if present, and whether an app preview video exists on the page.";

const firecrawlSchema = z.object({
  subtitle: z.string().nullable().describe("The app subtitle/tagline under the title, or null."),
  promotionalText: z.string().nullable().describe("Promotional text block, or null if absent."),
  hasAppPreviewVideo: z.boolean().describe("True if an app preview video is shown."),
});

async function viaFirecrawl(url: string, apiKey: string): Promise<AppExtras> {
  const firecrawl = new Firecrawl({ apiKey });
  const result = await firecrawl.scrape(url, {
    formats: [{ type: "json", schema: firecrawlSchema, prompt: EXTRACT_PROMPT }],
    onlyMainContent: false,
  });
  const json = (result as { json?: z.infer<typeof firecrawlSchema> }).json;
  return {
    subtitle: json?.subtitle ?? null,
    promotionalText: json?.promotionalText ?? null,
    hasAppPreviewVideo: json?.hasAppPreviewVideo ?? null,
    source: "firecrawl",
  };
}

/** Best-effort keyless parse. Apple gates most of this, so it often returns nulls. */
async function viaHtml(url: string): Promise<AppExtras> {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 10_000);
    const html = await res.text();

    // App preview videos are served as .mp4/.m3u8 from Apple's CDN; their presence
    // in the page markup is a reliable-enough signal that a preview video exists.
    const hasVideo = /\.(m3u8|mp4)(\?|")/.test(html) || /"editorialVideo"/.test(html);

    // Subtitle occasionally appears in an og/twitter description prefix; rarely reliable.
    const subtitleMatch = html.match(/product-header__subtitle[^>]*>\s*([^<]{2,40})\s*</);
    const subtitle = subtitleMatch ? subtitleMatch[1].trim() : null;

    const found = subtitle !== null || hasVideo;
    return {
      subtitle,
      promotionalText: null,
      hasAppPreviewVideo: hasVideo,
      source: found ? "html-parse" : "unavailable",
    };
  } catch {
    return { subtitle: null, promotionalText: null, hasAppPreviewVideo: null, source: "unavailable" };
  }
}

export async function fetchAppExtras(app: AppMetadata): Promise<AppExtras> {
  const url = app.trackViewUrl;
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (apiKey) {
    try {
      return await viaFirecrawl(url, apiKey);
    } catch {
      // Fall through to the keyless path if Firecrawl errors/rate-limits.
    }
  }
  return viaHtml(url);
}
